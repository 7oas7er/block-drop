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

variable "cloud_provider_url" {
  description = "Grafana Cloud Provider API URL for the stack region (from stack details or Connections)."
  type        = string
}

variable "cloud_provider_access_token" {
  description = "Access policy token with integration-management:read|write and stacks:read. Prefer GRAFANA_CLOUD_PROVIDER_ACCESS_TOKEN."
  type        = string
  sensitive   = true
}

variable "sm_url" {
  description = "Synthetic Monitoring API URL for the stack region (Synthetics → Config)."
  type        = string
}

variable "sm_access_token" {
  description = "Synthetic Monitoring access token (Synthetics → Config). Prefer GRAFANA_SM_ACCESS_TOKEN."
  type        = string
  sensitive   = true
}

variable "grafana_aws_external_id" {
  description = "External ID from Grafana Cloud AWS account setup (Prometheus details / Create AWS account). Required for the IAM trust policy."
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

variable "check_frequency_ms" {
  description = "Synthetic check interval in milliseconds."
  type        = number
  default     = 300000
}

variable "check_timeout_ms" {
  description = "Synthetic check timeout in milliseconds."
  type        = number
  default     = 10000
}
