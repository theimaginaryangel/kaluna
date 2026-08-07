output "api_url" {
  description = "Base URL for the prod API"
  value       = module.api_gateway.api_endpoint
}

output "frontend_url" {
  description = "CloudFront URL for the prod frontend"
  value       = "https://${module.frontend.cloudfront_domain_name}"
}

output "frontend_domain_name" {
  description = "Custom domain for the prod frontend"
  value       = "https://${"kaluna.bennyduah.com"}"
}

output "frontend_bucket_name" {
  description = "S3 bucket hosting the built frontend"
  value       = module.frontend.bucket_name
}

