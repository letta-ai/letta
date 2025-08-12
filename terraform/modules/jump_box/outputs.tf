output "jump_box_external_ip" {
  description = "The external IP address of the jump box"
  value       = google_compute_instance.jump_box.network_interface[0].access_config[0].nat_ip
}

output "jump_box_internal_ip" {
  description = "The internal IP address of the jump box"
  value       = google_compute_instance.jump_box.network_interface[0].network_ip
}

output "jump_box_instance_name" {
  description = "The name of the jump box instance"
  value       = google_compute_instance.jump_box.name
}

output "jump_box_zone" {
  description = "The zone where the jump box is located"
  value       = google_compute_instance.jump_box.zone
}

output "ssh_username" {
  description = "Username for SSH access"
  value       = var.ssh_username
}

output "ssh_command" {
  description = "SSH command to connect to the jump box"
  value       = "ssh -i /path/to/private/key ${var.ssh_username}@${google_compute_instance.jump_box.network_interface[0].access_config[0].nat_ip}"
}
