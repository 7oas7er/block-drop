variable "aws_region" {
  description = "Region for the Grafana CloudWatch IAM role (eu-north-1)."
  type        = string
  default     = "eu-north-1"
}

variable "aws_profile" {
  description = "Shared credentials / config profile for the AWS provider."
  type        = string
  default     = "7oas7er"
}

variable "stack_slug" {
  description = "Grafana Cloud stack slug (from the Grafana Cloud portal URL / stack settings)."
  type        = string
}

variable "cloud_access_policy_token" {
  description = "Grafana Cloud access policy token with stacks:read (and related) scopes. Prefer GRAFANA_CLOUD_ACCESS_POLICY_TOKEN."
  type        = string
  sensitive   = true
}

variable "cloud_provider_access_token" {
  description = "Access policy token with integration-management:read|write and stacks:read. Prefer GRAFANA_CLOUD_PROVIDER_ACCESS_TOKEN."
  type        = string
  sensitive   = true
}

variable "grafana_aws_external_id" {
  description = <<-EOT
    Optional override for the IAM trust sts:ExternalId.
    Defaults to the stack prometheus_user_id. If Cloud Provider account
    create returns aws_authentication_error with no AssumeRole in CloudTrail,
    copy the External ID from Grafana → Cloud Provider → AWS → Add account
    and set it here.
  EOT
  type        = string
  default     = null
  nullable    = true
}

variable "enable_cloudwatch_scrape" {
  description = <<-EOT
    Create Grafana Cloud Provider AWS account + CloudWatch scrape job.
    Keep false while Grafana returns aws_authentication_error without
    calling STS (see README). IAM role is still managed so linking can
    be re-enabled later.
  EOT
  type        = bool
  default     = false
}

variable "sm_url" {
  description = "Optional override for Synthetic Monitoring API URL. Defaults to the stack sm_url from Grafana Cloud."
  type        = string
  default     = null
  nullable    = true
}

variable "sm_access_token" {
  description = "Synthetic Monitoring access token (Synthetics → Config). Prefer GRAFANA_SM_ACCESS_TOKEN."
  type        = string
  sensitive   = true
}

variable "prod_site_url" {
  description = "Production site URL to monitor."
  type        = string
  default     = "https://blockdrop.7oas7er.com"
}

variable "stg_site_url" {
  description = "Staging site URL to monitor."
  type        = string
  default     = "https://blockdrop-stg.7oas7er.com"
}

variable "prod_check_frequency_ms" {
  description = "Production synthetic check interval in milliseconds (default 5m)."
  type        = number
  default     = 300000
}

variable "stg_check_frequency_ms" {
  description = "Staging synthetic check interval in milliseconds (default 15m; keeps Free SM volume down)."
  type        = number
  default     = 900000
}

variable "check_timeout_ms" {
  description = "Synthetic check timeout in milliseconds."
  type        = number
  default     = 10000
}
