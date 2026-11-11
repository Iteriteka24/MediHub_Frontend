FROM node:24-bookworm-slim AS build

WORKDIR /app/staff
COPY staff/package.json staff/package-lock.json ./
RUN npm ci

COPY staff ./

RUN npm run build

FROM nginx:1.27-alpine
ENV BACKEND_UPSTREAM=https://medihubbackend-production.up.railway.app
COPY staff/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/staff/dist/ /usr/share/nginx/html/
EXPOSE 8080
