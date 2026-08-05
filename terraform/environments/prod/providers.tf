terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "kaluna-terraform-state-496795891920"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "kaluna-terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = "us-east-1"
}
