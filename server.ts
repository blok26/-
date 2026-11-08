import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createServer() {
  const app = express();
  const port = process.env.PORT || 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(express.json());

  // ICE Config Endpoint for WebRTC (STUN + optional TURN)
  app.get('/api/ice-config', (req, res) => {
    const iceServers: RTCIceServer[] = [
      {
        urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302']
      }
    ];

    const turnUrl = process.env.TURN_URL;
    const turnUsername = process.env.TURN_USERNAME;
    const turnCredential = process.env.TURN_CREDENTIAL;

    if (turnUrl) {
      const turnConfig: RTCIceServer = {
        urls: turnUrl.split(',').map((u) => u.trim()),
      };
      if (turnUsername) {
        turnConfig.username = turnUsername;
      }
      if (turnCredential) {
        turnConfig.credential = turnCredential;
      }
      iceServers.push(turnConfig);
    }

    res.json({
      iceServers,
      hasTurn: Boolean(turnUrl),
    });
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', name: 'ارسمها لو تقدر' });
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(port, () => {
    console.log(`> Server ready on http://localhost:${port}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
