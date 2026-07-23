import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { config } from './config';
import routes from './routes';
import { errorHandler } from './middleware/validate';

async function bootstrap() {
  await mongoose.connect(config.mongodbUri);
  console.log('[API] Connected to MongoDB');

  const app = express();
  const httpServer = createServer(app);
  const io = new SocketServer(httpServer, {
    cors: { origin: true, credentials: true },
  });

  app.set('io', io);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  // Reflect request origin — browser SDK can post from any customer site
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '16mb' }));
  app.use(morgan(config.isDev ? 'dev' : 'combined'));

  if (!config.isDev) {
    app.use(
      rateLimit({
        windowMs: 60 * 1000,
        max: 100,
        standardHeaders: true,
        legacyHeaders: false,
      })
    );
  }

  app.use('/api/v1', routes);
  app.use(errorHandler);

  io.on('connection', (socket) => {
    socket.on('join:project', (projectId: string) => {
      socket.join(`project:${projectId}`);
    });
    socket.on('leave:project', (projectId: string) => {
      socket.leave(`project:${projectId}`);
    });
  });

  httpServer.listen(config.port, () => {
    console.log(`[API] Server running on http://localhost:${config.port}`);
    console.log(`[API] Environment: ${config.nodeEnv}`);
  });
}

bootstrap().catch((err) => {
  console.error('[API] Failed to start:', err);
  process.exit(1);
});
