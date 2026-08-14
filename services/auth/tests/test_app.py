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
    with mock_aws():
        service_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
        if service_dir in sys.path:
            sys.path.remove(service_dir)
        sys.path.insert(0, service_dir)
        sys.modules.pop('app', None)
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
            {'AttributeName': 'SK', 'AttributeType': 'S'}
        ],
        BillingMode='PAY_PER_REQUEST'
    )
    os.environ['TABLE_NAME'] = table_name

def test_register_success(setup_table):
    from app import lambda_handler
    
    event = {
        'requestContext': {'http': {'method': 'POST', 'path': '/api/v1/auth/register'}},
        'body': json.dumps({
            'email': 'test@example.com',
            'password': 'password123',
            'name': 'Test User',
            'role': 'Creator'
        })
    }
    
    response = lambda_handler(event, None)
    assert response['statusCode'] == 201
    body = json.loads(response['body'])
    assert body['success'] is True
    assert body['email'] == 'test@example.com'
    assert body['role'] == 'Creator'

def test_register_duplicate(setup_table):
    from app import lambda_handler
    
    event = {
        'requestContext': {'http': {'method': 'POST', 'path': '/api/v1/auth/register'}},
        'body': json.dumps({
            'email': 'test@example.com',
            'password': 'password123',
            'name': 'Test User'
        })
    }
    
    lambda_handler(event, None) # First register
    response = lambda_handler(event, None) # Duplicate register
    
    assert response['statusCode'] == 409
    body = json.loads(response['body'])
    assert body['success'] is False
    assert body['errorCode'] == 'CONFLICT'

def test_login_success(setup_table):
    from app import lambda_handler
    
    register_event = {
        'requestContext': {'http': {'method': 'POST', 'path': '/api/v1/auth/register'}},
        'body': json.dumps({
            'email': 'login@example.com',
            'password': 'password123',
            'name': 'Login User'
        })
    }
    lambda_handler(register_event, None)
    
    login_event = {
        'requestContext': {'http': {'method': 'POST', 'path': '/api/v1/auth/login'}},
        'body': json.dumps({
            'email': 'login@example.com',
            'password': 'password123'
        })
    }
    response = lambda_handler(login_event, None)
    
    assert response['statusCode'] == 200
    body = json.loads(response['body'])
    assert body['success'] is True
    assert 'token' in body
    assert body['user']['email'] == 'login@example.com'

def test_login_invalid_password(setup_table):
    from app import lambda_handler
    
    register_event = {
        'requestContext': {'http': {'method': 'POST', 'path': '/api/v1/auth/register'}},
        'body': json.dumps({
            'email': 'login2@example.com',
            'password': 'password123',
            'name': 'Login User'
        })
    }
    lambda_handler(register_event, None)
    
    login_event = {
        'requestContext': {'http': {'method': 'POST', 'path': '/api/v1/auth/login'}},
        'body': json.dumps({
            'email': 'login2@example.com',
            'password': 'wrongpassword'
        })
    }
    response = lambda_handler(login_event, None)
    
    assert response['statusCode'] == 401
    body = json.loads(response['body'])
    assert body['success'] is False
    assert body['errorCode'] == 'UNAUTHORIZED'
