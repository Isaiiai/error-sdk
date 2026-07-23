FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/admin/package.json ./apps/admin/

RUN npm ci --workspace=@error-tracker/admin --include-workspace-root=false || npm install --workspace=@error-tracker/admin

COPY apps/admin ./apps/admin
WORKDIR /app/apps/admin

ENV VITE_API_URL=https://api.traceops.isaii.in/api/v1
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve@14
COPY --from=builder /app/apps/admin/dist ./dist

ENV NODE_ENV=production
ENV PORT=4001

EXPOSE 4001
CMD ["serve", "-s", "dist", "-l", "4001"]
