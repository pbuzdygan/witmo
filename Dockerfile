FROM node:24.20.0-alpine3.24@sha256:4caaaf42195bcd6f6f3559a413b20cb8f8ad089e231ee874cf7701643966689f AS frontend-deps
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY frontend ./
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24.20.0-alpine3.24@sha256:4caaaf42195bcd6f6f3559a413b20cb8f8ad089e231ee874cf7701643966689f AS backend-deps
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY backend ./
RUN npm run bundle

FROM node:24.20.0-alpine3.24@sha256:4caaaf42195bcd6f6f3559a413b20cb8f8ad089e231ee874cf7701643966689f AS runner
WORKDIR /app/backend
ENV NODE_ENV=production
ENV PORT=4000
COPY --chown=node:node --from=backend-deps /app/backend/bundle/main.js ./dist/main.js
COPY --chown=node:node --from=frontend-deps /app/frontend/out ./public
USER node
EXPOSE 4000
CMD ["node", "dist/main.js"]
