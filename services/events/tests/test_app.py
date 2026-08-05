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
    os.environ['AWS_DEFAULT_REGION'] = 'eu-west-1'

@pytest.fixture
def dynamodb_client(aws_credentials):
    with mock_dynamodb():
        conn = boto3.client("dynamodb", region_name="eu-west-1")
        yield conn

@pytest.fixture
def table_name():
    return "eventflow-dev-table"

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
        ],
        BillingMode='PAY_PER_REQUEST'
    )
    os.environ['TABLE_NAME'] = table_name

def test_create_and_get_event(setup_table):
    from app import lambda_handler

    # 1. Create Event
    create_event = {
        "requestContext": {"http": {"method": "POST", "path": "/events"}},
        "body": json.dumps({
            "name": "Test Event",
            "date": "2024-01-01",
            "venue": "Test Venue",
            "capacity": 100
        })
    }
    
    response = lambda_handler(create_event, None)
    assert response["statusCode"] == 201
    body = json.loads(response["body"])
    event_id = body["eventId"]
    assert body["name"] == "Test Event"

    # 2. Get Event
    get_event = {
        "requestContext": {"http": {"method": "GET", "path": f"/events/{event_id}"}},
        "pathParameters": {"eventId": event_id}
    }
    
    response2 = lambda_handler(get_event, None)
    assert response2["statusCode"] == 200
    body2 = json.loads(response2["body"])
    assert body2["eventId"] == event_id
    assert body2["capacity"] == 100
