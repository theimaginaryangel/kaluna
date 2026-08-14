import json
import os
import time
import base64
import hmac
import hashlib
import boto3
from botocore.exceptions import ClientError

dynamodb = boto3.resource('dynamodb')
table_name = os.environ.get('TABLE_NAME', 'kaluna-dev-table')
table = dynamodb.Table(table_name)

# Secret used to sign JWTs. In a real app, use AWS Secrets Manager.
# For simplicity, we can use an environment variable JWT_SECRET.
JWT_SECRET = os.environ.get('JWT_SECRET', 'kaluna-super-secret-key').encode('utf-8')

def build_response(status_code: int, body: dict):
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps(body)
    }

def format_error(message: str, code: str = 'INTERNAL_ERROR'):
    return {'success': False, 'message': message, 'errorCode': code}

def hash_password(password: str, salt: bytes = None) -> (str, str):
    """Hashes a password using PBKDF2 HMAC SHA256. Returns (hash_hex, salt_hex)"""
    if salt is None:
        salt = os.urandom(16)
    hash_val = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
    return hash_val.hex(), salt.hex()

def verify_password(password: str, hash_hex: str, salt_hex: str) -> bool:
    """Verifies a password against a stored hash and salt."""
    salt = bytes.fromhex(salt_hex)
    expected_hash, _ = hash_password(password, salt)
    return hmac.compare_digest(expected_hash, hash_hex)

def base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('utf-8')

def generate_jwt(email: str, role: str) -> str:
    """Generates a custom JWT mimicking Cognito claims."""
    header = {"alg": "HS256", "typ": "JWT"}
    now = int(time.time())
    payload = {
        "sub": email,
        "cognito:groups": [role],
        "iat": now,
        "exp": now + 86400  # 24 hours
    }
    
    encoded_header = base64url_encode(json.dumps(header, separators=(',', ':')).encode('utf-8'))
    encoded_payload = base64url_encode(json.dumps(payload, separators=(',', ':')).encode('utf-8'))
    
    signature_base = f"{encoded_header}.{encoded_payload}"
    signature = hmac.new(JWT_SECRET, signature_base.encode('utf-8'), hashlib.sha256).digest()
    encoded_signature = base64url_encode(signature)
    
    return f"{signature_base}.{encoded_signature}"

def register(body: dict):
    email = body.get('email', '').strip().lower()
    password = body.get('password')
    name = body.get('name', '').strip()
    role = body.get('role', 'Creator')  # default to Creator
    
    if not email or not password or not name:
        return build_response(400, format_error('Missing required fields', 'BAD_REQUEST'))
    
    if role not in ['Creator', 'Admin']:
        return build_response(400, format_error('Invalid role', 'BAD_REQUEST'))
        
    hash_hex, salt_hex = hash_password(password)
    
    try:
        table.put_item(
            Item={
                'PK': f"USER#{email}",
                'SK': "METADATA",
                'email': email,
                'name': name,
                'role': role,
                'passwordHash': hash_hex,
                'passwordSalt': salt_hex,
                'createdAt': int(time.time())
            },
            ConditionExpression='attribute_not_exists(PK)'
        )
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return build_response(409, format_error('User already exists', 'CONFLICT'))
        raise
        
    return build_response(201, {'success': True, 'email': email, 'role': role})

def login(body: dict):
    email = body.get('email', '').strip().lower()
    password = body.get('password')
    
    if not email or not password:
        return build_response(400, format_error('Missing required fields', 'BAD_REQUEST'))
        
    res = table.get_item(
        Key={'PK': f"USER#{email}", 'SK': "METADATA"}
    )
    
    user = res.get('Item')
    if not user:
        # Prevent timing attacks by hashing something anyway (optional but good practice)
        hash_password("dummy", os.urandom(16))
        return build_response(401, format_error('Invalid email or password', 'UNAUTHORIZED'))
        
    if not verify_password(password, user['passwordHash'], user['passwordSalt']):
        return build_response(401, format_error('Invalid email or password', 'UNAUTHORIZED'))
        
    token = generate_jwt(user['email'], user['role'])
    
    return build_response(200, {
        'success': True,
        'token': token,
        'user': {
            'email': user['email'],
            'name': user['name'],
            'role': user['role']
        }
    })

def lambda_handler(event, context):
    http_method = event.get('requestContext', {}).get('http', {}).get('method', '')
    path = event.get('requestContext', {}).get('http', {}).get('path', '')
    
    try:
        body = json.loads(event.get('body', '{}')) if event.get('body') else {}
        
        if path == '/api/v1/auth/register' and http_method == 'POST':
            return register(body)
            
        elif path == '/api/v1/auth/login' and http_method == 'POST':
            return login(body)
            
        else:
            return build_response(404, format_error('Route not found', 'NOT_FOUND'))
            
    except json.JSONDecodeError:
        return build_response(400, format_error('Invalid JSON payload', 'BAD_REQUEST'))
    except Exception as e:
        print(f"Error: {str(e)}")
        return build_response(500, format_error('Internal server error', 'INTERNAL_ERROR'))
