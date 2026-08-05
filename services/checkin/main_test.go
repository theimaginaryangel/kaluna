package main

import (
	"encoding/json"
	"testing"
)

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
