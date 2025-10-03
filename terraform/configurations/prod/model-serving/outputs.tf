output "vllm_server_private_ip" {
  value = google_compute_instance.letta_model_server.network_interface[0].network_ip
  description = "Private IP address of the vLLM server"
}

output "vllm_server_url" {
  value = "http://${google_compute_instance.letta_model_server.network_interface[0].network_ip}:8000"
  description = "Private URL to access the vLLM server"
}
