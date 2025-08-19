/**
 * This web server communicates if the electron app is running in the background.
 *
 * It has only one route /health, that returns a 200 status code if the app is running.
 */

import { createServer } from 'http';
import { dialog } from 'electron';

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

  const port = 8285;

  server.listen(port, () => {
    console.log(
      `Desktop electron server is running on port ${port} (this is not the Letta API server)`,
    );
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      dialog.showErrorBox(
        'Warning\n\nLetta Desktop port in use',
        `Port ${port} is already in use.\n\nThis usually means another instance of Letta Desktop is already running.\n\nPlease close any other instances and try again.`,
      );
      // If we want to prevent parallel copies running, we should actually quit here
      // app.quit();
    } else {
      console.error('[web-server] Unhandled server error:', err);
    }
  });
}
