package main

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

type mockDynamoDBClient struct {
	queryFn              func(ctx context.Context, params *dynamodb.QueryInput, optFns ...func(*dynamodb.Options)) (*dynamodb.QueryOutput, error)
	transactWriteItemsFn func(ctx context.Context, params *dynamodb.TransactWriteItemsInput, optFns ...func(*dynamodb.Options)) (*dynamodb.TransactWriteItemsOutput, error)
}

func (m *mockDynamoDBClient) Query(ctx context.Context, params *dynamodb.QueryInput, optFns ...func(*dynamodb.Options)) (*dynamodb.QueryOutput, error) {
	if m.queryFn != nil {
		return m.queryFn(ctx, params, optFns...)
	}
	return &dynamodb.QueryOutput{Items: []map[string]types.AttributeValue{}}, nil
}

func (m *mockDynamoDBClient) TransactWriteItems(ctx context.Context, params *dynamodb.TransactWriteItemsInput, optFns ...func(*dynamodb.Options)) (*dynamodb.TransactWriteItemsOutput, error) {
	if m.transactWriteItemsFn != nil {
		return m.transactWriteItemsFn(ctx, params, optFns...)
	}
	return &dynamodb.TransactWriteItemsOutput{}, nil
}

func TestBuildResponse(t *testing.T) {
	resp := buildResponse(200, map[string]string{"message": "ok"})
	if resp.StatusCode != 200 {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
	if resp.Headers["Content-Type"] != "application/json" {
		t.Errorf("expected application/json content type")
	}

	var body map[string]string
	json.Unmarshal([]byte(resp.Body), &body)
	if body["message"] != "ok" {
		t.Errorf("expected message 'ok', got '%s'", body["message"])
	}
}

func TestBuildErrorResponse(t *testing.T) {
	errResp := ErrorResponse{
		Success:   false,
		Message:   "Ticket already used",
		ErrorCode: "INVALID_TICKET",
	}
	resp := buildResponse(409, errResp)
	if resp.StatusCode != 409 {
		t.Errorf("expected 409, got %d", resp.StatusCode)
	}

	var body ErrorResponse
	json.Unmarshal([]byte(resp.Body), &body)
	if body.Success != false {
		t.Error("expected success to be false")
	}
	if body.ErrorCode != "INVALID_TICKET" {
		t.Errorf("expected INVALID_TICKET, got %s", body.ErrorCode)
	}
}

func TestCheckinRequestParsing(t *testing.T) {
	jsonStr := `{"ticketId": "abc-123"}`
	var req CheckinRequest
	err := json.Unmarshal([]byte(jsonStr), &req)
	if err != nil {
		t.Fatalf("failed to parse: %v", err)
	}
	if req.TicketId != "abc-123" {
		t.Errorf("expected abc-123, got %s", req.TicketId)
	}
}

func TestCheckinRequestEmpty(t *testing.T) {
	jsonStr := `{}`
	var req CheckinRequest
	json.Unmarshal([]byte(jsonStr), &req)
	if req.TicketId != "" {
		t.Error("expected empty ticketId")
	}
}

func TestHandlerNilPathParameters(t *testing.T) {
	oldClient := dbClient
	defer func() { dbClient = oldClient }()

	dbClient = &mockDynamoDBClient{
		queryFn: func(ctx context.Context, params *dynamodb.QueryInput, optFns ...func(*dynamodb.Options)) (*dynamodb.QueryOutput, error) {
			return &dynamodb.QueryOutput{Items: []map[string]types.AttributeValue{}}, nil
		},
	}

	req := events.APIGatewayV2HTTPRequest{
		RequestContext: events.APIGatewayV2HTTPRequestContext{
			HTTP: events.APIGatewayV2HTTPRequestContextHTTPDescription{
				Method: "GET",
				Path:   "/api/v1/events/evt123/check-ins",
			},
		},
		PathParameters: nil,
	}

	resp, err := handler(context.Background(), req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.StatusCode != 200 {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
}

func TestCheckinInvalidJSON(t *testing.T) {
	req := events.APIGatewayV2HTTPRequest{
		RequestContext: events.APIGatewayV2HTTPRequestContext{
			HTTP: events.APIGatewayV2HTTPRequestContextHTTPDescription{
				Method: "POST",
				Path:   "/api/v1/check-in",
			},
		},
		Body: "{invalid-json",
	}
	resp, err := handler(context.Background(), req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.StatusCode != 400 {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}
}

func TestCheckinNonExistentTicket404(t *testing.T) {
	oldClient := dbClient
	defer func() { dbClient = oldClient }()

	dbClient = &mockDynamoDBClient{
		queryFn: func(ctx context.Context, params *dynamodb.QueryInput, optFns ...func(*dynamodb.Options)) (*dynamodb.QueryOutput, error) {
			return &dynamodb.QueryOutput{Items: []map[string]types.AttributeValue{}}, nil
		},
	}

	req := events.APIGatewayV2HTTPRequest{
		RequestContext: events.APIGatewayV2HTTPRequestContext{
			HTTP: events.APIGatewayV2HTTPRequestContextHTTPDescription{
				Method: "POST",
				Path:   "/api/v1/check-in",
			},
		},
		Body: `{"ticketId": "nonexistent-ticket"}`,
	}

	resp, err := handler(context.Background(), req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.StatusCode != 404 {
		t.Errorf("expected 404 for nonexistent ticket, got %d", resp.StatusCode)
	}

	var errResp ErrorResponse
	json.Unmarshal([]byte(resp.Body), &errResp)
	if errResp.ErrorCode != "NOT_FOUND" {
		t.Errorf("expected NOT_FOUND error code, got %s", errResp.ErrorCode)
	}
}

func TestCheckinDuplicateCheckin409(t *testing.T) {
	oldClient := dbClient
	defer func() { dbClient = oldClient }()

	dbClient = &mockDynamoDBClient{
		queryFn: func(ctx context.Context, params *dynamodb.QueryInput, optFns ...func(*dynamodb.Options)) (*dynamodb.QueryOutput, error) {
			item := map[string]types.AttributeValue{
				"PK":     &types.AttributeValueMemberS{Value: "EVENT#evt1"},
				"SK":     &types.AttributeValueMemberS{Value: "REG#test@example.com"},
				"email":  &types.AttributeValueMemberS{Value: "test@example.com"},
				"status": &types.AttributeValueMemberS{Value: "checked_in"},
			}
			return &dynamodb.QueryOutput{Items: []map[string]types.AttributeValue{item}}, nil
		},
	}

	req := events.APIGatewayV2HTTPRequest{
		RequestContext: events.APIGatewayV2HTTPRequestContext{
			HTTP: events.APIGatewayV2HTTPRequestContextHTTPDescription{
				Method: "POST",
				Path:   "/api/v1/check-in",
			},
		},
		Body: `{"ticketId": "already-used-ticket"}`,
	}

	resp, err := handler(context.Background(), req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.StatusCode != 409 {
		t.Errorf("expected 409 for duplicate check-in, got %d", resp.StatusCode)
	}
}

func TestCheckinSuccess(t *testing.T) {
	oldClient := dbClient
	defer func() { dbClient = oldClient }()

	dbClient = &mockDynamoDBClient{
		queryFn: func(ctx context.Context, params *dynamodb.QueryInput, optFns ...func(*dynamodb.Options)) (*dynamodb.QueryOutput, error) {
			item := map[string]types.AttributeValue{
				"PK":     &types.AttributeValueMemberS{Value: "EVENT#evt1"},
				"SK":     &types.AttributeValueMemberS{Value: "REG#test@example.com"},
				"email":  &types.AttributeValueMemberS{Value: "test@example.com"},
				"status": &types.AttributeValueMemberS{Value: "registered"},
			}
			return &dynamodb.QueryOutput{Items: []map[string]types.AttributeValue{item}}, nil
		},
		transactWriteItemsFn: func(ctx context.Context, params *dynamodb.TransactWriteItemsInput, optFns ...func(*dynamodb.Options)) (*dynamodb.TransactWriteItemsOutput, error) {
			return &dynamodb.TransactWriteItemsOutput{}, nil
		},
	}

	req := events.APIGatewayV2HTTPRequest{
		RequestContext: events.APIGatewayV2HTTPRequestContext{
			HTTP: events.APIGatewayV2HTTPRequestContextHTTPDescription{
				Method: "POST",
				Path:   "/api/v1/check-in",
			},
		},
		Body: `{"ticketId": "valid-ticket-123"}`,
	}

	resp, err := handler(context.Background(), req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.StatusCode != 200 {
		t.Errorf("expected 200 for successful check-in, got %d", resp.StatusCode)
	}
}

func TestGetCheckinsListing(t *testing.T) {
	oldClient := dbClient
	defer func() { dbClient = oldClient }()

	dbClient = &mockDynamoDBClient{
		queryFn: func(ctx context.Context, params *dynamodb.QueryInput, optFns ...func(*dynamodb.Options)) (*dynamodb.QueryOutput, error) {
			item1 := map[string]types.AttributeValue{
				"PK":     &types.AttributeValueMemberS{Value: "EVENT#evt1"},
				"SK":     &types.AttributeValueMemberS{Value: "REG#user1@example.com"},
				"email":  &types.AttributeValueMemberS{Value: "user1@example.com"},
				"status": &types.AttributeValueMemberS{Value: "checked_in"},
			}
			item2 := map[string]types.AttributeValue{
				"PK":     &types.AttributeValueMemberS{Value: "EVENT#evt1"},
				"SK":     &types.AttributeValueMemberS{Value: "REG#user2@example.com"},
				"email":  &types.AttributeValueMemberS{Value: "user2@example.com"},
				"status": &types.AttributeValueMemberS{Value: "registered"},
			}
			return &dynamodb.QueryOutput{Items: []map[string]types.AttributeValue{item1, item2}}, nil
		},
	}

	req := events.APIGatewayV2HTTPRequest{
		RequestContext: events.APIGatewayV2HTTPRequestContext{
			HTTP: events.APIGatewayV2HTTPRequestContextHTTPDescription{
				Method: "GET",
				Path:   "/api/v1/events/evt1/check-ins",
			},
		},
		PathParameters: map[string]string{"eventId": "evt1"},
	}

	resp, err := handler(context.Background(), req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.StatusCode != 200 {
		t.Errorf("expected 200 for check-ins listing, got %d", resp.StatusCode)
	}

	var checkinResp CheckinResponse
	json.Unmarshal([]byte(resp.Body), &checkinResp)
	if checkinResp.CheckedIn != 1 {
		t.Errorf("expected 1 checkedIn, got %d", checkinResp.CheckedIn)
	}
	if checkinResp.Total != 2 {
		t.Errorf("expected 2 total, got %d", checkinResp.Total)
	}
}

func TestSafeTypeAssertions(t *testing.T) {
	oldClient := dbClient
	defer func() { dbClient = oldClient }()

	// Item missing email string or PK/SK string
	dbClient = &mockDynamoDBClient{
		queryFn: func(ctx context.Context, params *dynamodb.QueryInput, optFns ...func(*dynamodb.Options)) (*dynamodb.QueryOutput, error) {
			item := map[string]types.AttributeValue{
				"PK":     &types.AttributeValueMemberS{Value: "EVENT#evt1"},
				"SK":     &types.AttributeValueMemberN{Value: "12345"}, // Wrong type! N instead of S
				"email":  &types.AttributeValueMemberS{Value: "test@example.com"},
				"status": &types.AttributeValueMemberS{Value: "registered"},
			}
			return &dynamodb.QueryOutput{Items: []map[string]types.AttributeValue{item}}, nil
		},
	}

	req := events.APIGatewayV2HTTPRequest{
		RequestContext: events.APIGatewayV2HTTPRequestContext{
			HTTP: events.APIGatewayV2HTTPRequestContextHTTPDescription{
				Method: "POST",
				Path:   "/api/v1/check-in",
			},
		},
		Body: `{"ticketId": "bad-type-item"}`,
	}

	resp, err := handler(context.Background(), req)
	if err != nil {
		t.Fatalf("unexpected panic/error: %v", err)
	}
	if resp.StatusCode != 500 {
		t.Errorf("expected 500 for invalid item type assertion, got %d", resp.StatusCode)
	}
}
