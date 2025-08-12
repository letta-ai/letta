output "jump_box_external_ip" {
  description = "The external IP address of the jump box"
  value       = module.jump_box.jump_box_external_ip
}

output "jump_box_internal_ip" {
  description = "The internal IP address of the jump box"
  value       = module.jump_box.jump_box_internal_ip
}

output "ssh_command" {
  description = "SSH command to connect to the jump box (replace /path/to/private/key with actual path)"
  value       = module.jump_box.ssh_command
}

# Private key is managed outside of Terraform
