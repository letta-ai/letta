#!/bin/bash
# Diagnostic monitor that runs in background and dumps state when health checks fail

HEALTH_URL="http://localhost:8083/v1/health/"
CHECK_INTERVAL=5
CONSECUTIVE_FAILURES=0
DIAGNOSTIC_TRIGGERED=false

echo "[DIAGNOSTIC_MONITOR] Started monitoring $HEALTH_URL every ${CHECK_INTERVAL}s"

while true; do
    sleep $CHECK_INTERVAL

    # Try health check with 10s timeout (same as K8s probe)
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$HEALTH_URL" 2>/dev/null)

    if [ "$HTTP_CODE" = "200" ]; then
        # Health check passed
        if [ $CONSECUTIVE_FAILURES -gt 0 ]; then
            echo "[DIAGNOSTIC_MONITOR] Health check recovered after $CONSECUTIVE_FAILURES failures"
        fi
        CONSECUTIVE_FAILURES=0
        DIAGNOSTIC_TRIGGERED=false
    else
        # Health check failed
        CONSECUTIVE_FAILURES=$((CONSECUTIVE_FAILURES + 1))
        echo "[DIAGNOSTIC_MONITOR] Health check FAILED (attempt $CONSECUTIVE_FAILURES, HTTP code: $HTTP_CODE)"

        # Trigger diagnostics after 2 consecutive failures (before K8s kills us)
        if [ $CONSECUTIVE_FAILURES -ge 2 ] && [ "$DIAGNOSTIC_TRIGGERED" = false ]; then
            DIAGNOSTIC_TRIGGERED=true
            TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S")
            echo "[DIAGNOSTIC_MONITOR] ====== TRIGGERING DIAGNOSTICS at $TIMESTAMP ======"

            # Dump Python process info
            echo "[DIAGNOSTIC_MONITOR] === Process Tree ==="
            ps auxf 2>&1 || echo "ps failed"

            echo "[DIAGNOSTIC_MONITOR] === Python Process Details ==="
            PYTHON_PID=$(pgrep -f "python.*server" | head -1)
            if [ -n "$PYTHON_PID" ]; then
                echo "Python PID: $PYTHON_PID"
                echo "--- /proc/$PYTHON_PID/status ---"
                cat /proc/$PYTHON_PID/status 2>&1 || echo "Cannot read status"

                echo "--- Thread count ---"
                ls /proc/$PYTHON_PID/task 2>&1 | wc -l || echo "Cannot count threads"

                echo "--- Open files ---"
                ls -l /proc/$PYTHON_PID/fd 2>&1 | wc -l || echo "Cannot count fds"

                echo "--- Thread stack traces (via py-spy if available) ---"
                if command -v py-spy &> /dev/null; then
                    timeout 5 py-spy dump --pid $PYTHON_PID 2>&1 || echo "py-spy failed"
                else
                    echo "py-spy not installed"
                fi

                echo "--- System stack trace (via pstack/gdb if available) ---"
                if command -v gdb &> /dev/null; then
                    timeout 5 gdb -batch -ex "thread apply all bt" -p $PYTHON_PID 2>&1 || echo "gdb failed"
                else
                    echo "gdb not available"
                fi
            else
                echo "Could not find Python process"
            fi

            echo "[DIAGNOSTIC_MONITOR] === Network/Port Status ==="
            netstat -tlnp 2>&1 | grep 8083 || echo "netstat failed"

            echo "[DIAGNOSTIC_MONITOR] === Memory Info ==="
            free -h 2>&1 || echo "free failed"

            echo "[DIAGNOSTIC_MONITOR] === Recent Logs (last 100 lines) ==="
            tail -100 /proc/$PYTHON_PID/fd/1 2>&1 || echo "Cannot read stdout"

            echo "[DIAGNOSTIC_MONITOR] ====== DIAGNOSTICS COMPLETE ======"
        fi
    fi
done
