variable "role_name" {
  description = "Name of the IAM role to create"
  type        = string
}

variable "environment" {
  description = "Environment (e.g. dev, staging, prod)"
  type        = string
}

variable "dynamodb_table_arn" {
  description = "ARN of the DynamoDB table the Lambda needs access to"
  type        = string
  default     = ""
}

variable "enable_dynamodb_access" {
  description = "Whether to attach DynamoDB access permissions"
  type        = bool
  default     = true
}

variable "enable_ses_send" {
  description = "Whether to attach SES SendEmail permissions"
  type        = bool
  default     = false
}
