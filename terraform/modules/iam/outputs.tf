output "role_arn" {
  description = "The ARN of the generated IAM role"
  value       = aws_iam_role.lambda_role.arn
}

output "role_name" {
  description = "The name of the generated IAM role"
  value       = aws_iam_role.lambda_role.name
}
