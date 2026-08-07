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
def mock_aws_env(aws_credentials):
    """Wrap the entire test in mock_aws so all boto3 calls (including
    module-level ones in app.py) hit the mocked backend."""
    with mock_aws():
        # Force re-import of app module inside the mock context
        service_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
        if service_dir in sys.path:
            sys.path.remove(service_dir)
        sys.path.insert(0, service_dir)
        sys.modules.pop('app', None)
        sys.modules.pop('utils', None)
        yield

@pytest.fixture
def dynamodb_client():
    return boto3.client('dynamodb', region_name='us-east-1')

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



def make_admin_ctx(method: str, path: str):
    return {
        'http': {'method': method, 'path': path},
        'authorizer': {
            'jwt': {
                'claims': {
                    'sub': 'test-admin-id',
                    'cognito:groups': ['Admin']
                }
            }
        }
    }


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
        'requestContext': make_admin_ctx('POST', '/api/v1/events'),
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
        'requestContext': make_admin_ctx('POST', '/api/v1/events'),
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
        'requestContext': make_admin_ctx('POST', '/api/v1/events'),
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


def test_update_event_success(setup_table):
    from app import lambda_handler
    
    create = {
        'requestContext': make_admin_ctx('POST', '/api/v1/events'),
        'body': json.dumps({'name': 'Original Name', 'date': '2024-01-01', 'venue': 'V1', 'capacity': 50})
    }
    resp = lambda_handler(create, None)
    event_id = json.loads(resp['body'])['eventId']
    
    update = {
        'requestContext': make_admin_ctx('PUT', f'/api/v1/events/{event_id}'),
        'pathParameters': {'eventId': event_id},
        'body': json.dumps({'name': 'Updated Name', 'capacity': 100, 'waitlistEnabled': True})
    }
    resp2 = lambda_handler(update, None)
    assert resp2['statusCode'] == 200
    body2 = json.loads(resp2['body'])
    assert body2['name'] == 'Updated Name'
    assert body2['capacity'] == 100
    assert body2['waitlistEnabled'] == True


def test_create_event_with_image_url(setup_table):
    from app import lambda_handler

    image_url = 'https://images.unsplash.com/photo-123?w=1200'
    create = {
        'requestContext': make_admin_ctx('POST', '/api/v1/events'),
        'body': json.dumps({
            'name': 'Imaged Event',
            'date': '2024-01-01',
            'venue': 'V',
            'capacity': 10,
            'imageUrl': image_url
        })
    }
    resp = lambda_handler(create, None)
    assert resp['statusCode'] == 201
    body = json.loads(resp['body'])
    assert body['imageUrl'] == image_url

    event_id = body['eventId']
    get = {
        'requestContext': {'http': {'method': 'GET', 'path': f'/api/v1/events/{event_id}'}},
        'pathParameters': {'eventId': event_id}
    }
    assert json.loads(lambda_handler(get, None)['body'])['imageUrl'] == image_url


def test_create_event_rejects_invalid_image_url(setup_table):
    from app import lambda_handler
    create = {
        'requestContext': make_admin_ctx('POST', '/api/v1/events'),
        'body': json.dumps({
            'name': 'Bad Image',
            'date': '2024-01-01',
            'venue': 'V',
            'capacity': 10,
            'imageUrl': 'javascript:alert(1)'
        })
    }
    resp = lambda_handler(create, None)
    assert resp['statusCode'] == 400
    assert json.loads(resp['body'])['errorCode'] == 'BAD_REQUEST'


def test_update_event_image_url(setup_table):
    from app import lambda_handler
    create = {
        'requestContext': make_admin_ctx('POST', '/api/v1/events'),
        'body': json.dumps({'name': 'Event', 'date': '2024-01-01', 'venue': 'V', 'capacity': 10})
    }
    event_id = json.loads(lambda_handler(create, None)['body'])['eventId']

    image_url = 'https://cdn.example.com/banner.png'
    update = {
        'requestContext': make_admin_ctx('PUT', f'/api/v1/events/{event_id}'),
        'pathParameters': {'eventId': event_id},
        'body': json.dumps({'imageUrl': image_url})
    }
    resp = lambda_handler(update, None)
    assert resp['statusCode'] == 200
    assert json.loads(resp['body'])['imageUrl'] == image_url

    clear = {
        'requestContext': make_admin_ctx('PUT', f'/api/v1/events/{event_id}'),
        'pathParameters': {'eventId': event_id},
        'body': json.dumps({'imageUrl': ''})
    }
    resp2 = lambda_handler(clear, None)
    assert resp2['statusCode'] == 200
    assert json.loads(resp2['body'])['imageUrl'] == ''


def test_update_event_not_found(setup_table):
    from app import lambda_handler
    update = {
        'requestContext': make_admin_ctx('PUT', '/api/v1/events/nonexistent'),
        'pathParameters': {'eventId': 'nonexistent'},
        'body': json.dumps({'name': 'New Name'})
    }
    resp = lambda_handler(update, None)
    assert resp['statusCode'] == 404
    body = json.loads(resp['body'])
    assert body['errorCode'] == 'NOT_FOUND'


def test_update_event_invalid_input(setup_table):
    from app import lambda_handler
    create = {
        'requestContext': make_admin_ctx('POST', '/api/v1/events'),
        'body': json.dumps({'name': 'Event', 'date': '2024-01-01', 'venue': 'V', 'capacity': 10})
    }
    resp = lambda_handler(create, None)
    event_id = json.loads(resp['body'])['eventId']

    update = {
        'requestContext': make_admin_ctx('PUT', f'/api/v1/events/{event_id}'),
        'pathParameters': {'eventId': event_id},
        'body': json.dumps({'capacity': 'not-a-number'})
    }
    resp2 = lambda_handler(update, None)
    assert resp2['statusCode'] == 400


def test_delete_event(setup_table):
    from app import lambda_handler
    
    create = {
        'requestContext': make_admin_ctx('POST', '/api/v1/events'),
        'body': json.dumps({'name': 'To Delete', 'date': '2024-01-01', 'venue': 'V', 'capacity': 10})
    }
    resp = lambda_handler(create, None)
    event_id = json.loads(resp['body'])['eventId']
    
    delete = {
        'requestContext': make_admin_ctx('DELETE', f'/api/v1/events/{event_id}'),
        'pathParameters': {'eventId': event_id}
    }
    resp2 = lambda_handler(delete, None)
    assert resp2['statusCode'] == 204
    
    get = {
        'requestContext': {'http': {'method': 'GET', 'path': f'/api/v1/events/{event_id}'}},
        'pathParameters': {'eventId': event_id}
    }
    resp3 = lambda_handler(get, None)
    assert resp3['statusCode'] == 404


def test_list_events(setup_table):
    from app import lambda_handler
    
    for i in range(2):
        create = {
            'requestContext': make_admin_ctx('POST', '/api/v1/events'),
            'body': json.dumps({'name': f'Event {i}', 'date': '2024-01-01', 'venue': 'V', 'capacity': 10})
        }
        lambda_handler(create, None)
    
    list_event = {
        'requestContext': make_admin_ctx('GET', '/api/v1/events')
    }
    resp = lambda_handler(list_event, None)
    assert resp['statusCode'] == 200
    body = json.loads(resp['body'])
    assert len(body['events']) == 2


def test_list_events_pagination(setup_table, dynamodb_client, table_name):
    from app import lambda_handler
    
    for i in range(5):
        dynamodb_client.put_item(
            TableName=table_name,
            Item={
                'PK': {'S': f'EVENT#evt_{i}'},
                'SK': {'S': 'METADATA'},
                'eventId': {'S': f'evt_{i}'},
                'name': {'S': f'Event {i}'},
                'status': {'S': 'available'}
            }
        )
        dynamodb_client.put_item(
            TableName=table_name,
            Item={
                'PK': {'S': f'EVENT#evt_{i}'},
                'SK': {'S': f'AUDIT#2024-01-01T00:00:0{i}Z'},
                'action': {'S': 'EVENT_CREATED'}
            }
        )

    list_req = {
        'requestContext': {'http': {'method': 'GET', 'path': '/api/v1/events'}},
        'queryStringParameters': {'limit': '2'}
    }
    resp = lambda_handler(list_req, None)
    assert resp['statusCode'] == 200
    body = json.loads(resp['body'])
    assert len(body['events']) == 2
    assert 'nextCursor' in body

    cursor = body['nextCursor']
    list_req2 = {
        'requestContext': {'http': {'method': 'GET', 'path': '/api/v1/events'}},
        'queryStringParameters': {'limit': '3', 'cursor': cursor}
    }
    resp2 = lambda_handler(list_req2, None)
    assert resp2['statusCode'] == 200
    body2 = json.loads(resp2['body'])
    assert len(body2['events']) == 3


def test_get_analytics(setup_table, dynamodb_client, table_name):
    from app import lambda_handler
    
    dynamodb_client.put_item(
        TableName=table_name,
        Item={
            'PK': {'S': 'EVENT#evt1'},
            'SK': {'S': 'METADATA'},
            'eventId': {'S': 'evt1'},
            'status': {'S': 'available'}
        }
    )
    dynamodb_client.put_item(
        TableName=table_name,
        Item={
            'PK': {'S': 'EVENT#evt1'},
            'SK': {'S': 'REG#user1@example.com'},
            'status': {'S': 'registered'}
        }
    )
    dynamodb_client.put_item(
        TableName=table_name,
        Item={
            'PK': {'S': 'EVENT#evt1'},
            'SK': {'S': 'REG#user2@example.com'},
            'status': {'S': 'checked_in'}
        }
    )
    
    req = {
        'requestContext': {'http': {'method': 'GET', 'path': '/api/v1/analytics'}}
    }
    resp = lambda_handler(req, None)
    assert resp['statusCode'] == 200
    body = json.loads(resp['body'])
    assert body['totalEvents'] == 1
    assert body['upcomingEvents'] == 1
    assert body['totalRegistrations'] == 2
    assert body['attendanceRate'] == 50.0


def test_route_not_found(setup_table):
    from app import lambda_handler
    event = {
        'requestContext': {'http': {'method': 'GET', 'path': '/api/v1/nonexistent'}}
    }
    resp = lambda_handler(event, None)
    assert resp['statusCode'] == 404


def test_list_event_registrations_route_precedence(setup_table, dynamodb_client):
    from app import lambda_handler
    table_name = os.environ['TABLE_NAME']
    dynamodb_client.put_item(
        TableName=table_name,
        Item={
            'PK': {'S': 'EVENT#evt123'},
            'SK': {'S': 'REG#reg456'},
            'ticketId': {'S': 'tkt789'},
            'name': {'S': 'Jane Doe'},
            'email': {'S': 'jane@example.com'},
            'status': {'S': 'registered'}
        }
    )
    
    event_req = {
        'requestContext': {'http': {'method': 'GET', 'path': '/api/v1/events/evt123/registrations'}},
        'pathParameters': {'eventId': 'evt123'}
    }
    resp = lambda_handler(event_req, None)
    assert resp['statusCode'] == 200
    body = json.loads(resp['body'])
    assert isinstance(body, list)
    assert len(body) == 1
    assert body[0]['name'] == 'Jane Doe'
    assert body[0]['ticketId'] == 'tkt789'


def test_list_event_registrations_csv_format(setup_table, dynamodb_client):
    from app import lambda_handler
    table_name = os.environ['TABLE_NAME']
    dynamodb_client.put_item(
        TableName=table_name,
        Item={
            'PK': {'S': 'EVENT#evt123'},
            'SK': {'S': 'REG#reg456'},
            'ticketId': {'S': 'tkt789'},
            'name': {'S': 'Jane Doe'},
            'email': {'S': 'jane@example.com'},
            'status': {'S': 'registered'}
        }
    )
    
    event_req = {
        'requestContext': {'http': {'method': 'GET', 'path': '/api/v1/events/evt123/registrations'}},
        'pathParameters': {'eventId': 'evt123'},
        'queryStringParameters': {'format': 'csv'}
    }
    resp = lambda_handler(event_req, None)
    assert resp['statusCode'] == 200
    assert resp['headers']['Content-Type'] == 'text/csv'
    assert 'attachment; filename="event_evt123_registrations.csv"' in resp['headers']['Content-Disposition']
    assert 'Jane Doe' in resp['body']
