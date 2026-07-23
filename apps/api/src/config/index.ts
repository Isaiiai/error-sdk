import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

function trimEnv(value?: string): string {
  return (value || '').trim();
}

export const config = {
  port: parseInt(process.env.PORT || '5050', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/error-tracker',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production-min32',
    refreshSecret:
      process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  credentialsEncryptionKey:
    process.env.CREDENTIALS_ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    'dev-credentials-encryption-key-32b',
  corsOrigin: process.env.CORS_ORIGIN || 'https://app.traceops.isaii.in',
  appUrl: process.env.APP_URL || 'https://app.traceops.isaii.in',
  apiUrl: process.env.API_URL || 'https://api.traceops.isaii.in',
  isDev: (process.env.NODE_ENV || 'development') === 'development',
  spaces: {
    url: trimEnv(process.env.DO_SPACES_URL),
    endpoint: trimEnv(process.env.DO_SPACES_ENDPOINT) || 'https://sgp1.digitaloceanspaces.com',
    region: trimEnv(process.env.DO_SPACES_REGION) || 'sgp1',
    accessKey: trimEnv(process.env.DO_SPACES_ACCESS_KEY),
    secretKey: trimEnv(process.env.DO_SPACES_SECRET_KEY),
    bucket: trimEnv(process.env.DO_SPACES_BUCKET) || 'isaii-prod',
    basePath: trimEnv(process.env.DO_SPACES_BASE_PATH) || 'screenshots',
    cdnUrl: trimEnv(process.env.DO_SPACES_CDN_URL),
  },
  github: {
    pat: trimEnv(process.env.GITHUB_PAT || process.env.git_pat),
    apiBase: trimEnv(process.env.GITHUB_API_BASE) || 'https://api.github.com',
  },
};
