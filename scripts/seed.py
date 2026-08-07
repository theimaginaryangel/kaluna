import json, boto3

TABLE = "kaluna-prod-table"
db = boto3.resource("dynamodb", region_name="us-east-1")
table = db.Table(TABLE)

with open("seed-events.json") as f:
    items = json.load(f)

# Deserialise from DynamoDB JSON format to plain Python
from boto3.dynamodb.types import TypeDeserializer
td = TypeDeserializer()

def deserialise(item):
    return {k: td.deserialize(v) for k, v in item.items()}

with table.batch_writer() as batch:
    for raw in items:
        batch.put_item(Item=deserialise(raw))

print(f"Seeded {len(items)} events into {TABLE}")
