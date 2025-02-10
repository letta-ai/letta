/**
 * This web server communicates if the electron app is running in the background.
 *
 * It has only one route /health, that returns a 200 status code if the app is running.
 */

import { createServer } from 'http';

export function createWebServer() {
  const server = createServer((req, res) => {
    if (req.url === '/health') {
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
