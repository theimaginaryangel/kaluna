#!/usr/bin/env python3
"""
Kaluna Serverless Ticketing Platform - Automated E2E Test Runner
Milestone 3: HTTP End-to-End Test Suite over TCP Sockets

Tiers Covered:
- Tier 1: Feature Coverage (Health, Create, List, Get, Register, Ticket Lookup, Check-in, Check-ins list, Registrations CSV export, Analytics, Cancel)
- Tier 2: Boundary & Edge Cases (404 event registration, duplicate registration, email casing normalization, zero seats & waitlist, duplicate check-ins)
- Tier 3: Cross-Feature Combinations (Register -> Cancel -> Waitlist Auto-Promotion -> Check-in Promoted Attendee)
- Tier 4: Real-World Application Scenario (Full End-to-End Event Lifecycle)
"""

import os
import sys
import json
import time
import uuid
import urllib.request
import urllib.parse
import urllib.error
import threading
import importlib.util
from http.server import HTTPServer, BaseHTTPRequestHandler, ThreadingHTTPServer
from datetime import datetime

# Determine project root and module directories
THIS_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(THIS_DIR, "..", ".."))
SERVICES_DIR = os.path.join(PROJECT_ROOT, "services")
EVENTS_DIR = os.path.join(SERVICES_DIR, "events")
REGISTRATIONS_DIR = os.path.join(SERVICES_DIR, "registrations")

if EVENTS_DIR not in sys.path:
    sys.path.insert(0, EVENTS_DIR)
if REGISTRATIONS_DIR not in sys.path:
    sys.path.insert(0, REGISTRATIONS_DIR)

# Global test metrics
total_tests_run = 0
total_tests_passed = 0
total_tests_failed = 0
server_500_errors_count = 0

# Global handlers dynamically loaded when running local server
events_handler = None
registrations_handler = None


def load_handlers():
    global events_handler, registrations_handler
    
    # Load events handler
    spec_events = importlib.util.spec_from_file_location("events_app", os.path.join(EVENTS_DIR, "app.py"))
    events_mod = importlib.util.module_from_spec(spec_events)
    spec_events.loader.exec_module(events_mod)
    events_handler = events_mod.lambda_handler

    # Load registrations handler
    spec_reg = importlib.util.spec_from_file_location("registrations_app", os.path.join(REGISTRATIONS_DIR, "app.py"))
    reg_mod = importlib.util.module_from_spec(spec_reg)
    spec_reg.loader.exec_module(reg_mod)
    registrations_handler = reg_mod.lambda_handler


def clean_item(item: dict) -> dict:
    cleaned = item.copy()
    cleaned.pop('PK', None)
    cleaned.pop('SK', None)
    cleaned.pop('GSI1PK', None)
    cleaned.pop('GSI1SK', None)
    return cleaned


def handle_checkin_local(event: dict) -> dict:
    import boto3
    from boto3.dynamodb.conditions import Key
    from botocore.exceptions import ClientError

    table_name = os.environ.get('TABLE_NAME', 'kaluna-dev-table')
    table = boto3.resource('dynamodb').Table(table_name)
    body_raw = event.get('body', '{}')
    try:
        body = json.loads(body_raw)
    except Exception:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({"success": False, "message": "Invalid JSON", "errorCode": "BAD_REQUEST"})
        }

    ticket_id = body.get('ticketId')
    if not ticket_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({"success": False, "message": "Missing ticketId", "errorCode": "BAD_REQUEST"})
        }

    response = table.query(
        IndexName='GSI1',
        KeyConditionExpression=Key('GSI1PK').eq(f"TICKET#{ticket_id}")
    )
    items = response.get('Items', [])
    if not items:
        return {
            'statusCode': 404,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({"success": False, "message": "Ticket not found", "errorCode": "NOT_FOUND"})
        }

    reg_item = items[0]
    if reg_item.get('status') != 'registered':
        return {
            'statusCode': 409,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({"success": False, "message": "Ticket already used or invalid", "errorCode": "INVALID_TICKET"})
        }

    pk = reg_item['PK']
    sk = reg_item['SK']
    email = reg_item.get('email', '')
    now = datetime.utcnow().isoformat() + 'Z'
    audit_item = {
        'PK': pk,
        'SK': f"AUDIT#{now}",
        'action': "TICKET_CHECKED_IN",
        'actor': email,
        'details': f"Ticket {ticket_id} checked in"
    }

    try:
        boto3.resource('dynamodb').meta.client.transact_write_items(
            TransactItems=[
                {
                    'Update': {
                        'TableName': table_name,
                        'Key': {'PK': pk, 'SK': sk},
                        'UpdateExpression': "SET #st = :checked_in",
                        'ConditionExpression': "#st = :registered",
                        'ExpressionAttributeNames': {'#st': 'status'},
                        'ExpressionAttributeValues': {
                            ':checked_in': 'checked_in',
                            ':registered': 'registered'
                        }
                    }
                },
                {
                    'Put': {
                        'TableName': table_name,
                        'Item': audit_item
                    }
                }
            ]
        )
    except ClientError as e:
        error_code = e.response.get('Error', {}).get('Code')
        if error_code == 'TransactionCanceledException':
            return {
                'statusCode': 409,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({"success": False, "message": "Ticket already used or invalid", "errorCode": "INVALID_TICKET"})
            }
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({"success": False, "message": f"Checkin failed: {str(e)}", "errorCode": "INTERNAL_ERROR"})
        }

    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps({"message": "Valid ticket, checked in"})
    }


def handle_get_checkins_local(event_id: str) -> dict:
    import boto3
    from boto3.dynamodb.conditions import Key

    table_name = os.environ.get('TABLE_NAME', 'kaluna-dev-table')
    table = boto3.resource('dynamodb').Table(table_name)
    response = table.query(
        KeyConditionExpression=Key('PK').eq(f"EVENT#{event_id}") & Key('SK').begins_with("REG#")
    )
    items = response.get('Items', [])
    checked_in = 0
    total = len(items)
    attendees = []

    for item in items:
        cleaned = clean_item(item)
        if cleaned.get('status') == 'checked_in':
            checked_in += 1
        attendees.append(cleaned)

    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps({
            "checkedIn": checked_in,
            "total": total,
            "attendees": attendees
        })
    }


class LocalAPIGatewayHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Suppress default server logging to keep test CLI output clean
        pass

    def do_GET(self):
        self.handle_request('GET')

    def do_POST(self):
        self.handle_request('POST')

    def do_PUT(self):
        self.handle_request('PUT')

    def do_DELETE(self):
        self.handle_request('DELETE')

    def handle_request(self, method):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        raw_query = parsed_url.query

        query_params = {}
        if raw_query:
            parsed_qs = urllib.parse.parse_qs(raw_query)
            for k, v in parsed_qs.items():
                query_params[k] = v[0] if len(v) == 1 else v

        content_length = int(self.headers.get('Content-Length', 0))
        body = ''
        if content_length > 0:
            body = self.rfile.read(content_length).decode('utf-8')

        headers_dict = dict(self.headers)

        event = {
            'requestContext': {
                'http': {
                    'method': method,
                    'path': path,
                    'protocol': 'HTTP/1.1',
                    'sourceIp': '127.0.0.1',
                    'userAgent': headers_dict.get('User-Agent', '')
                },
                'requestId': str(uuid.uuid4())
            },
            'rawPath': path,
            'rawQueryString': raw_query,
            'queryStringParameters': query_params,
            'headers': headers_dict,
            'body': body,
            'isBase64Encoded': False
        }

        try:
            response = self.route_event(method, path, event)
        except Exception as ex:
            response = {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({"success": False, "message": f"Server exception: {str(ex)}", "errorCode": "INTERNAL_ERROR"})
            }

        status_code = response.get('statusCode', 200)
        resp_headers = response.get('headers', {})
        resp_body = response.get('body', '')

        self.send_response(status_code)
        for hk, hv in resp_headers.items():
            self.send_header(hk, hv)
        if 'Content-Type' not in resp_headers and 'content-type' not in [k.lower() for k in resp_headers.keys()]:
            self.send_header('Content-Type', 'application/json')

        body_bytes = resp_body.encode('utf-8') if isinstance(resp_body, str) else resp_body
        self.send_header('Content-Length', str(len(body_bytes)))
        self.end_headers()
        self.wfile.write(body_bytes)

    def route_event(self, method: str, path: str, event: dict) -> dict:
        if path == '/api/v1/health' and method == 'GET':
            return events_handler(event, None)

        if path == '/api/v1/analytics' and method == 'GET':
            return events_handler(event, None)

        if path == '/api/v1/events':
            return events_handler(event, None)

        if path.startswith('/api/v1/events/'):
            parts = [p for p in path.strip('/').split('/') if p]
            if len(parts) >= 4:
                event_id = parts[3]
                event['pathParameters'] = {'eventId': event_id}

                if len(parts) == 5 and parts[4] == 'register' and method == 'POST':
                    return registrations_handler(event, None)

                if len(parts) == 5 and parts[4] == 'registrations' and method == 'GET':
                    return events_handler(event, None)

                if len(parts) == 5 and parts[4] == 'check-ins' and method == 'GET':
                    return handle_get_checkins_local(event_id)

                if len(parts) == 4:
                    return events_handler(event, None)

        if path.startswith('/api/v1/registrations/'):
            parts = [p for p in path.strip('/').split('/') if p]
            if len(parts) >= 4:
                ticket_id = parts[3]
                event['pathParameters'] = {'ticketId': ticket_id}

                if len(parts) == 5 and parts[4] == 'cancel' and method == 'POST':
                    return registrations_handler(event, None)

                if len(parts) == 4 and method == 'GET':
                    return registrations_handler(event, None)

        if path == '/api/v1/check-in' and method == 'POST':
            return handle_checkin_local(event)

        return {
            'statusCode': 404,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({"success": False, "message": "Route not found", "errorCode": "NOT_FOUND"})
        }


def make_http_request(method: str, url: str, body: dict | str | None = None, headers: dict | None = None) -> tuple[int, dict, str]:
    global server_500_errors_count
    if headers is None:
        headers = {}

    if body is not None and isinstance(body, (dict, list)):
        body_bytes = json.dumps(body).encode('utf-8')
        if 'Content-Type' not in headers:
            headers['Content-Type'] = 'application/json'
    elif body is not None and isinstance(body, str):
        body_bytes = body.encode('utf-8')
    elif body is not None and isinstance(body, bytes):
        body_bytes = body
    else:
        body_bytes = None

    req = urllib.request.Request(url, data=body_bytes, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req) as resp:
            status = resp.status
            resp_headers = dict(resp.headers)
            resp_body = resp.read().decode('utf-8')
    except urllib.error.HTTPError as e:
        status = e.code
        resp_headers = dict(e.headers)
        resp_body = e.read().decode('utf-8')
    except Exception as e:
        print(f"  [HTTP ERROR] {method} {url} failed: {e}")
        return 0, {}, str(e)

    if status == 500:
        server_500_errors_count += 1
        print(f"  [CRITICAL ERROR] Received 500 Internal Server Error for {method} {url}")

    print(f"  [HTTP] {method} {url} -> Status {status}")
    return status, resp_headers, resp_body


def assert_test(condition: bool, name: str, details: str = ""):
    global total_tests_run, total_tests_passed, total_tests_failed
    total_tests_run += 1
    if condition:
        total_tests_passed += 1
        print(f"  [PASS] {name}")
    else:
        total_tests_failed += 1
        print(f"  [FAIL] {name} {details}")


# ==========================================
# TEST SUITE TIERS
# ==========================================

def run_tier1_feature_coverage(base_url: str):
    print("\n--- TIER 1: Feature Coverage (Core API Functionality) ---")

    # 1. Health Check
    status, _, body = make_http_request("GET", f"{base_url}/api/v1/health")
    assert_test(status == 200, "Tier 1: Health check status 200")
    b = json.loads(body) if status == 200 else {}
    assert_test(b.get("status") == "healthy", "Tier 1: Health status is healthy")

    # 2. Create Event
    event_payload = {
        "name": "Tier 1 Gala",
        "date": "2026-11-15",
        "venue": "Grand Ballroom",
        "capacity": 50,
        "waitlistEnabled": True
    }
    status, _, body = make_http_request("POST", f"{base_url}/api/v1/events", body=event_payload)
    assert_test(status == 201, "Tier 1: Create Event status 201")
    evt = json.loads(body) if status == 201 else {}
    event_id = evt.get("eventId")
    assert_test(bool(event_id), "Tier 1: Event ID created")
    assert_test(evt.get("seatsRemaining") == 50, "Tier 1: Event seatsRemaining initialized")

    # 3. List Events
    status, _, body = make_http_request("GET", f"{base_url}/api/v1/events")
    assert_test(status == 200, "Tier 1: List Events status 200")
    events_list = json.loads(body).get("events", []) if status == 200 else []
    assert_test(any(e.get("eventId") == event_id for e in events_list), "Tier 1: Created event listed in events list")

    # 4. Get Event
    status, _, body = make_http_request("GET", f"{base_url}/api/v1/events/{event_id}")
    assert_test(status == 200, "Tier 1: Get Event status 200")
    evt_get = json.loads(body) if status == 200 else {}
    assert_test(evt_get.get("name") == "Tier 1 Gala", "Tier 1: Get Event details match")

    # 5. Register for Event
    reg_payload = {
        "name": "Alice Johnson",
        "email": "alice.johnson@example.com",
        "idempotencyKey": "key-t1-alice"
    }
    status, _, body = make_http_request("POST", f"{base_url}/api/v1/events/{event_id}/register", body=reg_payload)
    assert_test(status == 201, "Tier 1: Register for Event status 201")
    reg = json.loads(body) if status == 201 else {}
    ticket_id = reg.get("ticketId")
    assert_test(bool(ticket_id), "Tier 1: Ticket ID generated")
    assert_test(reg.get("status") == "registered", "Tier 1: Registration status is registered")

    # 6. Ticket Lookup
    status, _, body = make_http_request("GET", f"{base_url}/api/v1/registrations/{ticket_id}")
    assert_test(status == 200, "Tier 1: Ticket Lookup status 200")
    tkt = json.loads(body) if status == 200 else {}
    assert_test(tkt.get("email") == "alice.johnson@example.com", "Tier 1: Ticket email matches lookup")

    # 7. Check-in Attendee
    checkin_payload = {"ticketId": ticket_id}
    status, _, body = make_http_request("POST", f"{base_url}/api/v1/check-in", body=checkin_payload)
    assert_test(status == 200, "Tier 1: Check-in Attendee status 200")

    # 8. List Check-ins
    status, _, body = make_http_request("GET", f"{base_url}/api/v1/events/{event_id}/check-ins")
    assert_test(status == 200, "Tier 1: List Check-ins status 200")
    chk = json.loads(body) if status == 200 else {}
    assert_test(chk.get("checkedIn") == 1, "Tier 1: Check-ins checkedIn count is 1")
    assert_test(chk.get("total") == 1, "Tier 1: Check-ins total count is 1")

    # 9. List Registrations CSV export
    status, headers, body = make_http_request("GET", f"{base_url}/api/v1/events/{event_id}/registrations?format=csv")
    assert_test(status == 200, "Tier 1: List Registrations CSV status 200")
    content_type = headers.get("Content-Type", headers.get("content-type", ""))
    assert_test("text/csv" in content_type, "Tier 1: Registrations CSV export Content-Type is text/csv")
    assert_test("alice.johnson@example.com" in body, "Tier 1: CSV body contains attendee email")

    # 10. Analytics
    status, _, body = make_http_request("GET", f"{base_url}/api/v1/analytics")
    assert_test(status == 200, "Tier 1: Analytics status 200")
    analytics = json.loads(body) if status == 200 else {}
    assert_test("totalEvents" in analytics, "Tier 1: Analytics contains totalEvents")
    assert_test("attendanceRate" in analytics, "Tier 1: Analytics contains attendanceRate")

    # 11. Cancel Registration
    reg_cancel_payload = {"name": "Bob Cancel", "email": "bob.cancel@example.com", "idempotencyKey": "key-bob-cancel"}
    _, _, cancel_body = make_http_request("POST", f"{base_url}/api/v1/events/{event_id}/register", body=reg_cancel_payload)
    ticket_to_cancel = json.loads(cancel_body).get("ticketId")
    status, _, body = make_http_request("POST", f"{base_url}/api/v1/registrations/{ticket_to_cancel}/cancel")
    assert_test(status == 200, "Tier 1: Cancel Registration status 200")
    status, _, body = make_http_request("GET", f"{base_url}/api/v1/registrations/{ticket_to_cancel}")
    tkt_cancelled = json.loads(body) if status == 200 else {}
    assert_test(tkt_cancelled.get("status") == "cancelled", "Tier 1: Cancelled ticket status verified as cancelled")


def run_tier2_boundary_edge_cases(base_url: str):
    print("\n--- TIER 2: Boundary & Edge Cases ---")

    # 1. Register for non-existent event ID (404 NOT_FOUND)
    status, _, body = make_http_request("POST", f"{base_url}/api/v1/events/non-existent-event-99999/register",
                                          body={"name": "Ghost", "email": "ghost@example.com", "idempotencyKey": "ghost-1"})
    assert_test(status == 404, "Tier 2: Register for non-existent event ID returns 404 NOT_FOUND")
    err_body = json.loads(body) if status == 404 else {}
    assert_test(err_body.get("errorCode") in ["EVENT_NOT_FOUND", "NOT_FOUND"], "Tier 2: Non-existent event error code is NOT_FOUND")

    # Create an event for boundary testing
    status, _, body = make_http_request("POST", f"{base_url}/api/v1/events",
                                          body={"name": "Boundary Summit", "date": "2026-12-01", "venue": "Room 101", "capacity": 1, "waitlistEnabled": True})
    event_id = json.loads(body).get("eventId")

    # 2. Duplicate Registration (409 Conflict)
    status, _, _ = make_http_request("POST", f"{base_url}/api/v1/events/{event_id}/register",
                                      body={"name": "Dup User", "email": "dup@example.com", "idempotencyKey": "dup-1"})
    assert_test(status == 201, "Tier 2: First registration succeeds (201)")
    status, _, body = make_http_request("POST", f"{base_url}/api/v1/events/{event_id}/register",
                                         body={"name": "Dup User", "email": "dup@example.com", "idempotencyKey": "dup-2"})
    assert_test(status == 409, "Tier 2: Duplicate registration returns 409 Conflict")
    assert_test(json.loads(body).get("errorCode") == "DUPLICATE_REGISTRATION", "Tier 2: Error code is DUPLICATE_REGISTRATION")

    # 3. Email Casing Normalization
    status, _, body = make_http_request("POST", f"{base_url}/api/v1/events",
                                          body={"name": "Casing Event", "date": "2026-12-05", "venue": "Room 102", "capacity": 10, "waitlistEnabled": False})
    casing_event_id = json.loads(body).get("eventId")
    status, _, body = make_http_request("POST", f"{base_url}/api/v1/events/{casing_event_id}/register",
                                         body={"name": "Mixed Case", "email": "  USER.CASING@EXAMPLE.COM  ", "idempotencyKey": "case-1"})
    assert_test(status == 201, "Tier 2: Register with mixed case & spaces email succeeds")
    reg_casing = json.loads(body)
    ticket_casing_id = reg_casing.get("ticketId")
    assert_test(reg_casing.get("email") == "user.casing@example.com", "Tier 2: Email normalized to lowercase in registration response")

    status, _, body = make_http_request("GET", f"{base_url}/api/v1/registrations/{ticket_casing_id}")
    tkt_casing = json.loads(body)
    assert_test(tkt_casing.get("email") == "user.casing@example.com", "Tier 2: Ticket lookup email matches normalized email")

    # 4. Zero Remaining Seats & Waitlist Creation vs Event Full
    status, _, body = make_http_request("POST", f"{base_url}/api/v1/events",
                                          body={"name": "Zero Seat Waitlist", "date": "2026-12-10", "venue": "Room 103", "capacity": 1, "waitlistEnabled": True})
    wl_evt_id = json.loads(body).get("eventId")
    make_http_request("POST", f"{base_url}/api/v1/events/{wl_evt_id}/register", body={"name": "Seat 1", "email": "s1@example.com", "idempotencyKey": "s1"})
    status, _, body = make_http_request("POST", f"{base_url}/api/v1/events/{wl_evt_id}/register", body={"name": "Waitlisted User", "email": "wl@example.com", "idempotencyKey": "wl1"})
    assert_test(status == 201, "Tier 2: Registration when event full and waitlist enabled returns 201")
    assert_test(json.loads(body).get("status") == "waitlisted", "Tier 2: Status is waitlisted")

    status, _, body = make_http_request("POST", f"{base_url}/api/v1/events",
                                          body={"name": "No Waitlist Event", "date": "2026-12-12", "venue": "Room 104", "capacity": 1, "waitlistEnabled": False})
    no_wl_evt_id = json.loads(body).get("eventId")
    make_http_request("POST", f"{base_url}/api/v1/events/{no_wl_evt_id}/register", body={"name": "P1", "email": "p1@example.com", "idempotencyKey": "p1"})
    status, _, body = make_http_request("POST", f"{base_url}/api/v1/events/{no_wl_evt_id}/register", body={"name": "P2", "email": "p2@example.com", "idempotencyKey": "p2"})
    assert_test(status == 409, "Tier 2: Registration when full and waitlist disabled returns 409 Conflict")
    assert_test(json.loads(body).get("errorCode") == "EVENT_FULL", "Tier 2: Error code is EVENT_FULL")

    # 5. Duplicate Check-ins (409 Conflict)
    status, _, body = make_http_request("POST", f"{base_url}/api/v1/events",
                                          body={"name": "Checkin Event", "date": "2026-12-15", "venue": "Hall A", "capacity": 5})
    chk_evt_id = json.loads(body).get("eventId")
    _, _, body = make_http_request("POST", f"{base_url}/api/v1/events/{chk_evt_id}/register", body={"name": "Checkin User", "email": "chkuser@example.com", "idempotencyKey": "chk1"})
    chk_ticket_id = json.loads(body).get("ticketId")

    status, _, _ = make_http_request("POST", f"{base_url}/api/v1/check-in", body={"ticketId": chk_ticket_id})
    assert_test(status == 200, "Tier 2: First check-in succeeds with 200 OK")

    status, _, body = make_http_request("POST", f"{base_url}/api/v1/check-in", body={"ticketId": chk_ticket_id})
    assert_test(status == 409, "Tier 2: Duplicate check-in returns 409 Conflict")
    assert_test(json.loads(body).get("errorCode") == "INVALID_TICKET", "Tier 2: Duplicate check-in error code is INVALID_TICKET")


def run_tier3_cross_feature_combinations(base_url: str):
    print("\n--- TIER 3: Cross-Feature Combinations ---")
    status, _, body = make_http_request("POST", f"{base_url}/api/v1/events",
                                          body={"name": "Tier 3 Workshop", "date": "2026-12-20", "venue": "Lab 1", "capacity": 1, "waitlistEnabled": True})
    assert_test(status == 201, "Tier 3: Create event with capacity 1 and waitlist enabled")
    event_id = json.loads(body).get("eventId")

    status, _, body = make_http_request("POST", f"{base_url}/api/v1/events/{event_id}/register",
                                          body={"name": "Attendee 1", "email": "att1@example.com", "idempotencyKey": "t3-key1"})
    assert_test(status == 201, "Tier 3: Attendee 1 registration status 201")
    reg1 = json.loads(body)
    ticket1_id = reg1.get("ticketId")
    assert_test(reg1.get("status") == "registered", "Tier 3: Attendee 1 is registered")

    status, _, body = make_http_request("POST", f"{base_url}/api/v1/events/{event_id}/register",
                                          body={"name": "Attendee 2", "email": "att2@example.com", "idempotencyKey": "t3-key2"})
    assert_test(status == 201, "Tier 3: Attendee 2 registration status 201")
    reg2 = json.loads(body)
    ticket2_id = reg2.get("ticketId")
    assert_test(reg2.get("status") == "waitlisted", "Tier 3: Attendee 2 is waitlisted")

    status, _, body = make_http_request("GET", f"{base_url}/api/v1/registrations/{ticket2_id}")
    assert_test(json.loads(body).get("status") == "waitlisted", "Tier 3: Lookup confirms Attendee 2 status is waitlisted")

    status, _, body = make_http_request("POST", f"{base_url}/api/v1/registrations/{ticket1_id}/cancel")
    assert_test(status == 200, "Tier 3: Cancel Attendee 1 ticket status 200 OK")

    status, _, body = make_http_request("GET", f"{base_url}/api/v1/registrations/{ticket2_id}")
    assert_test(status == 200, "Tier 3: Lookup promoted ticket status 200 OK")
    promoted_tkt = json.loads(body)
    assert_test(promoted_tkt.get("status") == "registered", "Tier 3: Attendee 2 successfully auto-promoted from waitlisted to registered")

    status, _, body = make_http_request("POST", f"{base_url}/api/v1/check-in", body={"ticketId": ticket2_id})
    assert_test(status == 200, "Tier 3: Check-in promoted Attendee 2 status 200 OK")

    status, _, body = make_http_request("GET", f"{base_url}/api/v1/registrations/{ticket2_id}")
    assert_test(json.loads(body).get("status") == "checked_in", "Tier 3: Lookup confirms promoted Attendee 2 status is checked_in")


def run_tier4_real_world_scenario(base_url: str):
    print("\n--- TIER 4: Real-World Application Lifecycle Scenario ---")
    status, _, body = make_http_request("POST", f"{base_url}/api/v1/events", body={
        "name": "Global Tech Summit 2026",
        "date": "2026-12-30",
        "venue": "Convention Center Main Hall",
        "capacity": 2,
        "waitlistEnabled": True
    })
    assert_test(status == 201, "Tier 4: Organizer creates event (2 seats, waitlist enabled)")
    evt = json.loads(body)
    event_id = evt.get("eventId")

    status, _, body = make_http_request("POST", f"{base_url}/api/v1/events/{event_id}/register", body={
        "name": "Attendee A",
        "email": "attendee.a@domain.com",
        "idempotencyKey": "life-a"
    })
    assert_test(status == 201, "Tier 4: Attendee A registers")
    ticket_a = json.loads(body).get("ticketId")

    status, _, body = make_http_request("POST", f"{base_url}/api/v1/events/{event_id}/register", body={
        "name": "Attendee B",
        "email": "attendee.b@domain.com",
        "idempotencyKey": "life-b"
    })
    assert_test(status == 201, "Tier 4: Attendee B registers")
    ticket_b = json.loads(body).get("ticketId")

    status, _, body = make_http_request("POST", f"{base_url}/api/v1/events/{event_id}/register", body={
        "name": "Attendee C",
        "email": "attendee.c@domain.com",
        "idempotencyKey": "life-c"
    })
    assert_test(status == 201, "Tier 4: Attendee C registers after capacity full")
    reg_c = json.loads(body)
    ticket_c = reg_c.get("ticketId")
    assert_test(reg_c.get("status") == "waitlisted", "Tier 4: Attendee C is placed on waitlist")

    status, _, _ = make_http_request("POST", f"{base_url}/api/v1/registrations/{ticket_a}/cancel")
    assert_test(status == 200, "Tier 4: Attendee A cancels ticket")

    status, _, body = make_http_request("GET", f"{base_url}/api/v1/registrations/{ticket_c}")
    assert_test(json.loads(body).get("status") == "registered", "Tier 4: Ticket C auto-promoted to registered")

    status, _, _ = make_http_request("POST", f"{base_url}/api/v1/check-in", body={"ticketId": ticket_b})
    assert_test(status == 200, "Tier 4: Attendee B checks in")

    status, _, _ = make_http_request("POST", f"{base_url}/api/v1/check-in", body={"ticketId": ticket_c})
    assert_test(status == 200, "Tier 4: Attendee C (promoted) checks in")

    status, _, body = make_http_request("GET", f"{base_url}/api/v1/events/{event_id}/check-ins")
    assert_test(status == 200, "Tier 4: Organizer retrieves check-ins list")
    chk_summary = json.loads(body)
    assert_test(chk_summary.get("checkedIn") == 2, "Tier 4: Verified 2 attendees checked in")
    assert_test(chk_summary.get("total") == 3, "Tier 4: Total registration records equals 3")

    status, headers, body = make_http_request("GET", f"{base_url}/api/v1/events/{event_id}/registrations?format=csv")
    assert_test(status == 200 and "text/csv" in headers.get("Content-Type", headers.get("content-type", "")), "Tier 4: Organizer exports registrations CSV")

    status, _, body = make_http_request("GET", f"{base_url}/api/v1/analytics")
    assert_test(status == 200, "Tier 4: Organizer views system analytics")
    analytics = json.loads(body)
    assert_test(analytics.get("totalRegistrations", 0) > 0, "Tier 4: Analytics reflects total registrations")


def main():
    print("================================================================")
    print("  KALUNA PLATFORM - AUTOMATED HTTP E2E TEST RUNNER")
    print("================================================================")

    api_gateway_url = os.environ.get("API_GATEWAY_URL")
    local_server = None
    server_thread = None
    moto_mock = None

    if api_gateway_url:
        target_url = api_gateway_url.rstrip('/')
        print(f"Targeting configured API Gateway URL: {target_url}\n")
    else:
        print("API_GATEWAY_URL is unset. Starting local HTTP API Gateway server with DynamoDB mock storage...")
        sender_email = 'contact@bennyduah.com'
        os.environ['AWS_ACCESS_KEY_ID'] = 'testing'
        os.environ['AWS_SECRET_ACCESS_KEY'] = 'testing'
        os.environ['AWS_SECURITY_TOKEN'] = 'testing'
        os.environ['AWS_SESSION_TOKEN'] = 'testing'
        os.environ['AWS_DEFAULT_REGION'] = 'us-east-1'
        os.environ['TABLE_NAME'] = 'kaluna-dev-table'
        os.environ['SENDER_EMAIL'] = sender_email

        from moto import mock_aws
        import boto3

        moto_mock = mock_aws()
        moto_mock.start()

        # Pre-verify sender email in Moto SES to prevent send_email warnings
        try:
            ses_client = boto3.client('ses', region_name='us-east-1')
            ses_client.verify_email_identity(EmailAddress=sender_email)
        except Exception:
            pass

        # Initialize DynamoDB table in Moto
        db = boto3.client('dynamodb', region_name='us-east-1')
        db.create_table(
            TableName='kaluna-dev-table',
            KeySchema=[
                {'AttributeName': 'PK', 'KeyType': 'HASH'},
                {'AttributeName': 'SK', 'KeyType': 'RANGE'}
            ],
            AttributeDefinitions=[
                {'AttributeName': 'PK', 'AttributeType': 'S'},
                {'AttributeName': 'SK', 'AttributeType': 'S'},
                {'AttributeName': 'GSI1PK', 'AttributeType': 'S'},
                {'AttributeName': 'GSI1SK', 'AttributeType': 'S'}
            ],
            GlobalSecondaryIndexes=[
                {
                    'IndexName': 'GSI1',
                    'KeySchema': [
                        {'AttributeName': 'GSI1PK', 'KeyType': 'HASH'},
                        {'AttributeName': 'GSI1SK', 'KeyType': 'RANGE'}
                    ],
                    'Projection': {'ProjectionType': 'ALL'}
                }
            ],
            BillingMode='PAY_PER_REQUEST'
        )

        load_handlers()

        port = 8080
        try:
            local_server = ThreadingHTTPServer(('127.0.0.1', port), LocalAPIGatewayHandler)
            target_url = f"http://127.0.0.1:{port}"
        except OSError:
            local_server = ThreadingHTTPServer(('127.0.0.1', 0), LocalAPIGatewayHandler)
            actual_port = local_server.server_address[1]
            target_url = f"http://127.0.0.1:{actual_port}"

        server_thread = threading.Thread(target=local_server.serve_forever, daemon=True)
        server_thread.start()
        print(f"Local HTTP API Gateway server listening on {target_url}\n")
        time.sleep(0.5)

    start_time = time.time()

    try:
        run_tier1_feature_coverage(target_url)
        run_tier2_boundary_edge_cases(target_url)
        run_tier3_cross_feature_combinations(target_url)
        run_tier4_real_world_scenario(target_url)
    finally:
        if local_server:
            print("\nShutting down local HTTP server...")
            local_server.shutdown()
            local_server.server_close()
        if moto_mock:
            moto_mock.stop()

    elapsed = time.time() - start_time
    print("\n================================================================")
    print("  E2E TEST RUN SUMMARY")
    print("================================================================")
    print(f"Total Tests Executed : {total_tests_run}")
    print(f"Passed               : {total_tests_passed}")
    print(f"Failed               : {total_tests_failed}")
    print(f"500 Internal Errors  : {server_500_errors_count}")
    print(f"Total Time           : {elapsed:.2f}s")
    print("================================================================")

    if total_tests_failed > 0 or server_500_errors_count > 0:
        print("\n[FAILED] E2E TEST SUITE FAILED!")
        sys.exit(1)
    else:
        print("\n[SUCCESS] ALL E2E TEST SUITES PASSED WITH ZERO 500 INTERNAL SERVER ERRORS!")
        sys.exit(0)


if __name__ == "__main__":
    main()
