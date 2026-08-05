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
    return "kaluna-dev-table"

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

def test_register_success(setup_table, dynamodb_client, table_name):
    from app import lambda_handler

    # Create event manually
    dynamodb_client.put_item(
        TableName=table_name,
        Item={
            'PK': {'S': 'EVENT#123'},
            'SK': {'S': 'METADATA'},
            'seatsRemaining': {'N': '10'},
            'capacity': {'N': '10'}
        }
    )

    # 1. Register
    register_event = {
        "requestContext": {"http": {"method": "POST", "path": "/events/123/register"}},
        "pathParameters": {"eventId": "123"},
        "body": json.dumps({
            "name": "Jane Doe",
            "email": "jane@example.com",
            "idempotencyKey": "key-1"
        })
    }
    
    response = lambda_handler(register_event, None)
    assert response["statusCode"] == 201
    body = json.loads(response["body"])
    assert body["status"] == "registered"
    assert "ticketId" in body
    
    # Check decrement
    result = dynamodb_client.get_item(
        TableName=table_name,
        Key={'PK': {'S': 'EVENT#123'}, 'SK': {'S': 'METADATA'}}
    )
    assert result['Item']['seatsRemaining']['N'] == '9'
