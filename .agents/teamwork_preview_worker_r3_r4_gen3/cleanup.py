import boto3
import json
import sys

def main():
    ag = boto3.client('apigatewayv2', region_name='us-east-1')

    print("=== Step 1: Listing initial API Gateways ===")
    initial_apis = ag.get_apis()['Items']
    print(f"Total APIs found: {len(initial_apis)}")
    for api in initial_apis:
        print(f"  - ID: {api['ApiId']}, Name: {api['Name']}, Created: {api.get('CreatedDate')}")

    orphans_to_delete = [
        'teyud9cohl',
        'fvbwfweun7',
        'd8altyy954',
        'pcpooeplr8'
    ]

    protected_apis = ['o275c5g9h5', 'gzwmi3wu12']

    print("\n=== Step 2: Deleting 4 orphaned API Gateways ===")
    for api_id in orphans_to_delete:
        if api_id in protected_apis:
            print(f"ERROR: {api_id} is in protected list! Aborting!")
            sys.exit(1)
        try:
            print(f"Deleting API: {api_id} ...")
            ag.delete_api(ApiId=api_id)
            print(f"Successfully deleted API: {api_id}")
        except Exception as e:
            print(f"Error deleting API {api_id}: {e}")

    print("\n=== Step 3: Verifying remaining API Gateways ===")
    remaining_apis = ag.get_apis()['Items']
    remaining_ids = [api['ApiId'] for api in remaining_apis]
    print(f"Remaining APIs count: {len(remaining_apis)}")
    for api in remaining_apis:
        print(f"  - ID: {api['ApiId']}, Name: {api['Name']}")

    # Verify criteria
    assert len(remaining_apis) == 2, f"Expected 2 remaining APIs, found {len(remaining_apis)}"
    assert 'o275c5g9h5' in remaining_ids, "kaluna-prod-api (o275c5g9h5) missing!"
    assert 'gzwmi3wu12' in remaining_ids, "kaluna-dev-api (gzwmi3wu12) missing!"

    print("\nSUCCESS: Verification passed! Exactly 2 APIs remain: o275c5g9h5 and gzwmi3wu12.")

if __name__ == '__main__':
    main()
