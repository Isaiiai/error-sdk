FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages ./packages

RUN npm ci --workspace=@error-tracker/api --include-workspace-root=false || npm install --workspace=@error-tracker/api

COPY apps/api ./apps/api
WORKDIR /app/apps/api
RUN npm run build

FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app/apps/api/package.json ./
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY .env .env

# TraceOps production (HTTPS)
ENV NODE_ENV=production
ENV PORT=4000
ENV CORS_ORIGIN=https://app.traceops.isaii.in
ENV APP_URL=https://app.traceops.isaii.in
ENV API_URL=https://api.traceops.isaii.in
ENV MONGODB_URI=mongodb://traceops-mongo:27017/error-trackers-db
ENV REDIS_URL=redis://traceops-redis:6379

EXPOSE 4000
CMD ["node", "dist/server.js"]
