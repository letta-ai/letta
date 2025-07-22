output "service_account_email" {
  description = "Email of the GPU runner service account"
  value       = module.gpu_runners.service_account_email
}

output "instance_group_manager_name" {
  description = "Name of the instance group manager"
  value       = module.gpu_runners.instance_group_manager_name
}

output "instance_template_name" {
  description = "Name of the instance template"
  value       = module.gpu_runners.instance_template_name
}
