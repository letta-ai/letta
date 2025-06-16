CREATE MATERIALIZED VIEW otel.letta_metrics_counters_5min_mv
            TO otel.letta_metrics_counters_5min
            (
             `time_window` DateTime,
             `metric_name` String,
             `organization_id` String,
             `project_id` String,
             `base_template_id` String,
             `template_id` String,
             `agent_id` String,
             `tool_name` String,
             `step_id` String,
             `tool_execution_success` String,
             `status_code` String,
             `endpoint_path` String,
             `value` Float64
                )
AS
    SELECT toStartOfFiveMinute(toDateTime(TimeUnix))  AS time_window,
       MetricName                           AS metric_name,
       Attributes['organization.id']        AS organization_id,
       Attributes['project.id']             AS project_id,
       Attributes['base_template.id']       AS base_template_id,
       Attributes['template.id']            AS template_id,
       Attributes['agent.id']               AS agent_id,
       Attributes['tool.name']              AS tool_name,
       Attributes['step.id']                AS step_id,
       Attributes['tool.execution_success'] AS tool_execution_success,
       Attributes['status_code']            AS status_code,
       Attributes['endpoint_path']          AS endpoint_path,
       sum(Value)                           AS value
FROM otel.otel_metrics_sum
WHERE (ScopeName = 'letta.otel.metrics')
  AND (AggTemp = 1)
GROUP BY 1,
         2,
         3,
         4,
         5,
         6,
         7,
         8,
         9,
         10,
         11,
         12;
