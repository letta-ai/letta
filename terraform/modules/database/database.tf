locals {
  # if env == prod use existing names for everything
  db_name = var.env == "prod" ? "${var.db_prefix}-db" : "${var.db_prefix}-${var.env}-${var.region}-db"
  cache_name = var.env == "prod" ? "${var.db_prefix}-redis" : "${var.db_prefix}-${var.env}-${var.region}-redis"
}
resource "google_sql_database_instance" "postgres" {
  name             = local.db_name
  database_version = "POSTGRES_15"
  region           = var.region

  settings {
    tier = var.db_tier
    insights_config {
      query_insights_enabled = true
      query_plans_per_minute = 5
      query_string_length = 1024
      record_application_tags = false
      record_client_address = false
    }

    ip_configuration {
      ipv4_enabled    = true
      private_network = var.vpc_network_id
    }
  }
  timeouts {}

  deletion_protection = true
}

resource "google_sql_database" "database" {
  name     = "memgpt"
  instance = google_sql_database_instance.postgres.name
}

resource "google_sql_user" "users" {
  name     = var.db_user
  instance = google_sql_database_instance.postgres.name
  password = var.db_password
}

resource "google_redis_instance" "cache" {
  name           = local.cache_name
  tier           = "STANDARD_HA"
  memory_size_gb = var.redis_memory_size_gb

  region = var.region

  authorized_network = var.vpc_network_id

  redis_version = "REDIS_6_X"
  display_name  = local.cache_name

}
