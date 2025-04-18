output "vpc_network_name" {
    value = google_compute_network.vpc_network.name
}
output "subnet_name" {
    value = google_compute_subnetwork.subnet.name
}
