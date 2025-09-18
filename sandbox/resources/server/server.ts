import { createServer } from "http";
import { unlinkSync, existsSync } from "fs";
import { runUserFunction } from "./entrypoint.js";

const SOCKET_PATH = "/tmp/my_unix_socket.sock";

// Remove old socket if it exists
if (existsSync(SOCKET_PATH)) {
  try {
    unlinkSync(SOCKET_PATH);
  } catch (err) {
    console.error("Failed to remove old socket:", err);
  }
}

const server = createServer((req, res) => {
  let data = "";

  req.on("data", chunk => {
    data += chunk;
  });

  req.on("end", () => {
    try {
      if (data.length > 0){
        const response = runUserFunction(data);
        res.writeHead(200);
        res.end(JSON.stringify(response));
      }
    } catch (err) {
      res.writeHead(400);
      res.end("[Server] Error: " + err);
    }
  });
});

server.on("error", (err) => {
  console.error("[Server] Error:", err);
});

server.listen(SOCKET_PATH, () => {
  console.log("[Server] Listening on", SOCKET_PATH);
});
