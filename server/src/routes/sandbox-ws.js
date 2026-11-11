import net from 'node:net';
import { sandboxState } from '../services/sandbox.js';

/**
 * WebSocket upgrade proxy for the preview sandbox.
 *
 * Vite's hot-reload client opens a websocket to the same path the page was
 * served from. The sandbox lives on its own port, so the upgrade request is
 * forwarded and the two sockets are piped together.
 */
export function handleSandboxUpgrade(req, socket, head) {
  const match = /^\/api\/sandbox\/([^/?]+)/.exec(req.url || '');
  const projectId = match ? match[1] : null;

  const state = projectId ? sandboxState(projectId) : null;
  if (!state?.port) {
    socket.destroy();
    return;
  }

  const upstream = net.connect(state.port, '127.0.0.1', () => {
    const headers = [
      `GET ${req.url} HTTP/1.1`,
      `Host: 127.0.0.1:${state.port}`,
      'Upgrade: websocket',
      'Connection: Upgrade',
      ...Object.entries(req.headers)
        .filter(([name]) => !['host', 'connection', 'upgrade'].includes(name))
        .map(([name, value]) => `${name}: ${value}`),
    ];
    upstream.write(`${headers.join('\r\n')}\r\n\r\n`);
    if (head?.length) upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });

  const teardown = () => {
    upstream.destroy();
    socket.destroy();
  };

  upstream.on('error', teardown);
  socket.on('error', teardown);
  socket.on('close', () => upstream.destroy());
  upstream.on('close', () => socket.destroy());
}

export default handleSandboxUpgrade;
