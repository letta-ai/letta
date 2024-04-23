import os
import requests
import sys

from flask import Flask, request, Response
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

from twilio.twiml.messaging_response import MessagingResponse

app = Flask(__name__)
CORS(app)

MEMGPT_SERVER_URL = "http://127.0.0.1:8283"
MEMGPT_TOKEN = os.getenv("MEMGPT_SERVER_PASS")
assert MEMGPT_TOKEN, f"Missing env variable MEMGPT_SERVER_PASS"
MEMGPT_AGENT_ID = sys.argv[1] if len(sys.argv) > 1 else None
assert MEMGPT_AGENT_ID, f"Missing agent ID (pass as arg)"


@app.route("/test", methods=["POST"])
def test():
    print(request.headers)
    return "Headers received. Check your console."


def route_reply_to_memgpt_api(message):
    # send a POST request to a MemGPT server

    url = f"{MEMGPT_SERVER_URL}/api/agents/{MEMGPT_AGENT_ID}/messages"
    headers = {
        "accept": "application/json",
        "authorization": f"Bearer {MEMGPT_TOKEN}",
        "content-type": "application/json",
    }
    data = {
        "stream": False,
        "role": "system",
        "message": f"[SMS MESSAGE] {message}",
    }

    try:
        response = requests.post(url, headers=headers, json=data)
        print("Got response:", response.text)
    except Exception as e:
        print("Sending message failed:", str(e))


@app.route("/sms", methods=["POST"])
def sms_reply():
    """Respond to incoming calls with a simple text message."""
    # Fetch the message
    message_body = request.form["Body"]
    from_number = request.form["From"]

    print(f"New message from {from_number}: {message_body}")

    # Start our response
    resp = MessagingResponse()

    # Add a message
    resp.message("Hello, thanks for messaging!")

    return str(resp)


if __name__ == "__main__":
    # app.run(debug=True)
    app.run(host="0.0.0.0", port=8284, debug=True)
