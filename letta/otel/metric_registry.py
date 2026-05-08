from dataclasses import dataclass, field
from functools import partial

from opentelemetry import metrics
from opentelemetry.metrics import Counter, Histogram, UpDownCounter
from opentelemetry.metrics._internal import Gauge

from letta.helpers.singleton import singleton
from letta.otel.metrics import get_letta_meter


@singleton
@dataclass(frozen=True)
class MetricRegistry:
    """Registry of all application metrics

    Metrics are composed of the following:
        - name
        - description
        - unit: UCUM unit of the metric (i.e. 'By' for bytes, 'ms' for milliseconds, '1' for count
        - bucket_bounds (list[float] | None): the explicit bucket bounds for histogram metrics

        and instruments are of types Counter, Histogram, and Gauge

    The relationship between the various models is as follows:
        project_id -N:1-> base_template_id -N:1-> template_id -N:1-> agent_id
        agent_id -1:1+-> model_name
        agent_id -1:N -> tool_name
    """

    Instrument = Counter | Histogram | Gauge | UpDownCounter
    _metrics: dict[str, Instrument] = field(default_factory=dict, init=False)
    _meter: metrics.Meter = field(init=False)

    def __post_init__(self):
        object.__setattr__(self, "_meter", get_letta_meter())

    def _get_or_create_metric(self, name: str, factory):
        """Lazy initialization of metrics."""
        if name not in self._metrics:
            self._metrics[name] = factory()
        return self._metrics[name]

    # (includes base attributes: project, template_base, template, agent)
    @property
    def user_message_counter(self) -> Counter:
        return self._get_or_create_metric(
            "count_user_message",
            partial(
                self._meter.create_counter,
                name="count_user_message",
                description="Counts the number of messages sent by the user",
                unit="1",
            ),
        )

    @property
    def in_flight_foreground_counter(self) -> UpDownCounter:
        return self._get_or_create_metric(
            "in_flight_foreground",
            partial(
                self._meter.create_up_down_counter,
                name="in_flight_foreground",
                description="Number of active foreground request streams.",
                unit="1",
            ),
        )

    @property
    def in_flight_background_counter(self) -> UpDownCounter:
        return self._get_or_create_metric(
            "in_flight_background",
            partial(
                self._meter.create_up_down_counter,
                name="in_flight_background",
                description="Number of active background stream processing tasks.",
                unit="1",
            ),
        )

    @property
    def request_admission_wait_ms_histogram(self) -> Histogram:
        return self._get_or_create_metric(
            "request_admission_wait_ms",
            partial(
                self._meter.create_histogram,
                name="request_admission_wait_ms",
                description="Time spent waiting for request admission control.",
                unit="ms",
            ),
        )

    @property
    def request_timeout_counter(self) -> Counter:
        return self._get_or_create_metric(
            "request_timeout_total",
            partial(
                self._meter.create_counter,
                name="request_timeout_total",
                description="Total number of timed out requests.",
                unit="1",
            ),
        )

    # (includes tool_name, tool_execution_success, & step_id on failure)
    @property
    def tool_execution_counter(self) -> Counter:
        return self._get_or_create_metric(
            "count_tool_execution",
            partial(
                self._meter.create_counter,
                name="count_tool_execution",
                description="Counts the number of tools executed.",
                unit="1",
            ),
        )

    # project_id + model
    @property
    def ttft_ms_histogram(self) -> Histogram:
        return self._get_or_create_metric(
            "hist_ttft_ms",
            partial(
                self._meter.create_histogram,
                name="hist_ttft_ms",
                description="Histogram for the Time to First Token (ms)",
                unit="ms",
            ),
        )

    # (includes model name)
    @property
    def llm_execution_time_ms_histogram(self) -> Histogram:
        return self._get_or_create_metric(
            "hist_llm_execution_time_ms",
            partial(
                self._meter.create_histogram,
                name="hist_llm_execution_time_ms",
                description="Histogram for LLM execution time (ms)",
                unit="ms",
            ),
        )

    # (includes tool name)
    @property
    def tool_execution_time_ms_histogram(self) -> Histogram:
        return self._get_or_create_metric(
            "hist_tool_execution_time_ms",
            partial(
                self._meter.create_histogram,
                name="hist_tool_execution_time_ms",
                description="Histogram for tool execution time (ms)",
                unit="ms",
            ),
        )

    @property
    def step_execution_time_ms_histogram(self) -> Histogram:
        return self._get_or_create_metric(
            "hist_step_execution_time_ms",
            partial(
                self._meter.create_histogram,
                name="hist_step_execution_time_ms",
                description="Histogram for step execution time (ms)",
                unit="ms",
            ),
        )

    # TODO (cliandy): instrument this
    @property
    def message_cost(self) -> Histogram:
        return self._get_or_create_metric(
            "hist_message_cost_usd",
            partial(
                self._meter.create_histogram,
                name="hist_message_cost_usd",
                description="Histogram for cost of messages (usd) per step",
                unit="usd",
            ),
        )

    # (includes model name)
    @property
    def message_output_tokens(self) -> Histogram:
        return self._get_or_create_metric(
            "hist_message_output_tokens",
            partial(
                self._meter.create_histogram,
                name="hist_message_output_tokens",
                description="Histogram for output tokens generated by LLM per step",
                unit="1",
            ),
        )

    # (includes endpoint_path, method, status_code)
    @property
    def endpoint_e2e_ms_histogram(self) -> Histogram:
        return self._get_or_create_metric(
            "hist_endpoint_e2e_ms",
            partial(
                self._meter.create_histogram,
                name="hist_endpoint_e2e_ms",
                description="Histogram for endpoint e2e time (ms)",
                unit="ms",
            ),
        )

    # (includes endpoint_path, method, status_code)
    @property
    def endpoint_request_counter(self) -> Counter:
        return self._get_or_create_metric(
            "count_endpoint_requests",
            partial(
                self._meter.create_counter,
                name="count_endpoint_requests",
                description="Counts the number of endpoint requests",
                unit="1",
            ),
        )

    @property
    def file_process_bytes_histogram(self) -> Histogram:
        return self._get_or_create_metric(
            "hist_file_process_bytes",
            partial(
                self._meter.create_histogram,
                name="hist_file_process_bytes",
                description="Histogram for file process in bytes",
                unit="By",
            ),
        )

    # (includes route_class)
    @property
    def sse_active_sessions_counter(self) -> UpDownCounter:
        return self._get_or_create_metric(
            "sse_active_sessions",
            partial(
                self._meter.create_up_down_counter,
                name="sse_active_sessions",
                description="Number of active SSE streaming sessions.",
                unit="1",
            ),
        )

    # (includes reason)
    @property
    def readiness_state_gauge(self) -> Gauge:
        return self._get_or_create_metric(
            "readiness_state",
            partial(
                self._meter.create_gauge,
                name="readiness_state",
                description="Current readiness telemetry state encoded as one-hot reason labels.",
                unit="1",
            ),
        )

    # (includes reason, route_class)
    @property
    def sse_disconnect_counter(self) -> Counter:
        return self._get_or_create_metric(
            "sse_disconnect_total",
            partial(
                self._meter.create_counter,
                name="sse_disconnect_total",
                description="Total number of non-clean SSE stream terminations.",
                unit="1",
            ),
        )

    # (includes route_class)
    @property
    def sse_duration_ms_histogram(self) -> Histogram:
        return self._get_or_create_metric(
            "sse_duration_ms",
            partial(
                self._meter.create_histogram,
                name="sse_duration_ms",
                description="Lifetime duration of SSE stream sessions.",
                unit="ms",
            ),
        )

    # Runtime saturation and dependency timeout metrics
    @property
    def event_loop_lag_ms_histogram(self) -> Histogram:
        return self._get_or_create_metric(
            "event_loop_lag_ms",
            partial(
                self._meter.create_histogram,
                name="event_loop_lag_ms",
                description="Event loop scheduling lag measured by the watchdog heartbeat.",
                unit="ms",
            ),
        )

    @property
    def executor_backlog_gauge(self) -> Gauge:
        return self._get_or_create_metric(
            "executor_backlog",
            partial(
                self._meter.create_gauge,
                name="executor_backlog",
                description="Best-effort backlog depth of the default event-loop executor queue.",
                unit="1",
            ),
        )

    @property
    def asyncio_task_count_gauge(self) -> Gauge:
        return self._get_or_create_metric(
            "asyncio_task_count",
            partial(
                self._meter.create_gauge,
                name="asyncio_task_count",
                description="Number of active asyncio tasks on the event loop.",
                unit="1",
            ),
        )

    # (includes operation)
    @property
    def redis_timeout_counter(self) -> Counter:
        return self._get_or_create_metric(
            "redis_timeout_total",
            partial(
                self._meter.create_counter,
                name="redis_timeout_total",
                description="Total number of Redis operation timeout errors.",
                unit="1",
            ),
        )

    # (includes provider)
    @property
    def provider_timeout_counter(self) -> Counter:
        return self._get_or_create_metric(
            "provider_timeout_total",
            partial(
                self._meter.create_counter,
                name="provider_timeout_total",
                description="Total number of model provider timeout errors.",
                unit="1",
            ),
        )

    # Database connection pool metrics
    # (includes engine_name, pool_mode)
    @property
    def db_pool_in_use_gauge(self) -> Gauge:
        return self._get_or_create_metric(
            "db_pool_in_use",
            partial(
                self._meter.create_gauge,
                name="db_pool_in_use",
                description="Number of database connections currently in use by the client pool.",
                unit="1",
            ),
        )

    # (includes engine_name, pool_mode)
    @property
    def db_pool_waiters_gauge(self) -> Gauge:
        return self._get_or_create_metric(
            "db_pool_waiters",
            partial(
                self._meter.create_gauge,
                name="db_pool_waiters",
                description="Estimated number of waiters blocked on DB client pool checkout.",
                unit="1",
            ),
        )

    # (includes engine_name, pool_mode)
    @property
    def db_pool_utilization_ratio_gauge(self) -> Gauge:
        return self._get_or_create_metric(
            "db_pool_utilization_ratio",
            partial(
                self._meter.create_gauge,
                name="db_pool_utilization_ratio",
                description="Ratio of checked-out base pool connections to configured pool size (excludes overflow).",
                unit="1",
            ),
        )

    # (includes engine_name, pool_mode)
    @property
    def db_pool_checkout_timeout_counter(self) -> Counter:
        return self._get_or_create_metric(
            "db_pool_checkout_timeout_total",
            partial(
                self._meter.create_counter,
                name="db_pool_checkout_timeout_total",
                description="Total number of DB client pool checkout timeout errors.",
                unit="1",
            ),
        )

    # (includes engine_name, pool_mode)
    @property
    def db_checkout_latency_ms_histogram(self) -> Histogram:
        return self._get_or_create_metric(
            "db_checkout_latency_ms",
            partial(
                self._meter.create_histogram,
                name="db_checkout_latency_ms",
                description="Latency of checking out a DB connection from the client pool.",
                unit="ms",
            ),
        )

    # (includes engine_name)
    @property
    def db_pool_connections_total_gauge(self) -> Gauge:
        return self._get_or_create_metric(
            "gauge_db_pool_connections_total",
            partial(
                self._meter.create_gauge,
                name="gauge_db_pool_connections_total",
                description="Total number of connections in the database pool",
                unit="1",
            ),
        )

    # (includes engine_name)
    @property
    def db_pool_connections_checked_out_gauge(self) -> Gauge:
        return self._get_or_create_metric(
            "gauge_db_pool_connections_checked_out",
            partial(
                self._meter.create_gauge,
                name="gauge_db_pool_connections_checked_out",
                description="Number of connections currently checked out from the pool",
                unit="1",
            ),
        )

    # (includes engine_name)
    @property
    def db_pool_connections_available_gauge(self) -> Gauge:
        return self._get_or_create_metric(
            "gauge_db_pool_connections_available",
            partial(
                self._meter.create_gauge,
                name="gauge_db_pool_connections_available",
                description="Number of available connections in the pool",
                unit="1",
            ),
        )

    # (includes engine_name)
    @property
    def db_pool_connections_overflow_gauge(self) -> Gauge:
        return self._get_or_create_metric(
            "gauge_db_pool_connections_overflow",
            partial(
                self._meter.create_gauge,
                name="gauge_db_pool_connections_overflow",
                description="Number of overflow connections in the pool",
                unit="1",
            ),
        )

    # (includes engine_name)
    @property
    def db_pool_connection_duration_ms_histogram(self) -> Histogram:
        return self._get_or_create_metric(
            "hist_db_pool_connection_duration_ms",
            partial(
                self._meter.create_histogram,
                name="hist_db_pool_connection_duration_ms",
                description="Duration of database connection usage in milliseconds",
                unit="ms",
            ),
        )

    # (includes engine_name, event)
    @property
    def db_pool_connection_events_counter(self) -> Counter:
        return self._get_or_create_metric(
            "count_db_pool_connection_events",
            partial(
                self._meter.create_counter,
                name="count_db_pool_connection_events",
                description="Count of database connection pool events (connect, checkout, checkin, invalidate)",
                unit="1",
            ),
        )

    # (includes engine_name, exception_type)
    @property
    def db_pool_connection_errors_counter(self) -> Counter:
        return self._get_or_create_metric(
            "count_db_pool_connection_errors",
            partial(
                self._meter.create_counter,
                name="count_db_pool_connection_errors",
                description="Count of database connection pool errors",
                unit="1",
            ),
        )
