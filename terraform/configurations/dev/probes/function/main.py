# function/main.py
import functions_framework
import os
import json
from datetime import datetime
import requests
from google.cloud import secretmanager
import clickhouse_connect

# Initialize Secret Manager client
secret_client = secretmanager.SecretManagerServiceClient()

def get_secret(secret_id):
    """Fetch secret from Secret Manager"""
    project_id = os.environ.get('PROJECT_ID')
    name = f"projects/{project_id}/secrets/{secret_id}/versions/latest"
    response = secret_client.access_secret_version(request={"name": name})
    return response.payload.data.decode('UTF-8')

def send_slack_alert(message, alert_data):
    """Send alert to Slack"""
    webhook_url = get_secret("customer-alerting-bot-webhook")
    payload = {
        "text": f"🚨 Alert Triggered\n{message}",
    }
    response = requests.post(webhook_url, json=payload)
    response.raise_for_status()
    return response


@functions_framework.http
def check_alerts(request):
    """Main probe function"""
    try:
        # Get ClickHouse credentials
        password = get_secret("dev_memgpt-server_CLICKHOUSE_PASSWORD")
        clickhouse_host = os.environ.get("CLICKHOUSE_HOST")
        clickhouse_user = os.environ.get("CLICKHOUSE_USER")

        # Parse host URL to extract hostname
        if clickhouse_host.startswith("https://"):
            clickhouse_host = clickhouse_host[8:]
        elif clickhouse_host.startswith("http://"):
            clickhouse_host = clickhouse_host[7:]

        # Remove port from hostname if present
        if ":" in clickhouse_host:
            clickhouse_host = clickhouse_host.split(":")[0]

        # Create ClickHouse Connect client for ClickHouse Cloud
        client = clickhouse_connect.get_client(
            host=clickhouse_host,
            port=8443,
            username=clickhouse_user,
            password=password,
            database="otel",
            secure=True,
            verify=True,
        )

        project_id = os.environ.get("LETTA_PROJECT_ID")
        organization_id = os.environ.get("LETTA_ORGANIZATION_ID")
        project_name = os.environ.get("LETTA_PROJECT_NAME", "11x-deep-research")  # Allow override via env var

        if not project_id or not organization_id:
            return {"error": "project_id and organization_id are required"}, 400

        # First, get total agent runs in the last 5 minutes for percentage calculation
        total_runs_query = """
            SELECT COUNT(DISTINCT TraceId) as total_runs
            FROM otel_traces
            WHERE (SpanName = 'POST /v1/agents/{agent_id}/messages/stream' OR
                    SpanName = 'POST /v1/agents/{agent_id}/messages' OR
                    SpanName = 'POST /v1/agents/{agent_id}/messages/async')
                AND ParentSpanId = ''
                AND Timestamp >= now() - INTERVAL 5 MINUTE
                AND SpanAttributes['project.id'] = %(project_id)s
                AND SpanAttributes['organization.id'] = %(organization_id)s
        """

        total_result = client.query(total_runs_query, parameters={
            'project_id': project_id,
            'organization_id': organization_id,
        })

        total_runs = total_result.result_rows[0][0] if total_result.result_rows else 0
        print(f"Total agent runs in last 5 minutes: {total_runs}")

        # Now get problematic traces with separate counts
        query = """
            WITH parent_traces AS (
                SELECT
                    TraceId,
                    StatusMessage,
                    StatusCode,
                    SpanAttributes,
                    Duration,
                    Timestamp,
                    SpanAttributes['agent.id'] AS agent_id
                FROM otel_traces
                WHERE (SpanName = 'POST /v1/agents/{agent_id}/messages/stream' OR
                        SpanName = 'POST /v1/agents/{agent_id}/messages' OR
                        SpanName = 'POST /v1/agents/{agent_id}/messages/async')
                    AND ParentSpanId = ''
                    AND Timestamp >= now() - INTERVAL 5 MINUTE
                    AND SpanAttributes['project.id'] = %(project_id)s
                    AND SpanAttributes['organization.id'] = %(organization_id)s
            )
            SELECT
                a.TraceId,
                p.Timestamp AS parent_timestamp,
                formatDateTime(p.Timestamp, '%%Y-%%m-%%d %%H:%%i:%%S') AS formatted_time_utc,
                p.Duration / 60000000000.0 AS parent_duration_minutes,

                -- Accurate wall clock: find the actual last end time minus first start time
                (max(toUnixTimestamp(a.Timestamp) + a.Duration / 1000000000.0) - min(toUnixTimestamp(a.Timestamp))) / 60.0 AS wall_clock_minutes,

                count() AS agent_step_count,
                sumIf(1, arrayExists(
                    event -> event.Attributes['success'] = 'false',
                    a.Events
                )) AS tool_error_count,
                p.agent_id,

                -- Get failed tool names for debugging
                arrayDistinct(arrayFilter(
                    x -> x != '',
                    arrayFlatten(arrayMap(
                        events -> arrayMap(
                            event -> if(event.Attributes['success'] = 'false',
                                       toString(event.Attributes['tool_name']),
                                       ''),
                            events
                        ),
                        groupArray(a.Events)
                    ))
                )) AS failed_tools,

                -- Categorize the issue type
                CASE
                    WHEN sumIf(1, arrayExists(event -> event.Attributes['success'] = 'false', a.Events)) > 0
                         AND (max(toUnixTimestamp(a.Timestamp) + a.Duration / 1000000000.0) - min(toUnixTimestamp(a.Timestamp))) / 60.0 >= 5.0
                    THEN 'BOTH'
                    WHEN sumIf(1, arrayExists(event -> event.Attributes['success'] = 'false', a.Events)) > 0
                    THEN 'TOOL_ERROR'
                    WHEN (max(toUnixTimestamp(a.Timestamp) + a.Duration / 1000000000.0) - min(toUnixTimestamp(a.Timestamp))) / 60.0 >= 5.0
                    THEN 'TIMEOUT'
                    ELSE 'UNKNOWN'
                END AS issue_type

            FROM otel_traces a
            JOIN parent_traces p ON a.TraceId = p.TraceId
            WHERE a.SpanName = 'agent_step'
            GROUP BY a.TraceId, p.StatusMessage, p.Duration, p.StatusCode, p.SpanAttributes, p.Timestamp, p.agent_id
            HAVING wall_clock_minutes >= 5.0
                OR tool_error_count > 0
            ORDER BY parent_timestamp DESC
        """

        print(f"Executing query for project_id: {project_id} and organization_id: {organization_id}...")

        result = client.query(query, parameters={
            'project_id': project_id,
            'organization_id': organization_id,
        })

        # Convert result to list of dictionaries
        traces = []
        tool_error_traces = []
        timeout_traces = []

        if result and result.result_rows:
            column_names = result.column_names
            for row in result.result_rows:
                trace_dict = dict(zip(column_names, row))
                traces.append(trace_dict)

                # Categorize traces
                if trace_dict['issue_type'] in ['TOOL_ERROR', 'BOTH']:
                    tool_error_traces.append(trace_dict)
                if trace_dict['issue_type'] in ['TIMEOUT', 'BOTH']:
                    timeout_traces.append(trace_dict)

        print(f"Found {len(traces)} problematic traces total")
        print(f"  - {len(tool_error_traces)} with tool errors")
        print(f"  - {len(timeout_traces)} with timeouts")

        # Calculate error rate
        tool_error_rate = (len(tool_error_traces) / total_runs * 100) if total_runs > 0 else 0
        timeout_rate = (len(timeout_traces) / total_runs * 100) if total_runs > 0 else 0

        print(f"Tool error rate: {tool_error_rate:.2f}%")
        print(f"Timeout rate: {timeout_rate:.2f}%")

        alerts_to_send = []
        response = ""

        # Check if tool error rate exceeds threshold
        if tool_error_rate >= 10.0:
            alert_msg = f"⚠️ **Tool Error Rate Alert**\n"
            alert_msg += f"Tool error rate is {tool_error_rate:.2f}% ({len(tool_error_traces)}/{total_runs} runs)\n\n"
            alert_msg += "Recent failures:\n"

            for trace in tool_error_traces[:5]:  # Show first 5
                agent_link = f"<https://app.letta.com/projects/{project_name}/agents/{trace['agent_id']}| {trace['agent_id']}...>"
                failed_tools_str = f" - Failed tools: {', '.join(trace['failed_tools'])}" if trace.get('failed_tools') else ""
                alert_msg += f"• {agent_link} at {trace['formatted_time_utc']} UTC - {trace['tool_error_count']} tool errors{failed_tools_str}\n"

            if len(tool_error_traces) > 5:
                alert_msg += f"... and {len(tool_error_traces) - 5} more\n"

            alerts_to_send.append(alert_msg)
            response += alert_msg + "\n"

        # Always alert on timeouts (these are critical)
        if timeout_traces:
            alert_msg = f"⏱️ **Timeout Alert**\n"
            alert_msg += f"{len(timeout_traces)} agent runs exceeded 5 minutes:\n\n"

            for trace in timeout_traces:
                agent_link = f"<https://app.letta.com/projects/{project_name}/agents/{trace['agent_id']}| {trace['agent_id']}...>"
                alert_msg += f"• {agent_link} ran for {trace['wall_clock_minutes']:.2f} minutes at {trace['formatted_time_utc']} UTC\n"

            alerts_to_send.append(alert_msg)
            response += alert_msg + "\n"

        # Send alerts if any
        if alerts_to_send:
            combined_alert = "\n---\n".join(alerts_to_send)
            combined_alert += f"\n\n📊 Stats: {total_runs} total runs in last 5 minutes"
            send_slack_alert(combined_alert, {
                "tool_error_rate": tool_error_rate,
                "timeout_count": len(timeout_traces),
                "total_runs": total_runs
            })

        return {
            "status": "ok",
            "total_runs": total_runs,
            "tool_error_rate": f"{tool_error_rate:.2f}%",
            "timeout_count": len(timeout_traces),
            "alerts_sent": len(alerts_to_send) > 0,
            "body": response if response else "No alerts triggered",
        }, 200

    except Exception as e:
        error_msg = f"Probe failed: {str(e)}"
        print(f"ERROR: {error_msg}")

        # Send error to Slack
        try:
            send_slack_alert(f"❌ Probe execution failed:\n```{error_msg}```", {"error": str(e)})
        except:
            pass  # Don't fail the function if Slack notification fails

        return {"status": "error", "error": str(e)}, 500
