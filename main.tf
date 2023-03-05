variable "gcp_svc_key" {
  type = string
}

variable "gcp_project" {
  type = string
}

variable "gcp_region" {
  type = string
}

variable "folder_path"  {
  type = string
}
# GCP provider
provider "google" {
  credentials  = file(var.gcp_svc_key)
  project      = var.gcp_project
  region       = var.gcp_region
}

# GCP beta provider
provider "google-beta" {
  credentials  = file(var.gcp_svc_key)
  project      = var.gcp_project
  region       = var.gcp_region
}