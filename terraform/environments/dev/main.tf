locals {
  environment = "dev"
}

module "dynamodb" {
  source      = "../../modules/dynamodb"
  table_name  = "eventflow-${local.environment}-table"
  environment = local.environment
}

module "api_gateway" {
  source      = "../../modules/api_gateway"
  api_name    = "eventflow-${local.environment}-api"
  environment = local.environment
}

module "ses" {
  source       = "../../modules/ses"
  sender_email = "contact@bennyduah.com"
  environment  = local.environment
}

# --- Events Service ---

module "events_iam" {
  source             = "../../modules/iam"
  role_name          = "eventflow-${local.environment}-events-role"
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
  function_name    = "eventflow-${local.environment}-events"
  role             = module.events_iam.role_arn
  handler          = "app.lambda_handler"
  runtime          = "python3.11"
  source_code_hash = data.archive_file.events_zip.output_base64sha256

  environment {
    variables = {
      TABLE_NAME = module.dynamodb.table_name
    }
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
  route_key = "GET /events"
  target    = "integrations/${aws_apigatewayv2_integration.events_integration.id}"
}

resource "aws_apigatewayv2_route" "events_post" {
  api_id    = module.api_gateway.api_id
  route_key = "POST /events"
  target    = "integrations/${aws_apigatewayv2_integration.events_integration.id}"
}

resource "aws_apigatewayv2_route" "events_get_one" {
  api_id    = module.api_gateway.api_id
  route_key = "GET /events/{eventId}"
  target    = "integrations/${aws_apigatewayv2_integration.events_integration.id}"
}

resource "aws_apigatewayv2_route" "events_put" {
  api_id    = module.api_gateway.api_id
  route_key = "PUT /events/{eventId}"
  target    = "integrations/${aws_apigatewayv2_integration.events_integration.id}"
}

resource "aws_apigatewayv2_route" "events_delete" {
  api_id    = module.api_gateway.api_id
  route_key = "DELETE /events/{eventId}"
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
  role_name          = "eventflow-${local.environment}-registrations-role"
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
  function_name    = "eventflow-${local.environment}-registrations"
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
}

resource "aws_apigatewayv2_integration" "registrations_integration" {
  api_id             = module.api_gateway.api_id
  integration_type   = "AWS_PROXY"
  integration_method = "POST"
  integration_uri    = aws_lambda_function.registrations.invoke_arn
}

resource "aws_apigatewayv2_route" "registrations_post" {
  api_id    = module.api_gateway.api_id
  route_key = "POST /events/{eventId}/register"
  target    = "integrations/${aws_apigatewayv2_integration.registrations_integration.id}"
}

resource "aws_apigatewayv2_route" "registrations_cancel" {
  api_id    = module.api_gateway.api_id
  route_key = "POST /registrations/{ticketId}/cancel"
  target    = "integrations/${aws_apigatewayv2_integration.registrations_integration.id}"
}

resource "aws_apigatewayv2_route" "registrations_get_ticket" {
  api_id    = module.api_gateway.api_id
  route_key = "GET /registrations/{ticketId}"
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
  role_name          = "eventflow-${local.environment}-checkin-role"
  environment        = local.environment
  dynamodb_table_arn = module.dynamodb.table_arn
}

resource "null_resource" "build_checkin" {
  triggers = {
    always_run = "${timestamp()}"
  }
  provisioner "local-exec" {
    command = "cd ../../../services/checkin && go build -o bootstrap main.go"
    environment = {
      GOOS   = "linux"
      GOARCH = "amd64"
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
  function_name    = "eventflow-${local.environment}-checkin"
  role             = module.checkin_iam.role_arn
  handler          = "bootstrap"
  runtime          = "provided.al2023"
  source_code_hash = data.archive_file.checkin_zip.output_base64sha256

  environment {
    variables = {
      TABLE_NAME = module.dynamodb.table_name
    }
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
  route_key = "POST /check-in"
  target    = "integrations/${aws_apigatewayv2_integration.checkin_integration.id}"
}

resource "aws_apigatewayv2_route" "checkins_get" {
  api_id    = module.api_gateway.api_id
  route_key = "GET /events/{eventId}/check-ins"
  target    = "integrations/${aws_apigatewayv2_integration.checkin_integration.id}"
}

resource "aws_lambda_permission" "checkin_api_gw" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.checkin.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${module.api_gateway.execution_arn}/*/*"
}
