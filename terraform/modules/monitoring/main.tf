# Lambda Error Alarms
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  for_each            = var.lambda_functions
  alarm_name          = "${var.environment}-${each.value}-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "60"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This metric monitors lambda errors for ${each.value}"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = each.key
  }
}

# Lambda Throttles Alarms
resource "aws_cloudwatch_metric_alarm" "lambda_throttles" {
  for_each            = var.lambda_functions
  alarm_name          = "${var.environment}-${each.value}-throttles"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "Throttles"
  namespace           = "AWS/Lambda"
  period              = "60"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This metric monitors lambda throttles for ${each.value}"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = each.key
  }
}

# API Gateway 5XX Errors
resource "aws_cloudwatch_metric_alarm" "api_gateway_5xx" {
  alarm_name          = "kaluna-${var.environment}-api-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "5XXError"
  namespace           = "AWS/ApiGateway"
  period              = "60"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "API Gateway 5XX errors exceeded threshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ApiId = var.api_gateway_id
  }
}

# API Gateway 4XX Errors
resource "aws_cloudwatch_metric_alarm" "api_gateway_4xx" {
  alarm_name          = "kaluna-${var.environment}-api-4xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "4XXError"
  namespace           = "AWS/ApiGateway"
  period              = "60"
  statistic           = "Sum"
  threshold           = "20"
  alarm_description   = "API Gateway 4XX errors exceeded threshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ApiId = var.api_gateway_id
  }
}

# CloudWatch Dashboard
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "Kaluna-${title(var.environment)}-Dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            for func_name in keys(var.lambda_functions) : [
              "AWS/Lambda", "Invocations", "FunctionName", func_name
            ]
          ]
          period = 300
          stat   = "Sum"
          region = "us-east-1"
          title  = "Lambda Invocations"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            for func_name in keys(var.lambda_functions) : [
              "AWS/Lambda", "Errors", "FunctionName", func_name
            ]
          ]
          period = 300
          stat   = "Sum"
          region = "us-east-1"
          title  = "Lambda Errors"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/ApiGateway", "Count", "ApiId", var.api_gateway_id],
            [".", "5XXError", ".", "."],
            [".", "4XXError", ".", "."]
          ]
          period = 300
          stat   = "Sum"
          region = "us-east-1"
          title  = "API Gateway Traffic and Errors"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", var.dynamodb_table_name],
            [".", "ConsumedWriteCapacityUnits", ".", "."]
          ]
          period = 300
          stat   = "Sum"
          region = "us-east-1"
          title  = "DynamoDB Capacity"
        }
      }
    ]
  })
}
