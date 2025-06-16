CREATE MATERIALIZED VIEW otel.letta_metrics_histograms_5min_mv
            TO otel.letta_metrics_histograms_5min
            (
             `time_window` DateTime,
             `metric_name` String,
             `organization_id` String,
             `project_id` String,
             `base_template_id` String,
             `template_id` String,
             `agent_id` String,
             `tool_name` String,
             `model_name` String,
             `status_code` String,
             `endpoint_path` String,
             `count` Int64,
             `sum` Float64,
             `bucket_counts` Array(Int64),
             `explicit_bounds` Array(Float64)
                )
AS
SELECT toStartOfFiveMinute(toDateTime(TimeUnix)) AS time_window,
       MetricName                                AS metric_name,
       Attributes['organization.id']             AS organization_id,
       Attributes['project.id']                  AS project_id,
       Attributes['base_template.id']            AS base_template_id,
       Attributes['template.id']                 AS template_id,
       Attributes['agent.id']                    AS agent_id,
       Attributes['tool.name']                   AS tool_name,
       Attributes['model.name']                  AS model_name,
       Attributes['status_code']                 AS status_code,
       Attributes['endpoint_path']               AS endpoint_path,
       sum(Count)                                AS count,
       sum(Sum)                                  AS sum,
       sumForEach(BucketCounts)                  AS bucket_counts,
       any(ExplicitBounds)
FROM otel.otel_metrics_histogram
WHERE (ScopeName = 'letta.otel.metrics')
  AND (StartTimeUnix > '2025-06-13 22:30:00')
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
         11;
