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
             `value` Float64
                )
AS
WITH raw_counts AS
         (SELECT MetricName                                                                                                  AS metric_name,
                 mapSort(Attributes)                                                                                         AS Attributes,
                 TimeUnix                                                                                                    AS time_unix,
                 StartTimeUnix                                                                                               AS start_time_unix,
                 Value - lagInFrame(Value, 1, 0)
                                    OVER (PARTITION BY MetricName, mapSort(Attributes), StartTimeUnix ORDER BY TimeUnix ASC) AS gap_val
          FROM otel.otel_metrics_sum
          WHERE ScopeName = 'letta.otel.metrics'),
     grouped AS
         (SELECT metric_name,
                 toStartOfFiveMinute(toDateTime(time_unix)) AS time_window,
                 Attributes,
                 sum(gap_val)                               AS value
          FROM raw_counts
          GROUP BY 1,
                   2,
                   3
          HAVING sum(gap_val) > 0)
SELECT time_window                          AS time_window,
       metric_name,
       Attributes['organization.id']        AS organization_id,
       Attributes['project.id']             AS project_id,
       Attributes['base_template.id']       AS base_template_id,
       Attributes['template.id']            AS template_id,
       Attributes['agent.id']               AS agent_id,
       Attributes['tool.name']              AS tool_name,
       Attributes['step.id']                AS step_id,
       Attributes['tool.execution_success'] AS tool_execution_success,
       value
FROM grouped
ORDER BY organization_id ASC,
         project_id ASC,
         metric_name ASC,
         time_window ASC;

