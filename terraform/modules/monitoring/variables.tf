variable "environment" {
  description = "Environment name"
  type        = string
}

variable "api_gateway_id" {
  description = "API Gateway ID to monitor"
  type        = string
}

variable "lambda_functions" {
  description = "Map of Lambda function names to their display names for monitoring"
  type        = map(string)
}

variable "dynamodb_table_name" {
  description = "DynamoDB table name"
  type        = string
}
