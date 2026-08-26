# NestJS Boilerplate

Production-oriented NestJS 11 API starter with Prisma, PostgreSQL, Redis, BullMQ, JWT auth (access + refresh), sessions, Winston logging, and a Terminus health check.

## Stack

| Area | Choice |
| --- | --- |
| Framework | NestJS 11 |
| Database | PostgreSQL + Prisma |
| Cache / queues | Redis + BullMQ |
| Auth | Passport JWT (access + refresh), session tracking |
| Logging | Winston |
| Config | `@nestjs/config` + Joi |
| Health | `@nestjs/terminus` (`GET /health`) |
| CI | GitHub Actions (`master`, `develop`) |

API routes use the `/api` prefix. Health is excluded and lives at `GET /health`.

## Prerequisites

- Node.js 20+
- Docker (for Postgres + Redis) or equivalent local services

## Local setup

```bash
docker compose up -d
cp .env.example .env.development
# Adjust DATABASE_* / JWT secrets if they differ from compose defaults

npm install
npm run prisma:migrate
npm run seed
npm run start:dev
```

Compose maps Postgres to host port **5433** (see `DATABASE_PORT` in `.env.example`) so it does not collide with a local Postgres on `5432`. Redis stays on `6379`.

Default seeded admin (change before any real deploy):

- Email: `ADMIN_EMAIL` from env (example: `admin@example.com`)
- Password: `ADMIN_PASSWORD` from env

## Useful URLs

| URL | Notes |
| --- | --- |
| `http://localhost:3000/api` | API base |
| `http://localhost:3000/health` | Liveness/readiness (DB + Redis + memory) |
| Postman collection | `postman/nestjs-boilerplate.postman_collection.json` |

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run start:dev` | Dev server with watch |
| `npm run start:prod` | Run compiled `dist/main` |
| `npm run build` | Compile TypeScript |
| `npm run lint` | ESLint with `--fix` |
| `npm run format` / `format:check` | Prettier write / CI check |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Migrate (dev) |
| `npm run prisma:migrate:deploy` | Migrate (CI/prod) |
| `npm run seed` | Seed admin user |
| `npm run test` | Unit tests |
| `npm run test:e2e` | E2E tests (needs Postgres + Redis + env) |

## Environment

Copy `.env.example` to `.env.development` (or `.env.<NODE_ENV>`). Do **not** set `DATABASE_URL` — it is built from `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`, `DATABASE_NAME`, and `DATABASE_SCHEMA`.

Required highlights:

- App: `NODE_ENV`, `PORT`, `APP_URL`, `CORS_ORIGINS`
- Database: `DATABASE_*` as above
- JWT: `JWT_SECRET`, `JWT_REFRESH_SECRET` (min 32 chars each)
- Redis: `REDIS_HOST`, `REDIS_PORT` (`REDIS_PASSWORD` optional)
- Seed: `ADMIN_EMAIL`, `ADMIN_PASSWORD`

See `.env.example` for throttle and other optional defaults.

## Project layout

Feature modules live under `src/modules/` and are aggregated by `ModulesModule` (queues, users, auth/sessions, health). Shared pieces: `src/config`, `src/common`, `src/database`, `src/shared` (Winston, Redis).

Global wiring in `AppModule` / `main.ts`:

- Guards: `ThrottlerGuard`, `JwtAuthGuard`, `RolesGuard`
- Filter / interceptors: `HttpExceptionFilter`, `LoggingInterceptor`, `ResponseInterceptor`
- Logger: Winston via `app.useLogger(LoggerService)`
- Middleware: request id on `{*path}`

## E2E

Specs mirror `src/modules` under `test/` (`test/auth`, `test/health`, …) with shared helpers in `test/helpers/`.

```bash
docker compose up -d
# env pointed at Compose Postgres/Redis
npm run prisma:migrate:deploy
npm run seed
npm run test:e2e
```

CI runs the same flow with service containers (see `.github/workflows/ci.yml`).

## Implementation plan

Step-by-step stages and decisions are documented in [`IMPLEMENTATION.md`](./IMPLEMENTATION.md).
