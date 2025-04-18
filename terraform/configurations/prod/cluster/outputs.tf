output "cluster_endpoint" {
  value = google_container_cluster.primary.endpoint
}

output "letta_web_static_ip" {
  value = google_compute_global_address.letta_web_static_ip.address
  description = "The static IP address for the letta-web service"
}
