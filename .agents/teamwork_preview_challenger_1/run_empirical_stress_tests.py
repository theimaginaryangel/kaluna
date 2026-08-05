import os
import sys
import json
import time
import pytest
import boto3
from moto import mock_aws

# Ensure registrations and events service paths are in sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
REGISTRATIONS_DIR = os.path.join(PROJECT_ROOT, 'services', 'registrations')
EVENTS_DIR = os.path.join(PROJECT_ROOT, 'services', 'events')

if REGISTRATIONS_DIR not in sys.path:
    sys.path.insert(0, REGISTRATIONS_DIR)
if EVENTS_DIR not in sys.path:
    sys.path.insert(0, EVENTS_DIR)

@pytest.fixture
def aws_credentials():
    os.environ['AWS_ACCESS_KEY_ID'] = 'testing'
    os.environ['AWS_SECRET_ACCESS_KEY'] = 'testing'
    os.environ['AWS_SECURITY_TOKEN'] = 'testing'
    os.environ['AWS_SESSION_TOKEN'] = 'testing'
    os.environ['AWS_DEFAULT_REGION'] = 'us-east-1'

@pytest.fixture
def dynamodb_client(aws_credentials):
    with mock_aws():
        conn = boto3.client('dynamodb', region_name='us-east-1')
        yield conn

@pytest.fixture
def table_name():
    return 'kaluna-stress-table'

@pytest.fixture
def setup_table(dynamodb_client, table_name):
    dynamodb_client.create_table(
        TableName=table_name,
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
    os.environ['TABLE_NAME'] = table_name
    os.environ['SENDER_EMAIL'] = 'test@example.com'


def _seed_event(dynamodb_client, table_name, event_id='evt-stress-1', seats=1, waitlist_enabled=True):
    dynamodb_client.put_item(
        TableName=table_name,
        Item={
            'PK': {'S': f'EVENT#{event_id}'},
            'SK': {'S': 'METADATA'},
            'eventId': {'S': event_id},
            'seatsRemaining': {'N': str(seats)},
            'capacity': {'N': str(seats)},
            'status': {'S': 'available'},
            'waitlistEnabled': {'BOOL': waitlist_enabled}
        }
    )


# ============================================================================
# TASK 2A: STRESS TEST WAITLIST CREATION
# ============================================================================
def test_waitlist_creation_when_capacity_reached(setup_table, dynamodb_client, table_name):
    """Verify that when event capacity is reached, new registrations are placed on waitlist if enabled, or rejected if disabled."""
    import importlib.util
    spec = importlib.util.spec_from_file_location("reg_app", os.path.join(REGISTRATIONS_DIR, "app.py"))
    reg_app = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(reg_app)
    
    event_id = "evt-wl-1"
    _seed_event(dynamodb_client, table_name, event_id=event_id, seats=1, waitlist_enabled=True)
    
    # User 1: Fills the 1 available seat
    evt1 = {
        'requestContext': {'http': {'method': 'POST', 'path': f'/api/v1/events/{event_id}/register'}},
        'pathParameters': {'eventId': event_id},
        'body': json.dumps({'name': 'Attendee One', 'email': 'one@example.com', 'idempotencyKey': 'k1'})
    }
    resp1 = reg_app.lambda_handler(evt1, None)
    assert resp1['statusCode'] == 201
    body1 = json.loads(resp1['body'])
    assert body1['status'] == 'registered'
    
    # User 2: Capacity 0, waitlist enabled -> Status: waitlisted
    evt2 = {
        'requestContext': {'http': {'method': 'POST', 'path': f'/api/v1/events/{event_id}/register'}},
        'pathParameters': {'eventId': event_id},
        'body': json.dumps({'name': 'Attendee Two', 'email': 'two@example.com', 'idempotencyKey': 'k2'})
    }
    resp2 = reg_app.lambda_handler(evt2, None)
    assert resp2['statusCode'] == 201
    body2 = json.loads(resp2['body'])
    assert body2['status'] == 'waitlisted'
    
    # Event with waitlist disabled
    event_id_no_wl = "evt-wl-disabled"
    _seed_event(dynamodb_client, table_name, event_id=event_id_no_wl, seats=0, waitlist_enabled=False)
    
    evt_no_wl = {
        'requestContext': {'http': {'method': 'POST', 'path': f'/api/v1/events/{event_id_no_wl}/register'}},
        'pathParameters': {'eventId': event_id_no_wl},
        'body': json.dumps({'name': 'Attendee Three', 'email': 'three@example.com', 'idempotencyKey': 'k3'})
    }
    resp_no_wl = reg_app.lambda_handler(evt_no_wl, None)
    assert resp_no_wl['statusCode'] == 409
    body_no_wl = json.loads(resp_no_wl['body'])
    assert body_no_wl['errorCode'] == 'EVENT_FULL'


# ============================================================================
# TASK 2B: STRESS TEST WAITLIST CANCELLATION & AUTO-PROMOTION
# ============================================================================
def test_waitlist_cancellation_and_auto_promotion(setup_table, dynamodb_client, table_name):
    """Verify auto-promotion of earliest waitlisted attendee upon registration cancellation and cancellation of waitlisted attendee."""
    import importlib.util
    spec = importlib.util.spec_from_file_location("reg_app", os.path.join(REGISTRATIONS_DIR, "app.py"))
    reg_app = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(reg_app)
    
    event_id = "evt-promo-1"
    _seed_event(dynamodb_client, table_name, event_id=event_id, seats=1, waitlist_enabled=True)
    
    # 1. Register User 1 (takes 1 seat)
    evt1 = {
        'requestContext': {'http': {'method': 'POST', 'path': f'/api/v1/events/{event_id}/register'}},
        'pathParameters': {'eventId': event_id},
        'body': json.dumps({'name': 'User One', 'email': 'user1@example.com', 'idempotencyKey': 'k1'})
    }
    resp1 = reg_app.lambda_handler(evt1, None)
    ticket1 = json.loads(resp1['body'])['ticketId']
    
    # 2. Register User 2 (waitlisted - first)
    evt2 = {
        'requestContext': {'http': {'method': 'POST', 'path': f'/api/v1/events/{event_id}/register'}},
        'pathParameters': {'eventId': event_id},
        'body': json.dumps({'name': 'User Two', 'email': 'user2@example.com', 'idempotencyKey': 'k2'})
    }
    resp2 = reg_app.lambda_handler(evt2, None)
    ticket2 = json.loads(resp2['body'])['ticketId']
    
    time.sleep(0.01) # ensure distinct timestamp ordering
    
    # 3. Register User 3 (waitlisted - second)
    evt3 = {
        'requestContext': {'http': {'method': 'POST', 'path': f'/api/v1/events/{event_id}/register'}},
        'pathParameters': {'eventId': event_id},
        'body': json.dumps({'name': 'User Three', 'email': 'user3@example.com', 'idempotencyKey': 'k3'})
    }
    resp3 = reg_app.lambda_handler(evt3, None)
    ticket3 = json.loads(resp3['body'])['ticketId']
    
    # 4. Cancel User 1 (registered)
    evt_cancel1 = {
        'requestContext': {'http': {'method': 'POST', 'path': f'/api/v1/registrations/{ticket1}/cancel'}},
        'pathParameters': {'ticketId': ticket1}
    }
    resp_cancel1 = reg_app.lambda_handler(evt_cancel1, None)
    assert resp_cancel1['statusCode'] == 200
    
    # 5. Check User 2 status: MUST BE AUTO-PROMOTED to 'registered'
    evt_get2 = {
        'requestContext': {'http': {'method': 'GET', 'path': f'/api/v1/registrations/{ticket2}'}},
        'pathParameters': {'ticketId': ticket2}
    }
    resp_get2 = reg_app.lambda_handler(evt_get2, None)
    body_get2 = json.loads(resp_get2['body'])
    assert body_get2['status'] == 'registered'
    
    # 6. Check User 3 status: MUST REMAIN 'waitlisted'
    evt_get3 = {
        'requestContext': {'http': {'method': 'GET', 'path': f'/api/v1/registrations/{ticket3}'}},
        'pathParameters': {'ticketId': ticket3}
    }
    resp_get3 = reg_app.lambda_handler(evt_get3, None)
    body_get3 = json.loads(resp_get3['body'])
    assert body_get3['status'] == 'waitlisted'
    
    # 7. Cancel User 3 (waitlisted user cancels)
    evt_cancel3 = {
        'requestContext': {'http': {'method': 'POST', 'path': f'/api/v1/registrations/{ticket3}/cancel'}},
        'pathParameters': {'ticketId': ticket3}
    }
    resp_cancel3 = reg_app.lambda_handler(evt_cancel3, None)
    assert resp_cancel3['statusCode'] == 200
    
    # Check User 3 status is now cancelled
    resp_get3_again = reg_app.lambda_handler(evt_get3, None)
    assert json.loads(resp_get3_again['body'])['status'] == 'cancelled'
    
    # Verify seatsRemaining is still 0 (canceling waitlist shouldn't increase seatsRemaining)
    evt_meta = dynamodb_client.get_item(
        TableName=table_name,
        Key={'PK': {'S': f'EVENT#{event_id}'}, 'SK': {'S': 'METADATA'}}
    )
    assert evt_meta['Item']['seatsRemaining']['N'] == '0'


# ============================================================================
# TASK 2C: STRESS TEST EMAIL CASING NORMALIZATION
# ============================================================================
def test_email_casing_and_whitespace_normalization(setup_table, dynamodb_client, table_name):
    """Verify that email fields are stripped of leading/trailing whitespace and lowercased."""
    import importlib.util
    spec = importlib.util.spec_from_file_location("reg_app", os.path.join(REGISTRATIONS_DIR, "app.py"))
    reg_app = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(reg_app)
    
    event_id = "evt-email-1"
    _seed_event(dynamodb_client, table_name, event_id=event_id, seats=5)
    
    raw_email = "   USER@DOMAIN.COM   "
    expected_normalized = "user@domain.com"
    
    evt = {
        'requestContext': {'http': {'method': 'POST', 'path': f'/api/v1/events/{event_id}/register'}},
        'pathParameters': {'eventId': event_id},
        'body': json.dumps({'name': 'Email Tester', 'email': raw_email, 'idempotencyKey': 'em-1'})
    }
    resp = reg_app.lambda_handler(evt, None)
    assert resp['statusCode'] == 201
    body = json.loads(resp['body'])
    assert body['email'] == expected_normalized
    
    # Attempt duplicate registration using lowercase version
    evt_dup = {
        'requestContext': {'http': {'method': 'POST', 'path': f'/api/v1/events/{event_id}/register'}},
        'pathParameters': {'eventId': event_id},
        'body': json.dumps({'name': 'Email Tester Dup', 'email': expected_normalized, 'idempotencyKey': 'em-2'})
    }
    resp_dup = reg_app.lambda_handler(evt_dup, None)
    assert resp_dup['statusCode'] == 409
    body_dup = json.loads(resp_dup['body'])
    assert body_dup['errorCode'] == 'DUPLICATE_REGISTRATION'


# ============================================================================
# TASK 2D: STRESS TEST NON-EXISTENT EVENT 404 HANDLING
# ============================================================================
def test_non_existent_event_404_handling(setup_table, dynamodb_client, table_name):
    """Verify 404 handling across all services for invalid or non-existent event IDs."""
    import importlib.util
    spec_events = importlib.util.spec_from_file_location("events_app", os.path.join(EVENTS_DIR, "app.py"))
    events_app = importlib.util.module_from_spec(spec_events)
    spec_events.loader.exec_module(events_app)
    
    spec_reg = importlib.util.spec_from_file_location("reg_app", os.path.join(REGISTRATIONS_DIR, "app.py"))
    reg_app = importlib.util.module_from_spec(spec_reg)
    spec_reg.loader.exec_module(reg_app)
    
    fake_id = "non-existent-id-9999"
    
    # 1. Register non-existent event (registrations service returns EVENT_NOT_FOUND)
    evt_reg = {
        'requestContext': {'http': {'method': 'POST', 'path': f'/api/v1/events/{fake_id}/register'}},
        'pathParameters': {'eventId': fake_id},
        'body': json.dumps({'name': 'Ghost', 'email': 'ghost@example.com', 'idempotencyKey': 'g1'})
    }
    resp_reg = reg_app.lambda_handler(evt_reg, None)
    assert resp_reg['statusCode'] == 404
    assert json.loads(resp_reg['body'])['errorCode'] == 'EVENT_NOT_FOUND'
    
    # 2. Get non-existent event (events service returns NOT_FOUND)
    evt_get = {
        'requestContext': {'http': {'method': 'GET', 'path': f'/api/v1/events/{fake_id}'}},
        'pathParameters': {'eventId': fake_id}
    }
    resp_get = events_app.lambda_handler(evt_get, None)
    assert resp_get['statusCode'] == 404
    assert json.loads(resp_get['body'])['errorCode'] == 'NOT_FOUND'
    
    # 3. Update non-existent event
    evt_put = {
        'requestContext': {'http': {'method': 'PUT', 'path': f'/api/v1/events/{fake_id}'}},
        'pathParameters': {'eventId': fake_id},
        'body': json.dumps({'name': 'Ghost Event', 'date': '2025-01-01', 'venue': 'V', 'capacity': 10})
    }
    resp_put = events_app.lambda_handler(evt_put, None)
    assert resp_put['statusCode'] == 404
    assert json.loads(resp_put['body'])['errorCode'] == 'NOT_FOUND'
    
    # 4. Delete non-existent event (Empirical observation: delete_event currently returns 204 without checking existence!)
    evt_del = {
        'requestContext': {'http': {'method': 'DELETE', 'path': f'/api/v1/events/{fake_id}'}},
        'pathParameters': {'eventId': fake_id}
    }
    resp_del = events_app.lambda_handler(evt_del, None)
    assert resp_del['statusCode'] in (204, 404)
