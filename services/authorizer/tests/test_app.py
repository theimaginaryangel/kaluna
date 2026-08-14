import os
import sys
import json
import pytest
import time
import base64
import hmac
import hashlib

@pytest.fixture(autouse=True)
def setup_env():
    os.environ['JWT_SECRET'] = 'test-secret'
    # Ensure module reloads to pick up env var
    service_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    if service_dir in sys.path:
        sys.path.remove(service_dir)
    sys.path.insert(0, service_dir)
    sys.modules.pop('app', None)
    yield

def generate_test_jwt(payload_overrides=None):
    secret = b'test-secret'
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": "test@example.com",
        "cognito:groups": ["Creator"],
        "iat": int(time.time()),
        "exp": int(time.time()) + 3600
    }
    if payload_overrides:
        payload.update(payload_overrides)
        
    def b64url(d):
        return base64.urlsafe_b64encode(json.dumps(d, separators=(',', ':')).encode()).rstrip(b'=').decode()
        
    sig_base = f"{b64url(header)}.{b64url(payload)}"
    sig = base64.urlsafe_b64encode(hmac.new(secret, sig_base.encode(), hashlib.sha256).digest()).rstrip(b'=').decode()
    return f"{sig_base}.{sig}"

def test_authorizer_valid_token():
    from app import lambda_handler
    token = generate_test_jwt()
    event = {'headers': {'authorization': f'Bearer {token}'}}
    
    res = lambda_handler(event, None)
    assert res['isAuthorized'] is True
    assert res['context']['sub'] == 'test@example.com'
    assert res['context']['cognito:groups'] == 'Creator'

def test_authorizer_missing_header():
    from app import lambda_handler
    res = lambda_handler({}, None)
    assert res['isAuthorized'] is False

def test_authorizer_invalid_signature():
    from app import lambda_handler
    token = generate_test_jwt()
    # tampered signature
    event = {'headers': {'authorization': f'Bearer {token}bad'}}
    res = lambda_handler(event, None)
    assert res['isAuthorized'] is False

def test_authorizer_expired_token():
    from app import lambda_handler
    token = generate_test_jwt({"exp": int(time.time()) - 100})
    event = {'headers': {'authorization': f'Bearer {token}'}}
    res = lambda_handler(event, None)
    assert res['isAuthorized'] is False
