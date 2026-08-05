output "api_url" {
  description = "Base URL for the dev API"
  value       = module.api_gateway.api_endpoint
}
