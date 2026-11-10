FROM node:24-bookworm-slim AS build

WORKDIR /app/patient-portal
COPY patient-portal/package.json patient-portal/package-lock.json ./
RUN npm ci

COPY patient-portal ./

ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

COPY --from=build /app/patient-portal/.next/standalone ./
COPY --from=build /app/patient-portal/.next/static ./.next/static
COPY --from=build /app/patient-portal/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
