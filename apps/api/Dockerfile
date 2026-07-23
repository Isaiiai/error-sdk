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

EXPOSE 4000
CMD ["node", "dist/server.js"  ]
