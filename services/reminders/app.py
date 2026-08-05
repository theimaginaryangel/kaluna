import json
import os
import boto3
from datetime import datetime, timedelta
from boto3.dynamodb.conditions import Key, Attr

dynamodb = boto3.resource('dynamodb')
ses = boto3.client('ses', region_name=os.environ.get('AWS_DEFAULT_REGION', 'us-east-1'))
table_name = os.environ.get('TABLE_NAME', 'kaluna-dev-table')
sender_email = os.environ.get('SENDER_EMAIL', 'contact@bennyduah.com')
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
                
                try:
                    ses.send_email(
                        Source=sender_email,
                        Destination={'ToAddresses': [email]},
                        Message={
                            'Subject': {'Data': f'Reminder: {event_name} is tomorrow!'},
                            'Body': {'Html': {'Data': html_body}}
                        }
                    )
                    reminders_sent += 1
                except Exception as e:
                    print(f"Failed to send reminder to {email}: {e}")
                    
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
