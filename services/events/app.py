import json
import os
import uuid
import time
import base64
import re
from datetime import datetime
import boto3
from boto3.dynamodb.conditions import Key, Attr
from utils import format_error, build_response, log_event

dynamodb = boto3.resource('dynamodb')
table_name = os.environ.get('TABLE_NAME', 'kaluna-dev-table')
table = dynamodb.Table(table_name)

def compute_status(capacity: int, seats_remaining: int) -> str:
    if seats_remaining <= 0:
        return 'sold_out'
    elif seats_remaining / capacity <= 0.2:
        return 'limited'
    return 'available'

def validate_event_input(body: dict, is_update: bool = False) -> str | None:
    """Returns an error message if validation fails, None if valid."""
    if not is_update:
        required = ['name', 'date', 'venue', 'capacity']
        for field in required:
            if field not in body:
                return f'Missing required field: {field}'
    
    if 'capacity' in body:
        try:
            cap = int(body['capacity'])
            if cap < 1 or cap > 100000:
                return 'Capacity must be between 1 and 100,000'
        except (ValueError, TypeError):
            return 'Capacity must be a number'
    
    if 'date' in body:
        try:
            datetime.strptime(body['date'], '%Y-%m-%d')
        except ValueError:
            return 'Date must be in YYYY-MM-DD format'
    
    if 'name' in body and (not isinstance(body['name'], str) or len(body['name'].strip()) == 0):
        return 'Name cannot be empty'
        
    if 'waitlistEnabled' in body and not isinstance(body['waitlistEnabled'], bool):
        return 'waitlistEnabled must be a boolean'
    
    return None

def lambda_handler(event: dict, context) -> dict:
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
        if path == '/api/v1/health' and http_method == 'GET':
            import datetime as dt
            health = {
                'status': 'healthy',
                'version': '1.0.0',
                'region': os.environ.get('AWS_REGION', 'us-east-1'),
                'timestamp': dt.datetime.utcnow().isoformat() + 'Z'
            }
            return build_response(200, health)
            
        elif path == '/api/v1/events' and http_method == 'GET':
            response = list_events(event)
            log_event(request_id, "N/A", "list_events", start_time, "success")
            return response
            
        elif path == '/api/v1/analytics' and http_method == 'GET':
            response = get_analytics()
            log_event(request_id, "N/A", "get_analytics", start_time, "success")
            return response
            
        elif path == '/api/v1/events' and http_method == 'POST':
            body = json.loads(event.get('body', '{}'))
            response, new_event_id = create_event(body)
            log_event(request_id, new_event_id, "create_event", start_time, "success")
            return response
            
        elif path.startswith('/api/v1/events/') and event_id:
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
                
        elif path.startswith('/api/v1/events/') and path.endswith('/registrations') and event_id:
            if http_method == 'GET':
                response = list_event_registrations(event_id, event)
                log_event(request_id, event_id, "list_registrations", start_time, "success")
                return response
                
        # Route not found
        log_event(request_id, event_id or "N/A", action, start_time, "error")
        return build_response(404, format_error("Route not found", "NOT_FOUND"))
        
    except Exception as e:
        log_event(request_id, event_id or "N/A", action, start_time, f"error: {str(e)}")
        return build_response(500, format_error("Internal server error", "INTERNAL_ERROR"))


def list_events(event: dict) -> dict:
    query_params = event.get('queryStringParameters') or {}
    status_filter = query_params.get('status')
    limit = min(int(query_params.get('limit', '20')), 100)
    cursor = query_params.get('cursor')
    
    scan_kwargs = {
        'FilterExpression': Attr('SK').eq('METADATA'),
        'Limit': limit
    }
    
    if status_filter:
        scan_kwargs['FilterExpression'] &= Attr('status').eq(status_filter)
    
    if cursor:
        try:
            decoded = json.loads(base64.b64decode(cursor).decode('utf-8'))
            scan_kwargs['ExclusiveStartKey'] = decoded
        except Exception:
            return build_response(400, format_error('Invalid cursor', 'BAD_REQUEST'))
    
    response = table.scan(**scan_kwargs)
    items = response.get('Items', [])
    events = [clean_item(item) for item in items]
    
    result = {'events': events}
    if 'LastEvaluatedKey' in response:
        result['nextCursor'] = base64.b64encode(
            json.dumps(response['LastEvaluatedKey'], default=str).encode('utf-8')
        ).decode('utf-8')
    
    return build_response(200, result)


def create_event(body: dict) -> tuple[dict, str]:
    error = validate_event_input(body)
    if error:
        return build_response(400, format_error(error, 'BAD_REQUEST')), 'N/A'
            
    event_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat() + 'Z'
    
    capacity = int(body['capacity'])
    item = {
        'PK': f"EVENT#{event_id}",
        'SK': "METADATA",
        'eventId': event_id,
        'name': body['name'],
        'date': body['date'],
        'venue': body['venue'],
        'capacity': capacity,
        'seatsRemaining': capacity,
        'status': compute_status(capacity, capacity),
        'waitlistEnabled': body.get('waitlistEnabled', False),
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


def get_event(event_id: str) -> dict:
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


def update_event(event_id: str, body: dict) -> dict:
    error = validate_event_input(body, is_update=True)
    if error:
        return build_response(400, format_error(error, 'BAD_REQUEST'))

    # First get the event to make sure it exists
    get_res = table.get_item(Key={'PK': f"EVENT#{event_id}", 'SK': "METADATA"})
    if 'Item' not in get_res:
        return build_response(404, format_error("Event not found", "NOT_FOUND"))
        
    update_expr = "SET "
    expr_attr_values = {}
    expr_attr_names = {}
    
    updatable_fields = ['name', 'date', 'venue', 'capacity', 'waitlistEnabled']
    
    if 'capacity' in body:
        old_item = get_res['Item']
        old_cap = int(old_item.get('capacity', 0))
        old_rem = int(old_item.get('seatsRemaining', 0))
        taken = old_cap - old_rem
        new_cap = int(body['capacity'])
        new_rem = new_cap - taken
        
        body['seatsRemaining'] = new_rem
        body['status'] = compute_status(new_cap, new_rem)
        updatable_fields.extend(['seatsRemaining', 'status'])
        
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


def delete_event(event_id: str) -> dict:
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

def clean_item(item: dict) -> dict:
    cleaned = item.copy()
    cleaned.pop('PK', None)
    cleaned.pop('SK', None)
    cleaned.pop('GSI1PK', None)
    cleaned.pop('GSI1SK', None)
    return cleaned

def list_event_registrations(event_id: str, event_obj: dict) -> dict:
    response = table.query(
        KeyConditionExpression=Key('PK').eq(f"EVENT#{event_id}") & Key('SK').begins_with("REG#")
    )
    items = response.get('Items', [])
    registrations = [clean_item(item) for item in items]
    
    query_params = event_obj.get('queryStringParameters') or {}
    if query_params.get('format') == 'csv' or query_params.get('export') == 'csv':
        import io
        import csv
        
        output = io.StringIO()
        if len(registrations) > 0:
            writer = csv.DictWriter(output, fieldnames=registrations[0].keys())
            writer.writeheader()
            writer.writerows(registrations)
        else:
            output.write("No registrations found.")
            
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'text/csv',
                'Content-Disposition': f'attachment; filename="event_{event_id}_registrations.csv"'
            },
            'body': output.getvalue()
        }
        
    return build_response(200, registrations)

def get_analytics() -> dict:
    # In a real heavy production app, we would maintain these counters transactionally or use a secondary index.
    # For this scale, a single scan to aggregate data is acceptable.
    response = table.scan()
    items = response.get('Items', [])
    
    total_events = 0
    upcoming_events = 0
    total_registrations = 0
    total_checked_in = 0
    
    for item in items:
        sk = item.get('SK', '')
        if sk == 'METADATA':
            total_events += 1
            if item.get('status') != 'sold_out':
                upcoming_events += 1
        elif sk.startswith('REG#'):
            total_registrations += 1
            if item.get('status') == 'checked_in':
                total_checked_in += 1
                
    attendance_rate = 0
    if total_registrations > 0:
        attendance_rate = (total_checked_in / total_registrations) * 100
        
    stats = {
        'totalEvents': total_events,
        'upcomingEvents': upcoming_events,
        'totalRegistrations': total_registrations,
        'attendanceRate': round(attendance_rate, 2)
    }
    return build_response(200, stats)
