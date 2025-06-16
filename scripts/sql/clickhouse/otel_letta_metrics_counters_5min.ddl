create table otel.letta_metrics_counters_5min
(
    time_window            DateTime,
    metric_name            String,
    organization_id        String,
    project_id             String,
    base_template_id       String,
    template_id            String,
    agent_id               String,
    tool_name              String,
    step_id                String,
    tool_execution_success String,
    status_code            String,
    endpoint_path          String,
    value                  Float64
)
    engine = SharedMergeTree('/clickhouse/tables/{uuid}/{shard}', '{replica}')
        PARTITION BY toYYYYMM(time_window)
        ORDER BY (organization_id, project_id, metric_name, time_window)
        SETTINGS index_granularity = 8192;
