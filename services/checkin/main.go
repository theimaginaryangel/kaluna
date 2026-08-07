package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

type DynamoDBClient interface {
	Query(ctx context.Context, params *dynamodb.QueryInput, optFns ...func(*dynamodb.Options)) (*dynamodb.QueryOutput, error)
	GetItem(ctx context.Context, params *dynamodb.GetItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.GetItemOutput, error)
	TransactWriteItems(ctx context.Context, params *dynamodb.TransactWriteItemsInput, optFns ...func(*dynamodb.Options)) (*dynamodb.TransactWriteItemsOutput, error)
}

var dbClient DynamoDBClient
var tableName string

func init() {
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err == nil {
		dbClient = dynamodb.NewFromConfig(cfg)
	} else {
		log.Printf("unable to load SDK config: %v", err)
	}
	tableName = os.Getenv("TABLE_NAME")
	if tableName == "" {
		tableName = "kaluna-dev-table"
	}
}

type ErrorResponse struct {
	Success   bool   `json:"success"`
	Message   string `json:"message"`
	ErrorCode string `json:"errorCode"`
}

type CheckinRequest struct {
	TicketId string `json:"ticketId"`
}

type CheckinResponse struct {
	CheckedIn int                      `json:"checkedIn"`
	Total     int                      `json:"total"`
	Attendees []map[string]interface{} `json:"attendees"`
}

func buildResponse(statusCode int, body interface{}) events.APIGatewayV2HTTPResponse {
	b, _ := json.Marshal(body)
	return events.APIGatewayV2HTTPResponse{
		StatusCode: statusCode,
		Headers: map[string]string{
			"Content-Type": "application/json",
		},
		Body: string(b),
	}
}

func logEvent(reqID, eventID, action string, startTime time.Time, status string) {
	latencyMs := time.Since(startTime).Milliseconds()
	logLine := map[string]interface{}{
		"requestId": reqID,
		"eventId":   eventID,
		"action":    action,
		"latencyMs": latencyMs,
		"status":    status,
	}
	b, _ := json.Marshal(logLine)
	fmt.Println(string(b))
}

func handler(ctx context.Context, request events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	startTime := time.Now()
	reqID := request.RequestContext.RequestID
	if reqID == "" {
		reqID = "unknown-request"
	}

	method := request.RequestContext.HTTP.Method
	path := request.RequestContext.HTTP.Path
	if path == "" {
		path = request.RawPath
	}
	action := method + " " + path

	if method == "POST" && strings.HasSuffix(path, "/api/v1/check-in") {
		resp := handleCheckin(ctx, request)
		logEvent(reqID, "N/A", action, startTime, "success") // could extract event ID if successful
		return resp, nil
	}

	if method == "GET" && strings.Contains(path, "/check-ins") {
		var eventID string
		if request.PathParameters != nil {
			eventID = request.PathParameters["eventId"]
		}
		resp := handleGetCheckins(ctx, request, eventID)
		logEvent(reqID, eventID, action, startTime, "success")
		return resp, nil
	}

	logEvent(reqID, "N/A", action, startTime, "error")
	return buildResponse(404, ErrorResponse{Success: false, Message: "Route not found", ErrorCode: "NOT_FOUND"}), nil
}

func handleCheckin(ctx context.Context, req events.APIGatewayV2HTTPRequest) events.APIGatewayV2HTTPResponse {
	var body CheckinRequest
	if err := json.Unmarshal([]byte(req.Body), &body); err != nil {
		return buildResponse(400, ErrorResponse{Success: false, Message: "Invalid JSON", ErrorCode: "BAD_REQUEST"})
	}

	if body.TicketId == "" {
		return buildResponse(400, ErrorResponse{Success: false, Message: "Missing ticketId", ErrorCode: "BAD_REQUEST"})
	}

	if dbClient == nil {
		return buildResponse(500, ErrorResponse{Success: false, Message: "DB client not initialized", ErrorCode: "INTERNAL_ERROR"})
	}

	// 1. Look up ticket using GSI1
	gsiPK := "TICKET#" + body.TicketId
	queryInput := &dynamodb.QueryInput{
		TableName:              &tableName,
		IndexName:              &[]string{"GSI1"}[0],
		KeyConditionExpression: &[]string{"GSI1PK = :pk"}[0],
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":pk": &types.AttributeValueMemberS{Value: gsiPK},
		},
	}

	result, err := dbClient.Query(ctx, queryInput)
	if err != nil {
		return buildResponse(500, ErrorResponse{Success: false, Message: "Failed to query ticket", ErrorCode: "INTERNAL_ERROR"})
	}
	if len(result.Items) == 0 {
		return buildResponse(404, ErrorResponse{Success: false, Message: "Ticket not found", ErrorCode: "NOT_FOUND"})
	}

	var regItem map[string]interface{}
	err = attributevalue.UnmarshalMap(result.Items[0], &regItem)
	if err != nil {
		return buildResponse(500, ErrorResponse{Success: false, Message: "Failed to parse ticket", ErrorCode: "INTERNAL_ERROR"})
	}

	status, ok := regItem["status"].(string)
	if !ok || status != "registered" {
		return buildResponse(409, ErrorResponse{Success: false, Message: "Ticket already used or invalid", ErrorCode: "INVALID_TICKET"})
	}

	pk, pkOk := regItem["PK"].(string)
	sk, skOk := regItem["SK"].(string)
	email, emailOk := regItem["email"].(string)
	if !pkOk || !skOk || !emailOk {
		return buildResponse(500, ErrorResponse{Success: false, Message: "Invalid ticket data", ErrorCode: "INTERNAL_ERROR"})
	}

	now := time.Now().UTC().Format(time.RFC3339)
	auditSK := "AUDIT#" + now

	auditItem, _ := attributevalue.MarshalMap(map[string]interface{}{
		"PK":      pk,
		"SK":      auditSK,
		"action":  "TICKET_CHECKED_IN",
		"actor":   email,
		"details": "Ticket " + body.TicketId + " checked in",
	})

	// 2. Perform transactional update
	transactItems := []types.TransactWriteItem{
		{
			Update: &types.Update{
				TableName: &tableName,
				Key: map[string]types.AttributeValue{
					"PK": &types.AttributeValueMemberS{Value: pk},
					"SK": &types.AttributeValueMemberS{Value: sk},
				},
				UpdateExpression: &[]string{"SET #st = :checked_in"}[0],
				ConditionExpression: &[]string{"#st = :registered"}[0],
				ExpressionAttributeNames: map[string]string{
					"#st": "status",
				},
				ExpressionAttributeValues: map[string]types.AttributeValue{
					":checked_in": &types.AttributeValueMemberS{Value: "checked_in"},
					":registered": &types.AttributeValueMemberS{Value: "registered"},
				},
			},
		},
		{
			Put: &types.Put{
				TableName: &tableName,
				Item:      auditItem,
			},
		},
	}

	_, err = dbClient.TransactWriteItems(ctx, &dynamodb.TransactWriteItemsInput{
		TransactItems: transactItems,
	})

	if err != nil {
		if strings.Contains(err.Error(), "ConditionalCheckFailed") {
			return buildResponse(409, ErrorResponse{Success: false, Message: "Ticket already used or invalid", ErrorCode: "INVALID_TICKET"})
		}
		return buildResponse(500, ErrorResponse{Success: false, Message: "Checkin failed", ErrorCode: "INTERNAL_ERROR"})
	}

	return buildResponse(200, map[string]string{"message": "Valid ticket, checked in"})
}

func handleGetCheckins(ctx context.Context, req events.APIGatewayV2HTTPRequest, eventID string) events.APIGatewayV2HTTPResponse {
	if dbClient == nil {
		return buildResponse(500, ErrorResponse{Success: false, Message: "DB client not initialized", ErrorCode: "INTERNAL_ERROR"})
	}

	// RBAC: only the event owner or an Admin may read the check-in feed for an event.
	if !isAdminOrOwner(ctx, req, eventID) {
		return buildResponse(403, ErrorResponse{Success: false, Message: "Forbidden", ErrorCode: "FORBIDDEN"})
	}

	pk := "EVENT#" + eventID
	skPrefix := "REG#"

	queryInput := &dynamodb.QueryInput{
		TableName:              &tableName,
		KeyConditionExpression: &[]string{"PK = :pk AND begins_with(SK, :sk)"}[0],
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":pk": &types.AttributeValueMemberS{Value: pk},
			":sk": &types.AttributeValueMemberS{Value: skPrefix},
		},
	}

	result, err := dbClient.Query(ctx, queryInput)
	if err != nil {
		return buildResponse(500, ErrorResponse{Success: false, Message: "Failed to query", ErrorCode: "INTERNAL_ERROR"})
	}

	checkedIn := 0
	total := len(result.Items)
	attendees := make([]map[string]interface{}, 0)

	for _, item := range result.Items {
		var reg map[string]interface{}
		attributevalue.UnmarshalMap(item, &reg)

		// clean up DB keys
		delete(reg, "PK")
		delete(reg, "SK")
		delete(reg, "GSI1PK")
		delete(reg, "GSI1SK")

		if statusVal, ok := reg["status"].(string); ok && statusVal == "checked_in" {
			checkedIn++
		}
		attendees = append(attendees, reg)
	}

	return buildResponse(200, CheckinResponse{
		CheckedIn: checkedIn,
		Total:     total,
		Attendees: attendees,
	})
}

func callerClaims(req events.APIGatewayV2HTTPRequest) map[string]string {
	if req.RequestContext.Authorizer == nil || req.RequestContext.Authorizer.JWT == nil {
		return nil
	}
	return req.RequestContext.Authorizer.JWT.Claims
}

func isAdminOrOwner(ctx context.Context, req events.APIGatewayV2HTTPRequest, eventID string) bool {
	claims := callerClaims(req)

	groupsRaw := ""
	if claims != nil {
		groupsRaw = claims["cognito:groups"]
	}
	for _, group := range strings.Split(strings.Trim(groupsRaw, "[]"), ",") {
		if strings.TrimSpace(group) == "Admin" {
			return true
		}
	}

	sub := ""
	if claims != nil {
		sub = claims["sub"]
	}
	if sub == "" || eventID == "" {
		return false
	}

	out, err := dbClient.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: &tableName,
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: "EVENT#" + eventID},
			"SK": &types.AttributeValueMemberS{Value: "METADATA"},
		},
	})
	if err != nil || out.Item == nil {
		return false
	}

	var evt map[string]interface{}
	if err := attributevalue.UnmarshalMap(out.Item, &evt); err != nil {
		return false
	}
	owner, _ := evt["ownerId"].(string)
	return owner != "" && owner == sub
}

func main() {
	lambda.Start(handler)
}
