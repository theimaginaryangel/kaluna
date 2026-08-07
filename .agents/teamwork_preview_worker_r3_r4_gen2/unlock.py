import boto3

dynamodb = boto3.client('dynamodb', region_name='us-east-1')

table_name = 'kaluna-terraform-locks'
lock_id = 'kaluna-terraform-state-496795891920/dev/terraform.tfstate'

try:
    res = dynamodb.delete_item(
        TableName=table_name,
        Key={'LockID': {'S': lock_id}}
    )
    print("Successfully deleted lock item:", res)
except Exception as e:
    print("Error deleting lock item:", e)
