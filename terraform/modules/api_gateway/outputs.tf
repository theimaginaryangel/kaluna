output "api_id" {
  description = "The API Gateway ID"
  value       = aws_apigatewayv2_api.http_api.id
}

output "api_endpoint" {
  description = "The URI of the API"
  value       = aws_apigatewayv2_api.http_api.api_endpoint
}

output "execution_arn" {
  description = "The execution ARN of the API"
  value       = aws_apigatewayv2_api.http_api.execution_arn
}
