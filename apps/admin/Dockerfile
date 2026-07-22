FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json ./
COPY apps/admin/package.json ./apps/admin/
RUN npm install --workspace=@error-tracker/admin
COPY apps/admin ./apps/admin
WORKDIR /app/apps/admin
ARG VITE_API_URL=http://localhost:5000/api/v1
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/apps/admin/dist /usr/share/nginx/html
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
