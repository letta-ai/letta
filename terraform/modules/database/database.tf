locals {
  db_name = "${var.db_prefix}-${var.env}-${var.region}"
}
resource "google_sql_database_instance" "postgres" {
  name             = "${local.db_name}-db"
  database_version = "POSTGRES_15"
  region           = var.region


  settings {
    tier = var.db_tier

    ip_configuration {
      ipv4_enabled    = false
      private_network = var.vpc_network_id
    }
  }

  deletion_protection = true
}

resource "google_sql_database" "database" {
  name     = "${local.db_name}"
  instance = google_sql_database_instance.postgres.name
}

resource "google_sql_user" "users" {
  name     = var.db_user
  instance = google_sql_database_instance.postgres.name
  password = var.db_password
}

resource "google_redis_instance" "cache" {
  name           = "${local.db_name}-redis"
  tier           = "STANDARD_HA"
  memory_size_gb = var.redis_memory_size_gb

  region = var.region

  authorized_network = var.vpc_network_id

  redis_version = "REDIS_6_X"
  display_name  = "${local.db_name} Redis Cache"

}
