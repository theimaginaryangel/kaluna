import boto3
import json

ag = boto3.client('apigatewayv2', region_name='us-east-1')

apis = ag.get_apis()['Items']

for api in sorted(apis, key=lambda x: str(x.get('CreatedDate'))):
    api_id = api['ApiId']
    name = api['Name']
    created = str(api.get('CreatedDate', ''))
    endpoint = api.get('ApiEndpoint', '')
    protocol = api.get('ProtocolType', '')
    
    routes = ag.get_routes(ApiId=api_id).get('Items', [])
    integrations = ag.get_integrations(ApiId=api_id).get('Items', [])
    stages = ag.get_stages(ApiId=api_id).get('Items', [])
    authorizers = ag.get_authorizers(ApiId=api_id).get('Items', [])
    
    print("==================================================")
    print(f"API ID: {api_id}")
    print(f"Name: {name}")
    print(f"CreatedDate: {created}")
    print(f"ProtocolType: {protocol}")
    print(f"ApiEndpoint: {endpoint}")
    print(f"Routes ({len(routes)}):")
    for r in routes:
        print(f"  - RouteKey: {r.get('RouteKey')}, Id: {r.get('RouteId')}, Target: {r.get('Target')}, Auth: {r.get('AuthorizationType')}")
    print(f"Integrations ({len(integrations)}):")
    for i in integrations:
        print(f"  - Id: {i.get('IntegrationId')}, Type: {i.get('IntegrationType')}, Uri: {i.get('IntegrationUri')}")
    print(f"Stages ({len(stages)}):")
    for s in stages:
        print(f"  - Name: {s.get('StageName')}, AutoDeploy: {s.get('AutoDeploy')}, Status: {s.get('LastDeploymentStatusMessage', 'OK')}")
    print(f"Authorizers ({len(authorizers)}):")
    for a in authorizers:
        print(f"  - Id: {a.get('AuthorizerId')}, Name: {a.get('Name')}, Type: {a.get('AuthorizerType')}")
