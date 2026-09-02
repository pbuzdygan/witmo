# WITMO

WITMO is a containerized movie discovery application built with a Next.js frontend and a NestJS backend. It combines data from OMDb and TMDb to show an IMDb rating, plot summary, poster, trailer, collection, and streaming availability in one place. Recently viewed titles are stored locally in the browser.

## Requirements

- Node.js 24 LTS (24.20.0 or a newer compatible 24.x release)
- API credentials: `OMDB_API_KEY` and either `TMDB_API_KEY` or `TMDB_READ_ACCESS_TOKEN`
- Docker, optionally, for running the production container

## Environment setup

1. Backend development:

   ```bash
   cd backend
   # Create a local .env with the required provider credentials when running outside Docker.
   npm ci
   ```

2. Frontend development:

   ```bash
   cd frontend
   # NEXT_PUBLIC_API_BASE_URL is optional when the API is hosted separately.
   npm ci
   ```

3. Docker Compose:

   - Configure the OMDb/TMDb credentials and `WATCH_REGION` in the Compose environment.
   - Build and start the application with `docker compose build && docker compose up -d`.

## Development

Run the backend and frontend in separate terminals:

```bash
# Backend
cd backend
npm run start:dev

# Frontend
cd frontend
npm run dev
```

The Next.js development server listens on port 3000 and the backend on port 4000. The main API endpoints are `/api/search` and `/api/movie/:imdbId`.

## Docker

```bash
docker compose build
docker compose up -d
```

- The application is available at `http://localhost:8015` by default.
- The NestJS process serves both the static frontend and the `/api/**` endpoints.
- The production image contains a bundled backend and the exported frontend only; application development dependencies are not included.
- Compose binds the application to `127.0.0.1` and runs the container with a read-only filesystem and reduced privileges.

## Project structure

- `backend/src/external/*` — OMDb and TMDb integrations.
- `backend/src/movies/*` — search, movie details, and data aggregation.
- `frontend/src/lib/api.ts` — REST API client.
- `frontend/src/app/page.tsx` — search results, movie details, and viewing history.
- `ROADMAP.md` — possible future product and operational work.

Viewing history is stored in browser LocalStorage. The stored data is validated and size-limited before it is restored.

## Security and operational configuration

- API parameters are validated and expensive endpoints have dedicated request limits.
- OMDb and TMDb responses are cached, while outbound concurrency and queue sizes are bounded.
- Helmet configures the Content Security Policy and other browser security headers.
- CORS is disabled by default. Set `CORS_ORIGINS` to a comma-separated list of trusted HTTP(S) origins when the frontend is hosted separately.
- `TRUST_PROXY_HOPS` defaults to `0`. Change it only when the application is deployed behind a controlled reverse proxy, using the exact number of trusted hops.
- `RATE_LIMIT_TTL_MS` and `RATE_LIMIT_MAX` control the global request limit. Their defaults are 60 seconds and 60 requests.
- `GET /api/health` is available for process and container health checks.

## Quality checks

```bash
cd backend
npm run lint
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run bundle

cd ../frontend
npm run lint
npm run build
```

GitHub Actions runs these checks together with dependency auditing, CodeQL analysis, secret scanning, a production image build, and an image-size budget. Dependabot checks npm dependencies, the base image, and GitHub Actions weekly.

## OMDb and TMDb integration

- **OMDb**
  - `/api/search` searches for movies and TV shows by title and optionally by year.
  - `/api/movie/:imdbId` retrieves the full plot, IMDb rating, and poster.
- **TMDb**
  - An IMDb identifier is mapped to a TMDb movie or TV identifier.
  - The application selects an official YouTube trailer when one is available.
  - Watch-provider data is resolved for `WATCH_REGION` and currently covers Netflix, Prime Video, Apple TV, Disney+, HBO Max, and SkyShowtime.
  - Movie collections can be displayed as a list of related titles.

The backend accepts a TMDb API key or a TMDb read access token. When both are provided, the read access token is preferred.
