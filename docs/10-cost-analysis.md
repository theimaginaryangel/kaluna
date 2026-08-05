# Cost Analysis

To be completed once deployed, using actual CloudWatch usage data and the AWS Pricing Calculator. Template below.

| Service | Free Tier allowance | Estimated usage (portfolio-demo scale) | Est. monthly cost |
|---|---|---|---|
| Lambda | 1M requests + 400,000 GB-s/month | < 10,000 requests | $0 |
| API Gateway | 1M calls/month (12 months) | < 10,000 calls | $0 |
| DynamoDB | 25 GB storage, 25 WCU/RCU | < 1 GB storage | $0 |
| SES | 62,000 emails/month (from EC2) or 3,000/month (general) | < 500 emails | $0 |
| Cognito | 50,000 MAUs | < 100 MAUs | $0 |
| CloudWatch | 5GB logs, 10 custom metrics | ~1 GB logs | ~$1 |
| **Total** | | | **~$1/month at this scale** |

AWS Budgets alert set at a low threshold ($5) to catch anomalies early.
