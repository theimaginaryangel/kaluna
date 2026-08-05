import os
import sys
import json
import pytest
import boto3
from moto import mock_aws

@pytest.fixture
def aws_credentials():
    os.environ['AWS_ACCESS_KEY_ID'] = 'testing'
    os.environ['AWS_SECRET_ACCESS_KEY'] = 'testing'
    os.environ['AWS_SECURITY_TOKEN'] = 'testing'
    os.environ['AWS_SESSION_TOKEN'] = 'testing'
    os.environ['AWS_DEFAULT_REGION'] = 'us-east-1'

@pytest.fixture(autouse=True)
def prepare_environment(aws_credentials):
    service_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    if service_dir in sys.path:
        sys.path.remove(service_dir)
    sys.path.insert(0, service_dir)
    sys.modules.pop('app', None)
    sys.modules.pop('utils', None)

@pytest.fixture
def dynamodb_client(aws_credentials):
    with mock_aws():
        conn = boto3.client('dynamodb', region_name='us-east-1')
        yield conn

@pytest.fixture
def table_name():
    return 'kaluna-dev-table'

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


def _seed_event(dynamodb_client, table_name, event_id='123', seats=10, waitlist_enabled=False):
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


def test_register_success(setup_table, dynamodb_client, table_name):
    from app import lambda_handler
    _seed_event(dynamodb_client, table_name)
    
    event = {
        'requestContext': {'http': {'method': 'POST', 'path': '/api/v1/events/123/register'}},
        'pathParameters': {'eventId': '123'},
        'body': json.dumps({'name': 'Jane Doe', 'email': 'jane@example.com', 'idempotencyKey': 'key-1'})
    }
    
    response = lambda_handler(event, None)
    assert response['statusCode'] == 201
    body = json.loads(response['body'])
    assert body['status'] == 'registered'
    assert 'ticketId' in body
    
    result = dynamodb_client.get_item(
        TableName=table_name,
        Key={'PK': {'S': 'EVENT#123'}, 'SK': {'S': 'METADATA'}}
    )
    assert result['Item']['seatsRemaining']['N'] == '9'


def test_register_missing_fields(setup_table, dynamodb_client, table_name):
    from app import lambda_handler
    _seed_event(dynamodb_client, table_name)
    
    event = {
        'requestContext': {'http': {'method': 'POST', 'path': '/api/v1/events/123/register'}},
        'pathParameters': {'eventId': '123'},
        'body': json.dumps({'name': 'Jane'})
    }
    response = lambda_handler(event, None)
    assert response['statusCode'] == 400
    body = json.loads(response['body'])
    assert body['errorCode'] == 'BAD_REQUEST'


def test_register_invalid_email(setup_table, dynamodb_client, table_name):
    from app import lambda_handler
    _seed_event(dynamodb_client, table_name)
    
    event = {
        'requestContext': {'http': {'method': 'POST', 'path': '/api/v1/events/123/register'}},
        'pathParameters': {'eventId': '123'},
        'body': json.dumps({'name': 'Jane', 'email': 'not-an-email', 'idempotencyKey': 'key-1'})
    }
    response = lambda_handler(event, None)
    assert response['statusCode'] == 400
    body = json.loads(response['body'])
    assert body['errorCode'] == 'BAD_REQUEST'


def test_register_event_full(setup_table, dynamodb_client, table_name):
    from app import lambda_handler
    _seed_event(dynamodb_client, table_name, seats=0)
    
    event = {
        'requestContext': {'http': {'method': 'POST', 'path': '/api/v1/events/123/register'}},
        'pathParameters': {'eventId': '123'},
        'body': json.dumps({'name': 'Jane', 'email': 'jane@example.com', 'idempotencyKey': 'key-1'})
    }
    response = lambda_handler(event, None)
    assert response['statusCode'] == 409
    body = json.loads(response['body'])
    assert body['errorCode'] == 'EVENT_FULL'


def test_register_duplicate(setup_table, dynamodb_client, table_name):
    from app import lambda_handler
    _seed_event(dynamodb_client, table_name)
    
    reg_event = {
        'requestContext': {'http': {'method': 'POST', 'path': '/api/v1/events/123/register'}},
        'pathParameters': {'eventId': '123'},
        'body': json.dumps({'name': 'Jane', 'email': 'jane@example.com', 'idempotencyKey': 'key-1'})
    }
    lambda_handler(reg_event, None)
    
    response = lambda_handler(reg_event, None)
    assert response['statusCode'] == 409
    body = json.loads(response['body'])
    assert body['errorCode'] == 'DUPLICATE_REGISTRATION'


def test_register_nonexistent_event(setup_table):
    from app import lambda_handler
    event = {
        'requestContext': {'http': {'method': 'POST', 'path': '/api/v1/events/nonexistent-999/register'}},
        'pathParameters': {'eventId': 'nonexistent-999'},
        'body': json.dumps({'name': 'Jane', 'email': 'jane@example.com', 'idempotencyKey': 'key-1'})
    }
    response = lambda_handler(event, None)
    assert response['statusCode'] == 404
    body = json.loads(response['body'])
    assert body['errorCode'] == 'EVENT_NOT_FOUND'


def test_register_email_casing_normalization(setup_table, dynamodb_client, table_name):
    from app import lambda_handler
    _seed_event(dynamodb_client, table_name, event_id='evt_case')
    
    event = {
        'requestContext': {'http': {'method': 'POST', 'path': '/api/v1/events/evt_case/register'}},
        'pathParameters': {'eventId': 'evt_case'},
        'body': json.dumps({'name': 'Alice Smith', 'email': '  ALICE.SMITH@EXAMPLE.COM  ', 'idempotencyKey': 'key-case'})
    }
    
    resp = lambda_handler(event, None)
    assert resp['statusCode'] == 201
    body = json.loads(resp['body'])
    assert body['email'] == 'alice.smith@example.com'
    
    item = dynamodb_client.get_item(
        TableName=table_name,
        Key={'PK': {'S': 'EVENT#evt_case'}, 'SK': {'S': 'REG#alice.smith@example.com'}}
    )
    assert 'Item' in item
    assert item['Item']['email']['S'] == 'alice.smith@example.com'


def test_ticket_lookup(setup_table, dynamodb_client, table_name):
    from app import lambda_handler
    _seed_event(dynamodb_client, table_name)
    
    reg = {
        'requestContext': {'http': {'method': 'POST', 'path': '/api/v1/events/123/register'}},
        'pathParameters': {'eventId': '123'},
        'body': json.dumps({'name': 'Jane', 'email': 'jane@example.com', 'idempotencyKey': 'key-1'})
    }
    resp = lambda_handler(reg, None)
    ticket_id = json.loads(resp['body'])['ticketId']
    
    lookup = {
        'requestContext': {'http': {'method': 'GET', 'path': f'/api/v1/registrations/{ticket_id}'}},
        'pathParameters': {'ticketId': ticket_id}
    }
    resp2 = lambda_handler(lookup, None)
    assert resp2['statusCode'] == 200
    body = json.loads(resp2['body'])
    assert body['ticketId'] == ticket_id


def test_cancel_registered_ticket(setup_table, dynamodb_client, table_name):
    from app import lambda_handler
    _seed_event(dynamodb_client, table_name, seats=10)
    
    reg = {
        'requestContext': {'http': {'method': 'POST', 'path': '/api/v1/events/123/register'}},
        'pathParameters': {'eventId': '123'},
        'body': json.dumps({'name': 'Bob', 'email': 'bob@example.com', 'idempotencyKey': 'key-bob'})
    }
    resp = lambda_handler(reg, None)
    ticket_id = json.loads(resp['body'])['ticketId']
    
    cancel = {
        'requestContext': {'http': {'method': 'POST', 'path': f'/api/v1/registrations/{ticket_id}/cancel'}},
        'pathParameters': {'ticketId': ticket_id}
    }
    resp_c = lambda_handler(cancel, None)
    assert resp_c['statusCode'] == 200
    
    evt_item = dynamodb_client.get_item(
        TableName=table_name,
        Key={'PK': {'S': 'EVENT#123'}, 'SK': {'S': 'METADATA'}}
    )
    assert evt_item['Item']['seatsRemaining']['N'] == '10'


def test_cancel_waitlisted_ticket(setup_table, dynamodb_client, table_name):
    from app import lambda_handler
    _seed_event(dynamodb_client, table_name, seats=0, waitlist_enabled=True)
    
    reg = {
        'requestContext': {'http': {'method': 'POST', 'path': '/api/v1/events/123/register'}},
        'pathParameters': {'eventId': '123'},
        'body': json.dumps({'name': 'Charlie', 'email': 'charlie@example.com', 'idempotencyKey': 'key-c'})
    }
    resp = lambda_handler(reg, None)
    ticket_id = json.loads(resp['body'])['ticketId']
    assert json.loads(resp['body'])['status'] == 'waitlisted'
    
    cancel = {
        'requestContext': {'http': {'method': 'POST', 'path': f'/api/v1/registrations/{ticket_id}/cancel'}},
        'pathParameters': {'ticketId': ticket_id}
    }
    resp_c = lambda_handler(cancel, None)
    assert resp_c['statusCode'] == 200
    
    evt_item = dynamodb_client.get_item(
        TableName=table_name,
        Key={'PK': {'S': 'EVENT#123'}, 'SK': {'S': 'METADATA'}}
    )
    assert evt_item['Item']['seatsRemaining']['N'] == '0'


def test_cancel_registered_ticket_with_waitlist_promotion(setup_table, dynamodb_client, table_name):
    from app import lambda_handler
    _seed_event(dynamodb_client, table_name, seats=1, waitlist_enabled=True)
    
    reg1 = {
        'requestContext': {'http': {'method': 'POST', 'path': '/api/v1/events/123/register'}},
        'pathParameters': {'eventId': '123'},
        'body': json.dumps({'name': 'User 1', 'email': 'user1@example.com', 'idempotencyKey': 'k1'})
    }
    resp1 = lambda_handler(reg1, None)
    ticket1_id = json.loads(resp1['body'])['ticketId']
    assert json.loads(resp1['body'])['status'] == 'registered'
    
    reg2 = {
        'requestContext': {'http': {'method': 'POST', 'path': '/api/v1/events/123/register'}},
        'pathParameters': {'eventId': '123'},
        'body': json.dumps({'name': 'User 2', 'email': 'user2@example.com', 'idempotencyKey': 'k2'})
    }
    resp2 = lambda_handler(reg2, None)
    ticket2_id = json.loads(resp2['body'])['ticketId']
    assert json.loads(resp2['body'])['status'] == 'waitlisted'
    
    cancel1 = {
        'requestContext': {'http': {'method': 'POST', 'path': f'/api/v1/registrations/{ticket1_id}/cancel'}},
        'pathParameters': {'ticketId': ticket1_id}
    }
    resp_c = lambda_handler(cancel1, None)
    assert resp_c['statusCode'] == 200
    
    lookup2 = {
        'requestContext': {'http': {'method': 'GET', 'path': f'/api/v1/registrations/{ticket2_id}'}},
        'pathParameters': {'ticketId': ticket2_id}
    }
    resp_l2 = lambda_handler(lookup2, None)
    assert resp_l2['statusCode'] == 200
    assert json.loads(resp_l2['body'])['status'] == 'registered'
