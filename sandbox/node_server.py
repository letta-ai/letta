import modal


class NodeShimServer:
    # This runs once startup
    @modal.enter()
    def start_server(self):
        import subprocess
        import time

        server_root_dir = "/root/sandbox/resources/server"
        # /app/server

        # Comment this in to show the updated user-function.ts file
        # subprocess.run(["sh", "-c", "cat /app/server/user-function.ts"], check=True)

        subprocess.run(["sh", "-c", f"cd {server_root_dir} && npm run build"], check=True)
        subprocess.Popen(
            [
                "sh",
                "-c",
                f"cd {server_root_dir} && npm run start",
            ],
        )

        time.sleep(1)
        print("🔮 Node server started and listening on /tmp/my_unix_socket.sock")

    @modal.method()
    def remote_executor(self, json_args: str):  # Dynamic TypeScript function execution
        """Execute a TypeScript function with JSON-encoded arguments.

        Args:
            json_args: JSON string containing the function arguments

        Returns:
            The result from the TypeScript function execution
        """
        import http.client
        import json
        import socket

        class UnixSocketHTTPConnection(http.client.HTTPConnection):
            def __init__(self, path):
                super().__init__("localhost")
                self.unix_path = path

            def connect(self):
                self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
                self.sock.connect(self.unix_path)

        try:
            # Connect to the Node.js server via Unix socket
            conn = UnixSocketHTTPConnection("/tmp/my_unix_socket.sock")

            # Send the JSON arguments directly to the server
            # The server will parse them and call the TypeScript function
            conn.request("POST", "/", body=json_args)
            response = conn.getresponse()
            output = response.read().decode()

            # Parse the response from the server
            try:
                output_json = json.loads(output)

                # Check if there was an error
                if "error" in output_json:
                    return {"error": output_json["error"]}

                # Return the successful result
                return output_json.get("result")

            except json.JSONDecodeError:
                # If the response isn't valid JSON, it's likely an error message
                return {"error": f"Invalid JSON response from TypeScript server: {output}"}

        except Exception as e:
            # Handle connection or other errors
            return {"error": f"Error executing TypeScript function: {str(e)}"}
