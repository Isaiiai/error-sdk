FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages ./packages
RUN npm install --workspace=@error-tracker/api
COPY apps/api ./apps/api
WORKDIR /app/apps/api
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/apps/api/package.json ./
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 5050
CMD ["node", "dist/server.js"]
