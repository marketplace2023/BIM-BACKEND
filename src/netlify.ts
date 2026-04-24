import serverless from 'serverless-http';
import { createApp } from './bootstrap';

let cachedHandler: ReturnType<typeof serverless> | null = null;

async function getHandler() {
  if (cachedHandler) {
    return cachedHandler;
  }

  const app = await createApp();
  cachedHandler = serverless(app.getHttpAdapter().getInstance());

  return cachedHandler;
}

export { getHandler };
