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
except urllib.error.HTTPError as e:
        error_msg = e.read().decode('utf-8')
        print(f"Resend HTTP Error: {error_msg}")
    except Exception as e:
        print(f"Failed to send email to {to_email}: {str(e)}")
        
table = dynamodb.Table(table_name)

def lambda_handler(event, context):
    try:
        # Find events happening tomorrow
        tomorrow = (datetime.utcnow() + timedelta(days=1)).strftime('%Y-%m-%d')
        
        # Scan for metadata with tomorrow's date
        response = table.scan(
            FilterExpression=Attr('SK').eq('METADATA') & Attr('date').eq(tomorrow)
        )
        
        events = response.get('Items', [])
        reminders_sent = 0
        
        for evt in events:
            event_id = evt['eventId']
            event_name = evt.get('name', 'Event')
            venue = evt.get('venue', 'TBD')
            
            # Query registrations for this event
            reg_resp = table.query(
                KeyConditionExpression=Key('PK').eq(f"EVENT#{event_id}") & Key('SK').begins_with("REG#"),
                FilterExpression=Attr('status').eq('registered')
            )
            registrations = reg_resp.get('Items', [])
            
            for reg in registrations:
                email = reg['email']
                name = reg.get('name', 'Attendee')
                ticket_id = reg.get('ticketId', '')
                
                qr_url = f"https://api.qrserver.com/v1/create-qr-code/?size=250x250&data={ticket_id}"
                html_body = f"""
                <html>
                <body>
                    <h1>Reminder: {event_name} is tomorrow!</h1>
                    <p>Hi {name},</p>
                    <p>This is a quick reminder that you are registered for <strong>{event_name}</strong> tomorrow at {venue}.</p>
                    <p>Your Ticket ID is: <strong>{ticket_id}</strong></p>
                    <p>Please present the QR code below at check-in:</p>
                    <img src="{qr_url}" alt="Ticket QR Code" />
                    <p>We look forward to seeing you!</p>
                </body>
                </html>
                """
                
                send_resend_email(email, f"Reminder: {event_name} is tomorrow!", html_body)
                    
        return {
            'statusCode': 200,
            'body': json.dumps(f"Sent {reminders_sent} reminders.")
        }
        
    except Exception as e:
        print(f"Error in reminders lambda: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps(str(e))
        }
