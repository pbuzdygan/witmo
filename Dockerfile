FROM node:26.8.1-alpine3.24@sha256:2d984a15c9b54fd0aeb608b8e0d0d83529eb34d2966db27a1fb4f1edc3d298a3 AS frontend-deps
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY frontend ./
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:26.8.1-alpine3.24@sha256:2d984a15c9b54fd0aeb608b8e0d0d83529eb34d2966db27a1fb4f1edc3d298a3 AS backend-deps
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY backend ./
RUN npm run bundle

FROM node:26.8.1-alpine3.24@sha256:2d984a15c9b54fd0aeb608b8e0d0d83529eb34d2966db27a1fb4f1edc3d298a3 AS runner
WORKDIR /app/backend
ENV NODE_ENV=production
ENV PORT=4000
COPY --chown=node:node --from=backend-deps /app/backend/bundle/main.js ./dist/main.js
COPY --chown=node:node --from=frontend-deps /app/frontend/out ./public
USER node
EXPOSE 4000
CMD ["node", "dist/main.js"]
