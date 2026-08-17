import json
import urllib.request
import base64
import os
import boto3
from datetime import datetime, timedelta
from boto3.dynamodb.conditions import Key, Attr

dynamodb = boto3.resource('dynamodb')

table_name = os.environ.get('TABLE_NAME', 'kaluna-dev-table')
sender_email = os.environ.get('SENDER_EMAIL', 'contact@bennyduah.com')

RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')

def send_resend_email(to_email, subject, html_body, attachments=None):
    if not RESEND_API_KEY:
        print("No RESEND_API_KEY, skipping email.")
        return
        
    url = "https://api.resend.com/emails"
    headers = {
        "Authorization": f"Bearer {RESEND_API_KEY}",
        "Content-Type": "application/json"
    }
    data = {
        "from": "demo.kaluna@bennyduah.com",
        "to": [to_email],
        "subject": subject,
        "html": html_body
    }
    if attachments:
        data["attachments"] = attachments
        
    req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers=headers, method='POST')
    try:
        res = urllib.request.urlopen(req)
        print(f"Sent email to {to_email}")
    except Exception as e:
        print(f"Failed to send email to {to_email}: {str(e)}")
        
table = dynamodb.Table(table_name)

def lambda_handler(event, context):
    try:
        # Find events that happened yesterday
        yesterday = (datetime.utcnow() - timedelta(days=1)).strftime('%Y-%m-%d')
        
        response = table.scan(
            FilterExpression=Attr('SK').eq('METADATA') & Attr('date').eq(yesterday)
        )
        
        events = response.get('Items', [])
        emails_sent = 0
        
        for evt in events:
            event_id = evt['eventId']
            event_name = evt.get('name', 'Event')
            
            # Query checked-in registrations
            reg_resp = table.query(
                KeyConditionExpression=Key('PK').eq(f"EVENT#{event_id}") & Key('SK').begins_with("REG#"),
                FilterExpression=Attr('status').eq('checked_in')
            )
            registrations = reg_resp.get('Items', [])
            
            for reg in registrations:
                email = reg['email']
                name = reg.get('name', 'Attendee')
                
                html_body = f"""
                <html>
                <body>
                    <h1>Thank you for attending {event_name}!</h1>
                    <p>Hi {name},</p>
                    <p>We hope you had a great time at <strong>{event_name}</strong> yesterday.</p>
                    <p>We would love to hear your feedback so we can improve future events. Please reply to this email with your thoughts!</p>
                    <p>Best regards,<br/>The Event Team</p>
                </body>
                </html>
                """
                
                send_resend_email(email, f"How was {event_name}?", html_body)
                    
        return {
            'statusCode': 200,
            'body': json.dumps(f"Sent {emails_sent} feedback requests.")
        }
        
    except Exception as e:
        print(f"Error in feedback lambda: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps(str(e))
        }
