FROM node:24.20.0-alpine3.24@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf AS frontend-deps
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY frontend ./
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24.20.0-alpine3.24@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf AS backend-deps
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY backend ./
RUN npm run bundle

FROM node:24.20.0-alpine3.24@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf AS runner
WORKDIR /app/backend
ENV NODE_ENV=production
ENV PORT=4000
COPY --chown=node:node --from=backend-deps /app/backend/bundle/main.js ./dist/main.js
COPY --chown=node:node --from=frontend-deps /app/frontend/out ./public
USER node
EXPOSE 4000
CMD ["node", "dist/main.js"]
