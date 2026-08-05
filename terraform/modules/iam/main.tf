data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda_role" {
  name               = var.role_name
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
  
  tags = {
    Environment = var.environment
    Project     = "Kaluna"
  }
}

resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "dynamodb_access" {
  count = var.enable_dynamodb_access ? 1 : 0

  statement {
    effect = "Allow"
    actions = [
      "dynamodb:PutItem",
      "dynamodb:GetItem",
      "dynamodb:Scan",
      "dynamodb:Query",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
    ]
    resources = [
      var.dynamodb_table_arn,
      "${var.dynamodb_table_arn}/index/*"
    ]
  }
}

resource "aws_iam_role_policy" "dynamodb_policy" {
  count  = var.enable_dynamodb_access ? 1 : 0
  name   = "${var.role_name}-dynamodb-policy"
  role   = aws_iam_role.lambda_role.id
  policy = data.aws_iam_policy_document.dynamodb_access[0].json
}

data "aws_iam_policy_document" "ses_access" {
  count = var.enable_ses_send ? 1 : 0

  statement {
    effect = "Allow"
    actions = [
      "ses:SendEmail",
      "ses:SendRawEmail",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "ses_policy" {
  count  = var.enable_ses_send ? 1 : 0
  name   = "${var.role_name}-ses-policy"
  role   = aws_iam_role.lambda_role.id
  policy = data.aws_iam_policy_document.ses_access[0].json
}
