variable "table_name" {
  description = "The name of the DynamoDB table (e.g. kaluna-dev-table)"
  type        = string
}

variable "environment" {
  description = "The environment name (e.g., dev, staging, prod)"
  type        = string
}
