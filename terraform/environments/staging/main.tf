locals {
  environment = "staging"
}

module "dynamodb" {
  source      = "../../modules/dynamodb"
  table_name  = "kaluna-${local.environment}-table"
  environment = local.environment
}

module "api_gateway" {
  source      = "../../modules/api_gateway"
  api_name    = "kaluna-${local.environment}-api"
  environment = local.environment
}

module "ses" {
  source       = "../../modules/ses"
  sender_email = "contact@bennyduah.com"
  environment  = local.environment
}



resource "aws_apigatewayv2_authorizer" "jwt_auth" {
  api_id           = module.api_gateway.api_id
  authorizer_type  = "REQUEST"
  authorizer_uri   = aws_lambda_function.authorizer.invoke_arn
  identity_sources = ["$request.header.Authorization"]
  name             = "custom-jwt-authorizer"
  authorizer_payload_format_version = "2.0"
  enable_simple_responses = true
}

# --- Auth Service ---

module "auth_iam" {
  source             = "../../modules/iam"
  role_name          = "kaluna-${local.environment}-auth-role"
  environment        = local.environment
  dynamodb_table_arn = module.dynamodb.table_arn
}

data "archive_file" "auth_zip" {
  type        = "zip"
  source_dir  = "../../../services/auth"
  output_path = "${path.module}/auth.zip"
}

resource "aws_lambda_function" "auth" {
  filename         = data.archive_file.auth_zip.output_path
  function_name    = "kaluna-${local.environment}-auth"
  role             = module.auth_iam.role_arn
  handler          = "app.lambda_handler"
  runtime          = "python3.11"
  source_code_hash = data.archive_file.auth_zip.output_base64sha256

  environment {
    variables = {
      TABLE_NAME = module.dynamodb.table_name
      JWT_SECRET = "super-secret-key-for-dev"
    }
  }
}

resource "aws_apigatewayv2_integration" "auth_integration" {
  api_id                 = module.api_gateway.api_id
  integration_type       = "AWS_PROXY"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.auth.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "auth_login_post" {
  api_id    = module.api_gateway.api_id
  route_key = "POST /api/v1/auth/login"
  target    = "integrations/${aws_apigatewayv2_integration.auth_integration.id}"
}

resource "aws_apigatewayv2_route" "auth_register_post" {
  api_id    = module.api_gateway.api_id
  route_key = "POST /api/v1/auth/register"
  target    = "integrations/${aws_apigatewayv2_integration.auth_integration.id}"
}

resource "aws_lambda_permission" "auth_api_gw" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auth.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${module.api_gateway.execution_arn}/*/*"
}

# --- Authorizer Service ---

module "authorizer_iam" {
  source             = "../../modules/iam"
  role_name          = "kaluna-${local.environment}-authorizer-role"
  environment        = local.environment
  dynamodb_table_arn = module.dynamodb.table_arn
}

data "archive_file" "authorizer_zip" {
  type        = "zip"
  source_dir  = "../../../services/authorizer"
  output_path = "${path.module}/authorizer.zip"
}

resource "aws_lambda_function" "authorizer" {
  filename         = data.archive_file.authorizer_zip.output_path
  function_name    = "kaluna-${local.environment}-authorizer"
  role             = module.authorizer_iam.role_arn
  handler          = "app.lambda_handler"
  runtime          = "python3.11"
  source_code_hash = data.archive_file.authorizer_zip.output_base64sha256

  environment {
    variables = {
      JWT_SECRET = "super-secret-key-for-dev"
    }
  }
}

resource "aws_lambda_permission" "authorizer_api_gw" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.authorizer.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${module.api_gateway.execution_arn}/*/*"
}

# --- Events Service ---

module "events_iam" {
  source             = "../../modules/iam"
  role_name          = "kaluna-${local.environment}-events-role"
  environment        = local.environment
  dynamodb_table_arn = module.dynamodb.table_arn
}

data "archive_file" "events_zip" {
  type        = "zip"
  source_dir  = "../../../services/events"
  output_path = "${path.module}/events.zip"
}

resource "aws_lambda_function" "events" {
  filename         = data.archive_file.events_zip.output_path
  function_name    = "kaluna-${local.environment}-events"
  role             = module.events_iam.role_arn
  handler          = "app.lambda_handler"
  runtime          = "python3.11"
  source_code_hash = data.archive_file.events_zip.output_base64sha256

  environment {
    variables = {
      TABLE_NAME = module.dynamodb.table_name
    }
  }

  tracing_config {
    mode = "Active"
  }
}

# Add API Gateway integration for Events
resource "aws_apigatewayv2_integration" "events_integration" {
  api_id             = module.api_gateway.api_id
  integration_type   = "AWS_PROXY"
  integration_method = "POST"
  integration_uri    = aws_lambda_function.events.invoke_arn
}

resource "aws_apigatewayv2_route" "events_get_all" {
  api_id    = module.api_gateway.api_id
  route_key = "GET /api/v1/events"
  target    = "integrations/${aws_apigatewayv2_integration.events_integration.id}"
}

resource "aws_apigatewayv2_route" "events_post" {
  api_id             = module.api_gateway.api_id
  route_key          = "POST /api/v1/events"
  target             = "integrations/${aws_apigatewayv2_integration.events_integration.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_auth.id
}

resource "aws_apigatewayv2_route" "events_get_one" {
  api_id    = module.api_gateway.api_id
  route_key = "GET /api/v1/events/{eventId}"
  target    = "integrations/${aws_apigatewayv2_integration.events_integration.id}"
}

resource "aws_apigatewayv2_route" "events_put" {
  api_id             = module.api_gateway.api_id
  route_key          = "PUT /api/v1/events/{eventId}"
  target             = "integrations/${aws_apigatewayv2_integration.events_integration.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_auth.id
}

resource "aws_apigatewayv2_route" "events_delete" {
  api_id             = module.api_gateway.api_id
  route_key          = "DELETE /api/v1/events/{eventId}"
  target             = "integrations/${aws_apigatewayv2_integration.events_integration.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_auth.id
}

resource "aws_apigatewayv2_route" "events_registrations_get" {
  api_id             = module.api_gateway.api_id
  route_key          = "GET /api/v1/events/{eventId}/registrations"
  target             = "integrations/${aws_apigatewayv2_integration.events_integration.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_auth.id
}

# --- Secured Creator Routes (JWT Auth) ---

resource "aws_apigatewayv2_route" "creator_events_get" {
  api_id    = module.api_gateway.api_id
  route_key = "GET /api/v1/creator/events"
  target    = "integrations/${aws_apigatewayv2_integration.events_integration.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_auth.id
}

resource "aws_apigatewayv2_route" "creator_events_post" {
  api_id    = module.api_gateway.api_id
  route_key = "POST /api/v1/creator/events"
  target    = "integrations/${aws_apigatewayv2_integration.events_integration.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_auth.id
}

resource "aws_apigatewayv2_route" "creator_events_put" {
  api_id    = module.api_gateway.api_id
  route_key = "PUT /api/v1/creator/events/{eventId}"
  target    = "integrations/${aws_apigatewayv2_integration.events_integration.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_auth.id
}

resource "aws_apigatewayv2_route" "creator_events_delete" {
  api_id    = module.api_gateway.api_id
  route_key = "DELETE /api/v1/creator/events/{eventId}"
  target    = "integrations/${aws_apigatewayv2_integration.events_integration.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_auth.id
}

resource "aws_apigatewayv2_route" "creator_events_registrations_get" {
  api_id    = module.api_gateway.api_id
  route_key = "GET /api/v1/creator/events/{eventId}/registrations"
  target    = "integrations/${aws_apigatewayv2_integration.events_integration.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_auth.id
}

resource "aws_apigatewayv2_route" "creator_analytics_get" {
  api_id    = module.api_gateway.api_id
  route_key = "GET /api/v1/creator/analytics"
  target    = "integrations/${aws_apigatewayv2_integration.events_integration.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_auth.id
}

resource "aws_apigatewayv2_route" "analytics_get" {
  api_id             = module.api_gateway.api_id
  route_key          = "GET /api/v1/analytics"
  target             = "integrations/${aws_apigatewayv2_integration.events_integration.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_auth.id
}

resource "aws_apigatewayv2_route" "health_get" {
  api_id    = module.api_gateway.api_id
  route_key = "GET /api/v1/health"
  target    = "integrations/${aws_apigatewayv2_integration.events_integration.id}"
}

resource "aws_lambda_permission" "events_api_gw" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.events.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${module.api_gateway.execution_arn}/*/*"
}


# --- Registrations Service ---

module "registrations_iam" {
  source             = "../../modules/iam"
  role_name          = "kaluna-${local.environment}-registrations-role"
  environment        = local.environment
  dynamodb_table_arn = module.dynamodb.table_arn
  enable_ses_send    = true
}

data "archive_file" "registrations_zip" {
  type        = "zip"
  source_dir  = "../../../services/registrations"
  output_path = "${path.module}/registrations.zip"
}

resource "aws_lambda_function" "registrations" {
  filename         = data.archive_file.registrations_zip.output_path
  function_name    = "kaluna-${local.environment}-registrations"
  role             = module.registrations_iam.role_arn
  handler          = "app.lambda_handler"
  runtime          = "python3.11"
  source_code_hash = data.archive_file.registrations_zip.output_base64sha256

  environment {
    variables = {
      TABLE_NAME   = module.dynamodb.table_name
      SENDER_EMAIL = module.ses.sender_email
    }
  }

  tracing_config {
    mode = "Active"
  }
}

resource "aws_apigatewayv2_integration" "registrations_integration" {
  api_id             = module.api_gateway.api_id
  integration_type   = "AWS_PROXY"
  integration_method = "POST"
  integration_uri    = aws_lambda_function.registrations.invoke_arn
}

resource "aws_apigatewayv2_route" "registrations_post" {
  api_id    = module.api_gateway.api_id
  route_key = "POST /api/v1/events/{eventId}/register"
  target    = "integrations/${aws_apigatewayv2_integration.registrations_integration.id}"
}

resource "aws_apigatewayv2_route" "registrations_cancel" {
  api_id    = module.api_gateway.api_id
  route_key = "POST /api/v1/registrations/{ticketId}/cancel"
  target    = "integrations/${aws_apigatewayv2_integration.registrations_integration.id}"
}

resource "aws_apigatewayv2_route" "registrations_get_ticket" {
  api_id    = module.api_gateway.api_id
  route_key = "GET /api/v1/registrations/{ticketId}"
  target    = "integrations/${aws_apigatewayv2_integration.registrations_integration.id}"
}

resource "aws_lambda_permission" "registrations_api_gw" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.registrations.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${module.api_gateway.execution_arn}/*/*"
}


# --- Check-in Service (Go) ---

module "checkin_iam" {
  source             = "../../modules/iam"
  role_name          = "kaluna-${local.environment}-checkin-role"
  environment        = local.environment
  dynamodb_table_arn = module.dynamodb.table_arn
}

resource "null_resource" "build_checkin" {
  triggers = {
    source_hash = filemd5("${path.module}/../../../services/checkin/main.go")
  }
  provisioner "local-exec" {
    command     = "go build -o bootstrap main.go"
    working_dir = "${path.module}/../../../services/checkin"
    environment = {
      CGO_ENABLED = "0"
      GOOS        = "linux"
      GOARCH      = "amd64"
    }
  }
}

data "archive_file" "checkin_zip" {
  depends_on  = [null_resource.build_checkin]
  type        = "zip"
  source_file = "../../../services/checkin/bootstrap"
  output_path = "${path.module}/checkin.zip"
}

resource "aws_lambda_function" "checkin" {
  filename         = data.archive_file.checkin_zip.output_path
  function_name    = "kaluna-${local.environment}-checkin"
  role             = module.checkin_iam.role_arn
  handler          = "bootstrap"
  runtime          = "provided.al2023"
  source_code_hash = data.archive_file.checkin_zip.output_base64sha256

  environment {
    variables = {
      TABLE_NAME = module.dynamodb.table_name
    }
  }

  tracing_config {
    mode = "Active"
  }
}

resource "aws_apigatewayv2_integration" "checkin_integration" {
  api_id             = module.api_gateway.api_id
  integration_type   = "AWS_PROXY"
  integration_method = "POST"
  integration_uri    = aws_lambda_function.checkin.invoke_arn
}

resource "aws_apigatewayv2_route" "checkin_post" {
  api_id    = module.api_gateway.api_id
  route_key = "POST /api/v1/check-in"
  target    = "integrations/${aws_apigatewayv2_integration.checkin_integration.id}"
}

resource "aws_apigatewayv2_route" "checkins_get" {
  api_id             = module.api_gateway.api_id
  route_key          = "GET /api/v1/events/{eventId}/check-ins"
  target             = "integrations/${aws_apigatewayv2_integration.checkin_integration.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_auth.id
}

resource "aws_apigatewayv2_route" "creator_checkins_get" {
  api_id    = module.api_gateway.api_id
  route_key = "GET /api/v1/creator/events/{eventId}/check-ins"
  target    = "integrations/${aws_apigatewayv2_integration.checkin_integration.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_auth.id
}

resource "aws_lambda_permission" "checkin_api_gw" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.checkin.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${module.api_gateway.execution_arn}/*/*"
}

# --- Reminders Service ---

module "reminders_iam" {
  source             = "../../modules/iam"
  role_name          = "kaluna-${local.environment}-reminders-role"
  environment        = local.environment
  dynamodb_table_arn = module.dynamodb.table_arn
  enable_ses_send    = true
}

data "archive_file" "reminders_zip" {
  type        = "zip"
  source_dir  = "../../../services/reminders"
  output_path = "${path.module}/reminders.zip"
}

resource "aws_lambda_function" "reminders" {
  filename         = data.archive_file.reminders_zip.output_path
  function_name    = "kaluna-${local.environment}-reminders"
  role             = module.reminders_iam.role_arn
  handler          = "app.lambda_handler"
  runtime          = "python3.11"
  source_code_hash = data.archive_file.reminders_zip.output_base64sha256

  environment {
    variables = {
      TABLE_NAME   = module.dynamodb.table_name
      SENDER_EMAIL = module.ses.sender_email
    }
  }

  tracing_config {
    mode = "Active"
  }
}

resource "aws_cloudwatch_event_rule" "reminders_schedule" {
  name                = "kaluna-${local.environment}-reminders-schedule"
  description         = "Triggers the event reminders lambda daily"
  schedule_expression = "cron(0 10 * * ? *)" # Runs every day at 10 AM UTC
}

resource "aws_cloudwatch_event_target" "reminders_target" {
  rule      = aws_cloudwatch_event_rule.reminders_schedule.name
  target_id = "RemindersLambda"
  arn       = aws_lambda_function.reminders.arn
}

resource "aws_lambda_permission" "allow_cloudwatch_reminders" {
  statement_id  = "AllowExecutionFromCloudWatch"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.reminders.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.reminders_schedule.arn
}

# --- Feedback Service ---

module "feedback_iam" {
  source             = "../../modules/iam"
  role_name          = "kaluna-${local.environment}-feedback-role"
  environment        = local.environment
  dynamodb_table_arn = module.dynamodb.table_arn
  enable_ses_send    = true
}

data "archive_file" "feedback_zip" {
  type        = "zip"
  source_dir  = "../../../services/feedback"
  output_path = "${path.module}/feedback.zip"
}

resource "aws_lambda_function" "feedback" {
  filename         = data.archive_file.feedback_zip.output_path
  function_name    = "kaluna-${local.environment}-feedback"
  role             = module.feedback_iam.role_arn
  handler          = "app.lambda_handler"
  runtime          = "python3.11"
  source_code_hash = data.archive_file.feedback_zip.output_base64sha256

  environment {
    variables = {
      TABLE_NAME   = module.dynamodb.table_name
      SENDER_EMAIL = module.ses.sender_email
    }
  }

  tracing_config {
    mode = "Active"
  }
}

resource "aws_cloudwatch_event_rule" "feedback_schedule" {
  name                = "kaluna-${local.environment}-feedback-schedule"
  description         = "Triggers the post-event feedback lambda daily"
  schedule_expression = "cron(0 14 * * ? *)" # Runs every day at 2 PM UTC
}

resource "aws_cloudwatch_event_target" "feedback_target" {
  rule      = aws_cloudwatch_event_rule.feedback_schedule.name
  target_id = "FeedbackLambda"
  arn       = aws_lambda_function.feedback.arn
}

resource "aws_lambda_permission" "allow_cloudwatch_feedback" {
  statement_id  = "AllowExecutionFromCloudWatch"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.feedback.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.feedback_schedule.arn
}

# --- Observability ---

module "monitoring" {
  source              = "../../modules/monitoring"
  environment         = local.environment
  api_gateway_id      = module.api_gateway.api_id
  dynamodb_table_name = module.dynamodb.table_name
  lambda_functions = {
    (aws_lambda_function.auth.function_name)          = "auth"
    (aws_lambda_function.authorizer.function_name)    = "authorizer"
    (aws_lambda_function.events.function_name)        = "events"
    (aws_lambda_function.registrations.function_name) = "registrations"
    (aws_lambda_function.checkin.function_name)       = "checkin"
    (aws_lambda_function.reminders.function_name)     = "reminders"
    (aws_lambda_function.feedback.function_name)      = "feedback"
  }
}
