/**
 * This web server communicates if the electron app is running in the background.
 *
 * It has only one route /health, that returns a 200 status code if the app is running.
 */

import { createServer } from 'http';

let serverId: string | null;

export function getServerId() {
  return serverId;
}

export function setServerId(id: string | null) {
  serverId = id;
}

export function createWebServer() {
  const server = createServer((req, res) => {
    if (req.url === '/health') {
      // send server id if it is set
      if (serverId) {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(serverId);
        return;
      }

      res.writeHead(200);
      res.end();
      return;
    }

    res.writeHead(404);
    res.end();
  });

  // port is 8285
  server.listen(8285);

  console.log('Web server is running on port 8285');
}
