import os
import json
import pytest
import boto3
from moto import mock_dynamodb

@pytest.fixture
def aws_credentials():
    os.environ['AWS_ACCESS_KEY_ID'] = 'testing'
    os.environ['AWS_SECRET_ACCESS_KEY'] = 'testing'
    os.environ['AWS_SECURITY_TOKEN'] = 'testing'
    os.environ['AWS_SESSION_TOKEN'] = 'testing'
    os.environ['AWS_DEFAULT_REGION'] = 'us-east-1'

@pytest.fixture
def dynamodb_client(aws_credentials):
    with mock_dynamodb():
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


def test_health_endpoint(setup_table):
    from app import lambda_handler
    event = {'requestContext': {'http': {'method': 'GET', 'path': '/api/v1/health'}}}
    response = lambda_handler(event, None)
    assert response['statusCode'] == 200
    body = json.loads(response['body'])
    assert body['status'] == 'healthy'
    assert 'version' in body
    assert 'timestamp' in body


def test_create_and_get_event(setup_table):
    from app import lambda_handler
    
    create_event = {
        'requestContext': {'http': {'method': 'POST', 'path': '/api/v1/events'}},
        'body': json.dumps({
            'name': 'Test Event',
            'date': '2024-01-01',
            'venue': 'Test Venue',
            'capacity': 100
        })
    }
    
    response = lambda_handler(create_event, None)
    assert response['statusCode'] == 201
    body = json.loads(response['body'])
    event_id = body['eventId']
    assert body['name'] == 'Test Event'
    assert body['status'] == 'available'
    
    get_event = {
        'requestContext': {'http': {'method': 'GET', 'path': f'/api/v1/events/{event_id}'}},
        'pathParameters': {'eventId': event_id}
    }
    
    response2 = lambda_handler(get_event, None)
    assert response2['statusCode'] == 200
    body2 = json.loads(response2['body'])
    assert body2['eventId'] == event_id
    assert body2['capacity'] == 100


def test_create_event_missing_fields(setup_table):
    from app import lambda_handler
    event = {
        'requestContext': {'http': {'method': 'POST', 'path': '/api/v1/events'}},
        'body': json.dumps({'name': 'Incomplete Event'})
    }
    response = lambda_handler(event, None)
    assert response['statusCode'] == 400
    body = json.loads(response['body'])
    assert body['success'] == False
    assert body['errorCode'] == 'BAD_REQUEST'


def test_create_event_invalid_capacity(setup_table):
    from app import lambda_handler
    event = {
        'requestContext': {'http': {'method': 'POST', 'path': '/api/v1/events'}},
        'body': json.dumps({'name': 'Bad Event', 'date': '2024-01-01', 'venue': 'V', 'capacity': -5})
    }
    response = lambda_handler(event, None)
    assert response['statusCode'] == 400


def test_get_event_not_found(setup_table):
    from app import lambda_handler
    event = {
        'requestContext': {'http': {'method': 'GET', 'path': '/api/v1/events/nonexistent'}},
        'pathParameters': {'eventId': 'nonexistent'}
    }
    response = lambda_handler(event, None)
    assert response['statusCode'] == 404
    body = json.loads(response['body'])
    assert body['errorCode'] == 'NOT_FOUND'


def test_delete_event(setup_table):
    from app import lambda_handler
    
    # Create first
    create = {
        'requestContext': {'http': {'method': 'POST', 'path': '/api/v1/events'}},
        'body': json.dumps({'name': 'To Delete', 'date': '2024-01-01', 'venue': 'V', 'capacity': 10})
    }
    resp = lambda_handler(create, None)
    event_id = json.loads(resp['body'])['eventId']
    
    # Delete
    delete = {
        'requestContext': {'http': {'method': 'DELETE', 'path': f'/api/v1/events/{event_id}'}},
        'pathParameters': {'eventId': event_id}
    }
    resp2 = lambda_handler(delete, None)
    assert resp2['statusCode'] == 204
    
    # Verify gone
    get = {
        'requestContext': {'http': {'method': 'GET', 'path': f'/api/v1/events/{event_id}'}},
        'pathParameters': {'eventId': event_id}
    }
    resp3 = lambda_handler(get, None)
    assert resp3['statusCode'] == 404


def test_list_events(setup_table):
    from app import lambda_handler
    
    # Create two events
    for i in range(2):
        create = {
            'requestContext': {'http': {'method': 'POST', 'path': '/api/v1/events'}},
            'body': json.dumps({'name': f'Event {i}', 'date': '2024-01-01', 'venue': 'V', 'capacity': 10})
        }
        lambda_handler(create, None)
    
    # List
    list_event = {
        'requestContext': {'http': {'method': 'GET', 'path': '/api/v1/events'}}
    }
    resp = lambda_handler(list_event, None)
    assert resp['statusCode'] == 200
    body = json.loads(resp['body'])
    assert len(body['events']) == 2


def test_route_not_found(setup_table):
    from app import lambda_handler
    event = {
        'requestContext': {'http': {'method': 'GET', 'path': '/api/v1/nonexistent'}}
    }
    resp = lambda_handler(event, None)
    assert resp['statusCode'] == 404
