FROM node:24-bookworm-slim AS build

WORKDIR /app/staff
COPY staff/package.json staff/package-lock.json ./
RUN npm ci

COPY staff ./

ARG VITE_API_BASE_URL=http://localhost:8000
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

FROM nginx:1.27-alpine
COPY staff/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/staff/dist/ /usr/share/nginx/html/
EXPOSE 8080
