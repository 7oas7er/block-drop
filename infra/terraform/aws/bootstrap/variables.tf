variable "aws_region" {
  description = "Region for the Terraform state bucket."
  type        = string
  default     = "eu-north-1"
}

variable "aws_profile" {
  description = "Shared credentials / config profile for the AWS provider."
  type        = string
  default     = "7oas7er"
}

variable "state_bucket_name" {
  description = "S3 bucket that stores remote Terraform state."
  type        = string
  default     = "shared-block-drop-terraform-state-bucket"
}
