#!/bin/bash

set -e

LOG_FILE="/var/log/spot-preemption-monitor.log"
METADATA_URL="http://metadata.google.internal/computeMetadata/v1/instance/preempted"
CHECK_INTERVAL=5

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

is_spot_instance() {
    local scheduling=$(curl -s -H "Metadata-Flavor: Google" \
        "http://metadata.google.internal/computeMetadata/v1/instance/scheduling/preemptible" 2>/dev/null || echo "FALSE")
    [ "$scheduling" = "TRUE" ]
}

check_preemption() {
    local response=$(curl -s -H "Metadata-Flavor: Google" "$METADATA_URL" 2>/dev/null || echo "FALSE")
    [ "$response" = "TRUE" ]
}

main() {
    log "Starting GCP Spot Instance Preemption Monitor"

    if ! is_spot_instance; then
        log "Not a spot instance. Exiting."
        exit 0
    fi

    log "Monitoring for preemption every ${CHECK_INTERVAL} seconds"

    while true; do
        if check_preemption; then
            log "PREEMPTION DETECTED: Executing metadata shutdown script"
            /usr/bin/google_metadata_script_runner shutdown
            break
        fi
        sleep $CHECK_INTERVAL
    done
}

trap 'log "Monitor stopped"; exit 0' SIGTERM SIGINT
main
