import os
import time
import json
import base64
import hmac
import hashlib

JWT_SECRET = os.environ.get('JWT_SECRET', 'kaluna-super-secret-key').encode('utf-8')

def base64url_decode(data: str) -> bytes:
    padding = '=' * (4 - (len(data) % 4))
    return base64.urlsafe_b64decode(data + padding)

def lambda_handler(event, context):
    headers = event.get('headers', {})
    # API gateway usually lowercases headers, but get both just in case
    auth_header = headers.get('authorization') or headers.get('Authorization')
    
    if not auth_header or not auth_header.lower().startswith('bearer '):
        return {"isAuthorized": False}
        
    token = auth_header[7:].strip()
    
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return {"isAuthorized": False}
            
        header_b64, payload_b64, signature_b64 = parts
        
        signature_base = f"{header_b64}.{payload_b64}"
        expected_signature = hmac.new(JWT_SECRET, signature_base.encode('utf-8'), hashlib.sha256).digest()
        
        signature = base64url_decode(signature_b64)
        
        if not hmac.compare_digest(expected_signature, signature):
            return {"isAuthorized": False}
            
        payload = json.loads(base64url_decode(payload_b64).decode('utf-8'))
        
        if 'exp' in payload and payload['exp'] < int(time.time()):
            return {"isAuthorized": False}
            
        groups = payload.get('cognito:groups', [])
        groups_str = ','.join(groups) if isinstance(groups, list) else str(groups)
            
        return {
            "isAuthorized": True,
            "context": {
                "sub": payload.get('sub', ''),
                "cognito:groups": groups_str
            }
        }
    except Exception as e:
        print(f"Authorizer error: {str(e)}")
        return {"isAuthorized": False}
