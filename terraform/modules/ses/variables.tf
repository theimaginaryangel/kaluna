variable "sender_email" {
  description = "The verified email address used as the sender"
  type        = string
}

variable "environment" {
  description = "Environment (e.g. dev, staging, prod)"
  type        = string
}
