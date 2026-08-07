import boto3
import json
import os

ag = boto3.client('apigatewayv2', region_name='us-east-1')
lambda_client = boto3.client('lambda', region_name='us-east-1')
logs_client = boto3.client('logs', region_name='us-east-1')

apis = ag.get_apis()['Items']

api_details = {}

for api in apis:
    api_id = api['ApiId']
    name = api['Name']
    created = str(api.get('CreatedDate', ''))
    endpoint = api.get('ApiEndpoint', '')
    protocol = api.get('ProtocolType', '')
    
    routes = ag.get_routes(ApiId=api_id).get('Items', [])
    integrations = ag.get_integrations(ApiId=api_id).get('Items', [])
    stages = ag.get_stages(ApiId=api_id).get('Items', [])
    authorizers = ag.get_authorizers(ApiId=api_id).get('Items', [])
    
    api_details[api_id] = {
        'name': name,
        'created': created,
        'endpoint': endpoint,
        'protocol': protocol,
        'routes': routes,
        'integrations': integrations,
        'stages': stages,
        'authorizers': authorizers
    }

lambdas = ['kaluna-dev-events', 'kaluna-dev-registrations', 'kaluna-dev-checkin', 'kaluna-dev-reminders', 'kaluna-dev-feedback',
           'kaluna-prod-events', 'kaluna-prod-registrations', 'kaluna-prod-checkin', 'kaluna-prod-reminders', 'kaluna-prod-feedback']

lambda_policies = {}
for fn in lambdas:
    try:
        policy = lambda_client.get_policy(FunctionName=fn)
        lambda_policies[fn] = json.loads(policy['Policy'])
    except Exception as e:
        lambda_policies[fn] = str(e)

out = {
    'apis': api_details,
    'lambda_policies': lambda_policies
}

with open('audit_raw.json', 'w') as f:
    json.dump(out, f, indent=2, default=str)

print("Saved audit_raw.json successfully!")
