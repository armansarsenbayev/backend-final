FROM node:20-alpine AS builder
WORKDIR /app

ARG VITE_API_URL=http://localhost:3000/api/v1
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Use plain alpine — nginx:alpine bakes in EXPOSE 80 which confuses Dokku's port detection
FROM alpine:3.19
RUN apk add --no-cache nginx && mkdir -p /run/nginx /var/log/nginx

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 5000
CMD ["nginx", "-g", "daemon off;"]
