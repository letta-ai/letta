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
             `count` Int64,
             `sum` Float64,
             `bucket_counts` Array(Int64),
             `explicit_bounds` Array(Float64)
                )
AS
WITH raw_counts AS
         (SELECT MetricName                                                                                                    AS metric_name,
                 mapSort(Attributes)                                                                                           AS Attributes,
                 TimeUnix                                                                                                      AS time_unix,
                 StartTimeUnix                                                                                                 AS start_time_unix,
                 Count - lagInFrame(Count, 1, 0)
                                    OVER (PARTITION BY MetricName, mapSort(Attributes), StartTimeUnix ORDER BY TimeUnix ASC)   AS gap_count,
                 Sum - lagInFrame(Sum, 1, 0)
                                  OVER (PARTITION BY MetricName, mapSort(Attributes), StartTimeUnix ORDER BY TimeUnix ASC)     AS gap_sum,
                 arrayMap((x, y) -> (x - y), BucketCounts,
                          lagInFrame(BucketCounts, 1, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
                                     OVER (PARTITION BY MetricName, mapSort(Attributes), StartTimeUnix ORDER BY TimeUnix ASC)) AS gap_bucket_counts,
                 ExplicitBounds                                                                                                AS explicit_bounds
          FROM otel.otel_metrics_histogram
          WHERE ScopeName = 'letta.otel.metrics'),
     grouped AS
         (SELECT metric_name,
                 toStartOfFiveMinute(toDateTime(time_unix)) AS time_window,
                 Attributes,
                 sum(gap_count)                             AS count,
                 sum(gap_sum)                               AS sum,
                 sumForEach(gap_bucket_counts)              AS bucket_counts,
                 any(explicit_bounds)                       AS explicit_bounds
          FROM raw_counts
          GROUP BY 1,
                   2,
                   3
          HAVING sum(gap_count) > 0)
SELECT time_window                    AS time_window,
       metric_name,
       Attributes['organization.id']  AS organization_id,
       Attributes['project.id']       AS project_id,
       Attributes['base_template.id'] AS base_template_id,
       Attributes['template.id']      AS template_id,
       Attributes['agent.id']         AS agent_id,
       Attributes['tool.name']        AS tool_name,
       Attributes['model.name']       AS model_name,
       count,
       sum,
       bucket_counts,
       explicit_bounds
FROM grouped
ORDER BY organization_id ASC,
         project_id ASC,
         metric_name ASC,
         time_window ASC;

