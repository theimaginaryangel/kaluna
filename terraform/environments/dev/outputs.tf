output "api_url" {
  description = "Base URL for the dev API"
  value       = module.api_gateway.api_endpoint
}

output "cognito_user_pool_id" {
  description = "ID of the Cognito User Pool"
  value       = module.cognito.user_pool_id
}

output "cognito_client_id" {
  description = "ID of the Cognito App Client"
  value       = module.cognito.user_pool_client_id
}
