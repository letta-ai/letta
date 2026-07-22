#!/bin/sh
set -eu

IMAGE="${1:?usage: test_docker_security.sh IMAGE}"
EXPECT_EOL="${EXPECT_EOL:-true}"
NAME="letta-docker-security-$$"
RESPONSE_FILE="$(mktemp)"

cleanup() {
    docker rm -f "$NAME" >/dev/null 2>&1 || true
    rm -f "$RESPONSE_FILE"
}
trap cleanup EXIT INT TERM

docker run --detach --name "$NAME" --publish 127.0.0.1::8283 "$IMAGE" >/dev/null
PORT="$(docker port "$NAME" 8283/tcp | sed -n 's/.*://p' | head -n 1)"

attempt=0
until curl --fail --silent "http://127.0.0.1:$PORT/v1/health/" >/dev/null; do
    attempt=$((attempt + 1))
    if [ "$attempt" -ge 120 ]; then
        docker logs "$NAME" >&2
        echo "Timed out waiting for the Docker server" >&2
        exit 1
    fi
    sleep 1
done

if [ "$EXPECT_EOL" = "true" ] && ! docker logs "$NAME" 2>&1 | grep -q "Docker distribution is end-of-life and unsupported"; then
    echo "Docker startup did not print the EOL warning" >&2
    exit 1
fi

STATUS="$(curl --silent --output "$RESPONSE_FILE" --write-out '%{http_code}' \
    --request POST "http://127.0.0.1:$PORT/v1/tools/run" \
    --header 'content-type: application/json' \
    --data '{"name":"authorization_probe","source_code":"def authorization_probe():\n return \"request reached tool execution\"","args":{}}')"

if [ "$STATUS" != "401" ]; then
    echo "Expected unauthenticated tool execution to return 401, got $STATUS" >&2
    cat "$RESPONSE_FILE" >&2
    exit 1
fi

PASSWORD="$(docker logs "$NAME" 2>&1 | sed -n 's/.*Using secure mode with password: //p' | tail -n 1)"
if [ -z "$PASSWORD" ]; then
    echo "Could not read the generated server password from Docker logs" >&2
    exit 1
fi

STATUS="$(curl --silent --output "$RESPONSE_FILE" --write-out '%{http_code}' \
    --request POST "http://127.0.0.1:$PORT/v1/tools/run" \
    --header 'content-type: application/json' \
    --header "Authorization: Bearer $PASSWORD" \
    --data '{"name":"authorized_smoke_test","source_code":"def authorized_smoke_test():\n return \"authorized\"","args":{}}')"

if [ "$STATUS" != "200" ] || ! grep -q '"tool_return":"authorized"' "$RESPONSE_FILE"; then
    echo "Authenticated compatibility smoke test failed with status $STATUS" >&2
    cat "$RESPONSE_FILE" >&2
    exit 1
fi

echo "Docker EOL security checks passed"
