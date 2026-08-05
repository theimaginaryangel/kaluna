import os
import sys
import json
import pytest
import boto3
from datetime import datetime, timedelta
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
def ses_client(aws_credentials):
    with mock_aws():
        conn = boto3.client('ses', region_name='us-east-1')
        conn.verify_email_identity(EmailAddress=os.environ.get('SENDER_EMAIL', 'contact@bennyduah.com'))
        yield conn

@pytest.fixture
def table_name():
    return 'kaluna-dev-table'

@pytest.fixture
def setup_table(dynamodb_client, ses_client, table_name):
    dynamodb_client.create_table(
        TableName=table_name,
        KeySchema=[
            {'AttributeName': 'PK', 'KeyType': 'HASH'},
            {'AttributeName': 'SK', 'KeyType': 'RANGE'}
        ],
        AttributeDefinitions=[
            {'AttributeName': 'PK', 'AttributeType': 'S'},
            {'AttributeName': 'SK', 'AttributeType': 'S'}
        ],
        BillingMode='PAY_PER_REQUEST'
    )
    os.environ['TABLE_NAME'] = table_name
    os.environ['SENDER_EMAIL'] = 'contact@bennyduah.com'


def test_reminders_lambda_success(setup_table, dynamodb_client, table_name):
    from app import lambda_handler
    
    tomorrow = (datetime.utcnow() + timedelta(days=1)).strftime('%Y-%m-%d')
    event_id = 'evt_tomorrow'
    
    dynamodb_client.put_item(
        TableName=table_name,
        Item={
            'PK': {'S': f'EVENT#{event_id}'},
            'SK': {'S': 'METADATA'},
            'eventId': {'S': event_id},
            'name': {'S': 'Upcoming Event'},
            'date': {'S': tomorrow},
            'venue': {'S': 'Main Hall'}
        }
    )
    
    dynamodb_client.put_item(
        TableName=table_name,
        Item={
            'PK': {'S': f'EVENT#{event_id}'},
            'SK': {'S': 'REG#attendee@example.com'},
            'eventId': {'S': event_id},
            'name': {'S': 'Attendee One'},
            'email': {'S': 'attendee@example.com'},
            'ticketId': {'S': 'ticket_123'},
            'status': {'S': 'registered'}
        }
    )
    
    response = lambda_handler({}, None)
    assert response['statusCode'] == 200
    assert 'Sent 1 reminders.' in json.loads(response['body'])


def test_reminders_lambda_no_events_tomorrow(setup_table, dynamodb_client, table_name):
    from app import lambda_handler
    
    yesterday = (datetime.utcnow() - timedelta(days=1)).strftime('%Y-%m-%d')
    event_id = 'evt_past'
    
    dynamodb_client.put_item(
        TableName=table_name,
        Item={
            'PK': {'S': f'EVENT#{event_id}'},
            'SK': {'S': 'METADATA'},
            'eventId': {'S': event_id},
            'name': {'S': 'Past Event'},
            'date': {'S': yesterday}
        }
    )
    
    response = lambda_handler({}, None)
    assert response['statusCode'] == 200
    assert 'Sent 0 reminders.' in json.loads(response['body'])
