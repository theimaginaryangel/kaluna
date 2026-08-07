variable "api_name" {
  description = "Name of the API Gateway"
  type        = string
}

variable "environment" {
  description = "Environment (e.g. dev, staging, prod)"
  type        = string
}

variable "allowed_origins" {
  description = "List of allowed CORS origins"
  type        = list(string)
}
