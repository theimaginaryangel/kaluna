import json
import os
import uuid
import time
from datetime import datetime
import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError
from utils import format_error, build_response, log_event

dynamodb = boto3.resource('dynamodb')
ses = boto3.client('ses', region_name=os.environ.get('AWS_DEFAULT_REGION', 'eu-west-1'))
table_name = os.environ.get('TABLE_NAME', 'kaluna-dev-table')
sender_email = os.environ.get('SENDER_EMAIL', 'contact@bennyduah.com')
table = dynamodb.Table(table_name)

def lambda_handler(event, context):
    start_time = time.time()
    request_id = event.get('requestContext', {}).get('requestId', 'unknown-request')
    http_method = event.get('requestContext', {}).get('http', {}).get('method', '')
    path = event.get('requestContext', {}).get('http', {}).get('path', '')
    
    if not http_method:
        http_method = event.get('httpMethod', '')
    if not path:
        path = event.get('path', '')
        
    path_parameters = event.get('pathParameters') or {}
    
    action = f"{http_method} {path}"
    
    try:
        # POST /events/{eventId}/register
        if http_method == 'POST' and path.startswith('/events/') and path.endswith('/register'):
            event_id = path_parameters.get('eventId')
            body = json.loads(event.get('body', '{}'))
            response = register(event_id, body)
            log_event(request_id, event_id, "register", start_time, "success" if response['statusCode'] == 201 else f"failed:{response['statusCode']}")
            return response
            
        # GET /registrations/{ticketId}
        elif http_method == 'GET' and path.startswith('/registrations/'):
            ticket_id = path_parameters.get('ticketId')
            response = get_registration(ticket_id)
            log_event(request_id, "N/A", "get_registration", start_time, "success" if response['statusCode'] == 200 else f"failed:{response['statusCode']}")
            return response
            
        # POST /registrations/{ticketId}/cancel
        elif http_method == 'POST' and path.startswith('/registrations/') and path.endswith('/cancel'):
            ticket_id = path_parameters.get('ticketId')
            response = cancel_registration(ticket_id)
            log_event(request_id, "N/A", "cancel_registration", start_time, "success" if response['statusCode'] == 200 else f"failed:{response['statusCode']}")
            return response
            
        log_event(request_id, "N/A", action, start_time, "error")
        return build_response(404, format_error("Route not found", "NOT_FOUND"))
        
    except Exception as e:
        log_event(request_id, "N/A", action, start_time, f"error: {str(e)}")
        return build_response(500, format_error("Internal server error", "INTERNAL_ERROR"))


def register(event_id, body):
    required_fields = ['name', 'email', 'idempotencyKey']
    for field in required_fields:
        if field not in body:
            return build_response(400, format_error(f"Missing required field: {field}", "BAD_REQUEST"))
            
    email = body['email']
    name = body['name']
    
    registration_id = str(uuid.uuid4())
    ticket_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat() + 'Z'
    
    reg_pk = f"EVENT#{event_id}"
    reg_sk = f"REG#{email}"
    
    reg_item = {
        'PK': reg_pk,
        'SK': reg_sk,
        'registrationId': registration_id,
        'ticketId': ticket_id,
        'eventId': event_id,
        'name': name,
        'email': email,
        'status': 'registered',
        'registeredAt': now,
        'GSI1PK': f"TICKET#{ticket_id}",
        'GSI1SK': "METADATA"
    }
    
    audit_item = {
        'PK': f"EVENT#{event_id}",
        'SK': f"AUDIT#{now}",
        'action': "REGISTRATION_CREATED",
        'actor': email,
        'details': f"Ticket {ticket_id} registered"
    }
    
    try:
        dynamodb.meta.client.transact_write_items(
            TransactItems=[
                {
                    'Update': {
                        'TableName': table_name,
                        'Key': {
                            'PK': f"EVENT#{event_id}",
                            'SK': "METADATA"
                        },
                        'UpdateExpression': "SET seatsRemaining = seatsRemaining - :one",
                        'ConditionExpression': "seatsRemaining > :zero",
                        'ExpressionAttributeValues': {
                            ':one': 1,
                            ':zero': 0
                        }
                    }
                },
                {
                    'Put': {
                        'TableName': table_name,
                        'Item': reg_item,
                        'ConditionExpression': "attribute_not_exists(SK)"
                    }
                },
                {
                    'Put': {
                        'TableName': table_name,
                        'Item': audit_item
                    }
                }
            ]
        )
    except ClientError as e:
        error_code = e.response.get('Error', {}).get('Code')
        if error_code == 'TransactionCanceledException':
            reasons = e.response.get('CancellationReasons', [])
            if len(reasons) > 0 and reasons[0].get('Code') == 'ConditionalCheckFailed':
                return build_response(409, format_error("Event is full", "EVENT_FULL"))
            if len(reasons) > 1 and reasons[1].get('Code') == 'ConditionalCheckFailed':
                return build_response(409, format_error("Already registered", "DUPLICATE_REGISTRATION"))
                
        return build_response(500, format_error(f"Transaction failed: {str(e)}", "INTERNAL_ERROR"))
        
    # Send SES Email asynchronously (best effort in this handler)
    try:
        qr_url = f"https://api.qrserver.com/v1/create-qr-code/?size=250x250&data={ticket_id}"
        html_body = f\"\"\"
        <html>
        <body>
            <h1>Registration Confirmed!</h1>
            <p>Hi {name},</p>
            <p>You have successfully registered for the event.</p>
            <p>Your Ticket ID is: <strong>{ticket_id}</strong></p>
            <p>Please present the QR code below at check-in:</p>
            <img src="{qr_url}" alt="Ticket QR Code" />
        </body>
        </html>
        \"\"\"
        
        ses.send_email(
            Source=sender_email,
            Destination={'ToAddresses': [email]},
            Message={
                'Subject': {'Data': 'Your Event Registration Ticket'},
                'Body': {'Html': {'Data': html_body}}
            }
        )
    except Exception as e:
        print(f"Failed to send email: {e}") # Log it, but don't fail the registration
        
    return build_response(201, clean_item(reg_item))


def get_registration(ticket_id):
    response = table.query(
        IndexName='GSI1',
        KeyConditionExpression=Key('GSI1PK').eq(f"TICKET#{ticket_id}")
    )
    
    items = response.get('Items', [])
    if not items:
        return build_response(404, format_error("Ticket not found", "NOT_FOUND"))
        
    return build_response(200, clean_item(items[0]))


def cancel_registration(ticket_id):
    # 1. Look up the ticket
    response = table.query(
        IndexName='GSI1',
        KeyConditionExpression=Key('GSI1PK').eq(f"TICKET#{ticket_id}")
    )
    
    items = response.get('Items', [])
    if not items:
        return build_response(404, format_error("Ticket not found", "NOT_FOUND"))
        
    reg_item = items[0]
    if reg_item.get('status') == 'cancelled':
        return build_response(200, {"message": "Already cancelled"})
        
    event_id = reg_item['eventId']
    email = reg_item['email']
    now = datetime.utcnow().isoformat() + 'Z'
    
    audit_item = {
        'PK': f"EVENT#{event_id}",
        'SK': f"AUDIT#{now}",
        'action': "REGISTRATION_CANCELLED",
        'actor': email,
        'details': f"Ticket {ticket_id} cancelled"
    }
    
    # 2. Update registration status and increment seats
    try:
        dynamodb.meta.client.transact_write_items(
            TransactItems=[
                {
                    'Update': {
                        'TableName': table_name,
                        'Key': {
                            'PK': reg_item['PK'],
                            'SK': reg_item['SK']
                        },
                        'UpdateExpression': "SET #s = :cancelled",
                        'ExpressionAttributeNames': {'#s': 'status'},
                        'ExpressionAttributeValues': {':cancelled': 'cancelled'}
                    }
                },
                {
                    'Update': {
                        'TableName': table_name,
                        'Key': {
                            'PK': f"EVENT#{event_id}",
                            'SK': "METADATA"
                        },
                        'UpdateExpression': "SET seatsRemaining = seatsRemaining + :one",
                        'ExpressionAttributeValues': {
                            ':one': 1
                        }
                    }
                },
                {
                    'Put': {
                        'TableName': table_name,
                        'Item': audit_item
                    }
                }
            ]
        )
    except ClientError as e:
        return build_response(500, format_error(f"Transaction failed: {str(e)}", "INTERNAL_ERROR"))
        
    return build_response(200, {"message": "Cancelled successfully, seat released"})

def clean_item(item):
    cleaned = item.copy()
    cleaned.pop('PK', None)
    cleaned.pop('SK', None)
    cleaned.pop('GSI1PK', None)
    cleaned.pop('GSI1SK', None)
    return cleaned
