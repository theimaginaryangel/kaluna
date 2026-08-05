import json
import os
import uuid
import time
from datetime import datetime
import boto3
from boto3.dynamodb.conditions import Key, Attr
from utils import format_error, build_response, log_event

dynamodb = boto3.resource('dynamodb')
table_name = os.environ.get('TABLE_NAME', 'eventflow-dev-table')
table = dynamodb.Table(table_name)

def lambda_handler(event, context):
    start_time = time.time()
    request_id = event.get('requestContext', {}).get('requestId', 'unknown-request')
    http_method = event.get('requestContext', {}).get('http', {}).get('method', '')
    path = event.get('requestContext', {}).get('http', {}).get('path', '')
    
    # Fallback to older API Gateway payload format if HTTP API context is missing
    if not http_method:
        http_method = event.get('httpMethod', '')
    if not path:
        path = event.get('path', '')
        
    path_parameters = event.get('pathParameters') or {}
    event_id = path_parameters.get('eventId')
    
    action = f"{http_method} {path}"
    
    try:
        if path == '/events' and http_method == 'GET':
            response = list_events(event)
            log_event(request_id, "N/A", "list_events", start_time, "success")
            return response
            
        elif path == '/events' and http_method == 'POST':
            body = json.loads(event.get('body', '{}'))
            response, new_event_id = create_event(body)
            log_event(request_id, new_event_id, "create_event", start_time, "success")
            return response
            
        elif path.startswith('/events/') and event_id:
            if http_method == 'GET':
                response = get_event(event_id)
                log_event(request_id, event_id, "get_event", start_time, "success")
                return response
                
            elif http_method == 'PUT':
                body = json.loads(event.get('body', '{}'))
                response = update_event(event_id, body)
                log_event(request_id, event_id, "update_event", start_time, "success")
                return response
                
            elif http_method == 'DELETE':
                response = delete_event(event_id)
                log_event(request_id, event_id, "delete_event", start_time, "success")
                return response
                
        # Route not found
        log_event(request_id, event_id or "N/A", action, start_time, "error")
        return build_response(404, format_error("Route not found", "NOT_FOUND"))
        
    except Exception as e:
        log_event(request_id, event_id or "N/A", action, start_time, f"error: {str(e)}")
        return build_response(500, format_error("Internal server error", "INTERNAL_ERROR"))


def list_events(event):
    # As per docs, single table without explicit GSI for all events
    # We scan for SK = METADATA. (In production with many events, we'd add a GSI)
    # Openapi specifies status, limit, cursor
    query_params = event.get('queryStringParameters') or {}
    status_filter = query_params.get('status')
    limit = int(query_params.get('limit', '20'))
    
    scan_kwargs = {
        'FilterExpression': Attr('SK').eq('METADATA'),
        'Limit': limit
    }
    
    if status_filter:
        scan_kwargs['FilterExpression'] &= Attr('status').eq(status_filter)
        
    response = table.scan(**scan_kwargs)
    items = response.get('Items', [])
    
    # Strip PK and SK from response
    events = []
    for item in items:
        events.append(clean_item(item))
        
    return build_response(200, events)


def create_event(body):
    required_fields = ['name', 'date', 'venue', 'capacity']
    for field in required_fields:
        if field not in body:
            return build_response(400, format_error(f"Missing required field: {field}", "BAD_REQUEST")), "N/A"
            
    event_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat() + 'Z'
    
    item = {
        'PK': f"EVENT#{event_id}",
        'SK': "METADATA",
        'eventId': event_id,
        'name': body['name'],
        'date': body['date'],
        'venue': body['venue'],
        'capacity': int(body['capacity']),
        'seatsRemaining': int(body['capacity']),
        'status': 'available',
        'createdAt': now
    }
    
    # Write audit log and event in a transaction
    audit_item = {
        'PK': f"EVENT#{event_id}",
        'SK': f"AUDIT#{now}",
        'action': "EVENT_CREATED",
        'actor': "admin",
        'details': "Event created"
    }
    
    dynamodb.meta.client.transact_write_items(
        TransactItems=[
            {
                'Put': {
                    'TableName': table_name,
                    'Item': item
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
    
    return build_response(201, clean_item(item)), event_id


def get_event(event_id):
    response = table.get_item(
        Key={
            'PK': f"EVENT#{event_id}",
            'SK': "METADATA"
        }
    )
    
    item = response.get('Item')
    if not item:
        return build_response(404, format_error("Event not found", "NOT_FOUND"))
        
    return build_response(200, clean_item(item))


def update_event(event_id, body):
    # First get the event to make sure it exists
    get_res = table.get_item(Key={'PK': f"EVENT#{event_id}", 'SK': "METADATA"})
    if 'Item' not in get_res:
        return build_response(404, format_error("Event not found", "NOT_FOUND"))
        
    update_expr = "SET "
    expr_attr_values = {}
    expr_attr_names = {}
    
    updatable_fields = ['name', 'date', 'venue', 'capacity']
    updates = []
    
    for field in updatable_fields:
        if field in body:
            updates.append(f"#{field} = :{field}")
            expr_attr_values[f":{field}"] = body[field]
            expr_attr_names[f"#{field}"] = field
            
    if not updates:
        return build_response(400, format_error("No fields to update", "BAD_REQUEST"))
        
    update_expr += ", ".join(updates)
    
    now = datetime.utcnow().isoformat() + 'Z'
    audit_item = {
        'PK': f"EVENT#{event_id}",
        'SK': f"AUDIT#{now}",
        'action': "EVENT_UPDATED",
        'actor': "admin",
        'details': json.dumps({k: v for k, v in body.items() if k in updatable_fields})
    }
    
    # Use transact to update event and write audit log
    dynamodb.meta.client.transact_write_items(
        TransactItems=[
            {
                'Update': {
                    'TableName': table_name,
                    'Key': {
                        'PK': f"EVENT#{event_id}",
                        'SK': "METADATA"
                    },
                    'UpdateExpression': update_expr,
                    'ExpressionAttributeNames': expr_attr_names,
                    'ExpressionAttributeValues': expr_attr_values
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
    
    # Re-fetch the item to return the updated version
    updated_item = table.get_item(Key={'PK': f"EVENT#{event_id}", 'SK': "METADATA"}).get('Item', {})
    return build_response(200, clean_item(updated_item))


def delete_event(event_id):
    now = datetime.utcnow().isoformat() + 'Z'
    audit_item = {
        'PK': f"EVENT#{event_id}",
        'SK': f"AUDIT#{now}",
        'action': "EVENT_DELETED",
        'actor': "admin",
        'details': "Event deleted"
    }
    
    dynamodb.meta.client.transact_write_items(
        TransactItems=[
            {
                'Delete': {
                    'TableName': table_name,
                    'Key': {
                        'PK': f"EVENT#{event_id}",
                        'SK': "METADATA"
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
    
    return build_response(204, {})

def clean_item(item):
    cleaned = item.copy()
    cleaned.pop('PK', None)
    cleaned.pop('SK', None)
    return cleaned
