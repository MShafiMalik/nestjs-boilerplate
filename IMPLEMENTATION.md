# NestJS Boilerplate — Implementation Guide

Build `nestjs-boilerplate` from the stock Nest 11 CLI app into a production-ready starter.

Each stage is a separate commit. Finish one stage before starting the next.

---

## Goals

A new project cloned from this boilerplate should already have:

1. Feature-module folder structure
2. Validated multi-environment config
3. Prisma + PostgreSQL with migrations and a seeder
4. Standard API success/error shape + request IDs
5. JWT auth (access + refresh) with role guards, inactive-user checks, and email verification
6. User session management (list, revoke one, revoke others, revoke all)
7. Rate limiting on auth endpoints
8. Forgot / reset password and email verification as queue stubs
9. Delete account (soft delete + revoke sessions)
10. Winston as the Nest logger, Helmet, CORS, validation, trust proxy, shutdown hooks
11. Redis + BullMQ (example jobs + a cron job)
12. Health endpoint
13. Local Docker Compose for Postgres and Redis
14. Husky / commitlint / lint-staged
15. GitHub Actions CI (lint, format check, build, e2e)

---

## Tech Stack

| Area | Choice |
| --- | --- |
| Framework | NestJS 11 |
| Language | TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| Cache / queues | Redis + BullMQ (`@nestjs/bullmq`) |
| Auth | Passport JWT (access + refresh) |
| Sessions | Prisma `Session` + device info (Bowser for web UA) |
| Rate limiting | `@nestjs/throttler` |
| Validation | class-validator + class-transformer |
| Env validation | Joi |
| Logging | Winston (Nest `app.useLogger`) |
| Testing | Jest e2e (Supertest) |
| Security | Helmet + trust proxy |
| Health | `@nestjs/terminus` |
| Local services | Docker Compose (Postgres + Redis) |
| Git hooks | Husky + lint-staged + commitlint |
| CI | GitHub Actions |

---

## Target Folder Structure

```
nestjs-boilerplate/
├── .env.example
├── .env.development              # gitignored
├── .env                          # gitignored local overrides
├── .github/workflows/ci.yml
├── .husky/
│   ├── pre-commit
│   └── commit-msg
├── .commitlintrc
├── .lintstagedrc
├── .prettierrc
├── eslint.config.mjs
├── docker-compose.yml            # Postgres + Redis only
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts                   # runner (`prisma db seed`)
│   └── seeds/
│       └── admin.seed.ts
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── config/
│   │   ├── config.module.ts
│   │   ├── env.validation.ts
│   │   ├── app.config.ts
│   │   ├── database.config.ts
│   │   ├── load-env.ts
│   │   ├── jwt.config.ts
│   │   ├── redis.config.ts
│   │   └── throttle.config.ts
│   ├── common/
│   │   ├── constants/app.constants.ts
│   │   ├── constants/queue.constants.ts
│   │   ├── decorators/public.decorator.ts
│   │   ├── decorators/roles.decorator.ts
│   │   ├── decorators/current-user.decorator.ts
│   │   ├── dto/pagination.dto.ts
│   │   ├── dto/pagination-response.dto.ts
│   │   ├── enums/role.enum.ts
│   │   ├── enums/platform.enum.ts
│   │   ├── filters/http-exception.filter.ts
│   │   ├── guards/jwt-auth.guard.ts
│   │   ├── guards/roles.guard.ts
│   │   ├── interceptors/logging.interceptor.ts
│   │   ├── interceptors/response.interceptor.ts
│   │   ├── middleware/request-id.middleware.ts
│   │   ├── types/api-response.type.ts
│   │   ├── types/jwt-payload.type.ts
│   │   ├── util/util.module.ts
│   │   └── util/util.service.ts
│   ├── database/
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   ├── shared/
│   │   ├── logger/logger.module.ts
│   │   ├── logger/logger.service.ts
│   │   ├── redis/redis.module.ts
│   │   └── redis/redis.constants.ts
│   └── modules/
│       ├── auth/
│       │   ├── auth.module.ts
│       │   ├── auth.controller.ts
│       │   ├── auth.service.ts
│       │   ├── strategies/jwt.strategy.ts
│       │   ├── strategies/jwt-refresh.strategy.ts
│       │   ├── sessions/
│       │   │   ├── sessions.module.ts
│       │   │   ├── sessions.controller.ts
│       │   │   ├── sessions.service.ts
│       │   │   ├── sessions.repository.ts
│       │   │   ├── device-parser.service.ts
│       │   │   └── dto/session-response.dto.ts
│       │   └── dto/
│       │       ├── register.dto.ts
│       │       ├── login.dto.ts
│       │       ├── refresh-token.dto.ts
│       │       ├── change-password.dto.ts
│       │       ├── device-info.dto.ts
│       │       ├── forgot-password.dto.ts
│       │       ├── reset-password.dto.ts
│       │       ├── verify-email.dto.ts
│       │       └── resend-email-verification.dto.ts
│       ├── users/
│       │   ├── users.module.ts
│       │   ├── users.service.ts
│       │   ├── users.repository.ts
│       │   └── dto/update-user.dto.ts
│       ├── health/
│       │   ├── health.module.ts
│       │   └── health.controller.ts
│       └── queues/
│           ├── queues.module.ts
│           ├── notifications.processor.ts
│           └── cron.processor.ts
└── test/
    ├── jest-e2e.json
    ├── app.e2e-spec.ts
    └── helpers/
        └── prisma.ts
```

Remove the stock `app.controller.ts`, `app.service.ts`, and `app.controller.spec.ts` once health exists. E2e lives in `test/`.

---

## Design Rules

1. **Controllers** expose HTTP and apply guards. No Prisma calls here.
2. **Services** hold business logic.
3. **Repositories** wrap Prisma. Services use repositories, not `PrismaService` directly.
4. **Guards** enforce auth/roles at controller level.
5. **Shared modules** (`Logger`, `Redis`, `Prisma`) are `@Global()` when widely used.
6. **Queues** handle side effects. HTTP handlers enqueue work.
7. **Soft delete:** models that need it have `deletedAt`. Repositories filter `deletedAt: null` unless a query is meant to include deleted rows.
8. **User model** stays generic: `id`, `email` (always stored lowercase), `password`, `name`, `role`, `isActive`, `isEmailVerified`, verification/reset hashes, timestamps, `deletedAt`.
9. **Sessions** are first-class: one row per login. Tokens carry `sessionId`. Logout and device management revoke sessions; a revoked session cannot refresh.
10. **Inactive users** cannot login, refresh, or use an access token.
11. **Register** returns 409 if the email exists (case-insensitive). Success creates an unverified user and sends a verification job; tokens are issued **after email verification**, not at register.
12. **Auth write endpoints** are rate-limited. Forgot-password and resend-verification always return a generic success message and enqueue a job (log the token until a mailer exists).
13. **Delete account** soft-deletes the user and revokes all sessions. The original email can be registered again.

### Prisma conventions

- Connection is built from `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`, `DATABASE_NAME`, and `DATABASE_SCHEMA` (default `public`)
- Prisma still reads `url = env("DATABASE_URL")`. Do **not** put `DATABASE_URL` in env files; `validateEnv` (Nest) and `src/config/load-env.ts` (Prisma CLI) construct it from those vars
- Schema lives in `prisma/schema.prisma`
- Schema changes go through `prisma migrate`
- Repeat `id`, `createdAt`, `updatedAt`, `deletedAt` on each model that needs them
- Map database columns to snake_case with `@map` / `@@map`

### API response shape

Success:

```json
{
  "success": true,
  "data": {},
  "timestamp": "2026-08-20T00:00:00.000Z",
  "requestId": "uuid"
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "Validation failed",
    "details": {}
  },
  "timestamp": "2026-08-20T00:00:00.000Z",
  "requestId": "uuid"
}
```

---

## Progress

| Stage | Description | Status |
| --- | --- | --- |
| 1 | Project setup, tooling, config, bootstrap | ✅ |
| 2 | Common layer | ✅ |
| 3 | Prisma + PostgreSQL | ✅ |
| 4 | Logger + Redis | ✅ |
| 5 | Users module | ✅ |
| 6 | Auth module (JWT + refresh) | ⬜ |
| 7 | Session management | ⬜ |
| 8 | BullMQ queues | ⬜ |
| 9 | Health check | ⬜ |
| 10 | Seed + admin user | ⬜ |
| 11 | GitHub Actions CI | ⬜ |
| 12 | README + final wiring | ⬜ |
| 13 | E2E suite | ⬜ |

Legend: ⬜ Pending · 🔄 In progress · ✅ Done

---

## Stage 1: Project setup, tooling, config, bootstrap

**Commit:** `feat: project setup and configuration`

### Tasks

- [ ] Add `.prettierrc`, `.lintstagedrc`, `.commitlintrc`
- [ ] Tighten `eslint.config.mjs` to `strictTypeChecked` with Nest-friendly overrides
- [ ] Add `format:check` script for CI
- [ ] Install Husky, lint-staged, commitlint
- [ ] Create `src/config/` (app, database, jwt, redis, throttle + Joi schema)
- [ ] Split database env into host/port/username/password/name/schema; construct Prisma URL
- [ ] Add `src/config/load-env.ts` for Prisma CLI
- [ ] Wire `AppConfigModule` as global
- [ ] Update `main.ts`: prefix, Helmet, CORS, `ValidationPipe`, trust proxy, shutdown hooks, port from config
- [ ] Add `.env.example` and `.env.development`
- [ ] Ignore `.env`, `.env.development`, `.env.staging`, `.env.production` in `.gitignore`
- [ ] Add `docker-compose.yml` for Postgres and Redis

Filters and interceptors land in Stage 2. Prisma lands in Stage 3.

### Dependencies

```bash
npm install @nestjs/config helmet joi class-validator class-transformer
npm install -D husky lint-staged @commitlint/cli @commitlint/config-conventional
npx husky init
```

Hooks:

```bash
# .husky/pre-commit
npx lint-staged

# .husky/commit-msg
npx --no -- commitlint --edit $1
```

Add to `package.json`:

```json
{
  "scripts": {
    "format:check": "prettier --check \"src/**/*.ts\" \"test/**/*.ts\"",
    "prepare": "husky"
  }
}
```

### Env files

`.env.example` (committed):

```env
# App
# NODE_ENV: development | staging | production | test
NODE_ENV=development
PORT=3000
# Public URL of this API (used in email-verification and password-reset links)
APP_URL=http://localhost:3000
# Comma-separated browser origins allowed by CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
# Set true when running behind a reverse proxy (reads X-Forwarded-* for client IP)
TRUST_PROXY=true

# PostgreSQL (Prisma URL is built from these; do not set DATABASE_URL)
# PostgreSQL (Prisma URL is built from these; do not set DATABASE_URL)
# Host port 5433 avoids clashing with a local Windows PostgreSQL on 5432
DATABASE_HOST=localhost
DATABASE_PORT=5433
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=password
DATABASE_NAME=nestjs_boilerplate
DATABASE_SCHEMA=public

# JWT — secrets must be at least 32 characters
JWT_SECRET=change-me-access-token-secret-min-32-chars
# Access token lifetime (e.g. 15m, 1h)
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=change-me-refresh-token-secret-min-32-chars
# Refresh token / session lifetime (e.g. 7d)
JWT_REFRESH_EXPIRES_IN=7d

# Redis (BullMQ, session list cache, health check)
REDIS_HOST=localhost
REDIS_PORT=6379
# Leave empty if Redis has no password
REDIS_PASSWORD=

# Rate limiting (milliseconds). Auth write endpoints use the stricter AUTH_* pair.
THROTTLE_TTL_MS=60000
THROTTLE_LIMIT=20
THROTTLE_AUTH_TTL_MS=60000
THROTTLE_AUTH_LIMIT=5

# Seeded admin (prisma db seed). Change the password before any real deploy.
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=Admin@12345
```

Loading order in `ConfigModule.forRoot`:

```ts
envFilePath: [
  '.env',
  `.env.${process.env.NODE_ENV ?? 'development'}`,
]
```

Joi must require: `NODE_ENV`, `PORT`, `APP_URL`, `CORS_ORIGINS`, `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USERNAME`, `DATABASE_NAME`, JWT secrets (min 32 chars), Redis host/port. `DATABASE_PASSWORD` and `REDIS_PASSWORD` may be empty. `DATABASE_SCHEMA` default `public`. `TRUST_PROXY` default `true`. Throttle vars optional with the defaults above. `ADMIN_*` required for seed.

`validateEnv` must set `process.env.DATABASE_URL` from the database vars (Prisma cannot read split vars). `src/config/load-env.ts` does the same for Prisma CLI / seed.

### Config files

- `app.config.ts` → `app.port`, `app.nodeEnv`, `app.appUrl`, `app.corsOrigins`, `app.trustProxy`
- `database.config.ts` → `database.host`, `database.port`, `database.username`, `database.password`, `database.name`, `database.schema`, plus constructed `database.url`
- `jwt.config.ts` → secret, expiresIn, refreshSecret, refreshExpiresIn
- `redis.config.ts` → host, port, password
- `throttle.config.ts` → default ttl/limit and stricter auth ttl/limit

### `main.ts` (this stage)

- `app.setGlobalPrefix('api')` — in Stage 9, exclude `health` so probes can hit `/health`
- `helmet()`
- CORS with credentials
- `ValidationPipe`: `whitelist`, `forbidNonWhitelisted`, `transform`, `enableImplicitConversion`
- Trust proxy when `app.trustProxy` is true:

```ts
const httpAdapter = app.getHttpAdapter().getInstance() as {
  set: (key: string, value: unknown) => void;
};
httpAdapter.set('trust proxy', 1);
```

- `app.enableShutdownHooks()` so `OnModuleDestroy` runs (Prisma disconnect, BullMQ workers)
- Listen on `app.port`

### Local Compose (Postgres + Redis)

`docker-compose.yml` runs **only** the databases. The Nest app still starts with `npm run start:dev`.

```yaml
services:
  postgres:
    image: postgres:16-alpine
    ports:
      - '5433:5432'
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: nestjs_boilerplate
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  postgres_data:
  redis_data:
```

```bash
docker compose up -d
```

Database vars (`DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`, `DATABASE_NAME`, `DATABASE_SCHEMA`) and Redis host/port in `.env.development` should match this compose file.

---

## Stage 2: Common layer

**Commit:** `feat: add common filters interceptors guards and utils`

### Tasks

- [ ] Types: `api-response.type.ts`, `jwt-payload.type.ts`
- [ ] Enums: `Role.USER`, `Role.ADMIN` and `Platform.WEB`, `Platform.IOS`, `Platform.ANDROID` (must match Prisma enums)
- [ ] Constants: pagination, salt rounds, headers, request-id header, max sessions, session cache TTL, password-reset TTL, email-verification TTL/cooldown
- [ ] Decorators: `@Public()`, `@Roles()`, `@CurrentUser()`
- [ ] Guards: `JwtAuthGuard` (respect `@Public()`), `RolesGuard`
- [ ] `HttpExceptionFilter` (`@Catch()`)
- [ ] `ResponseInterceptor`, `LoggingInterceptor`
- [ ] `RequestIdMiddleware` (`X-Request-ID`)
- [ ] Pagination DTOs
- [ ] `UtilModule` + `UtilService` (hash/compare password, sha256, pagination params, random string, OTP, date helpers)
- [ ] Register middleware in `AppModule`; register filter + interceptors in `main.ts`

### JWT payload

```ts
export type JwtPayload = {
  sub: string;
  email: string;
  role: Role;
  sessionId: string;
  isEmailVerified: boolean;
};

export type JwtRefreshPayload = {
  sub: string;
  sessionId: string;
};
```

Access and refresh tokens both include `sessionId`. Session rows are the source of truth for whether a login is still valid.

Session constants:

```ts
MAX_SESSIONS_PER_USER: 5,
SESSION_CACHE_TTL: 3600, // seconds
PASSWORD_RESET_EXPIRES_MINUTES: 15,
EMAIL_VERIFICATION_EXPIRES_MINUTES: 60,
EMAIL_VERIFICATION_COOLDOWN_MINUTES: 1,
```

### Pagination

`PaginationDto`: optional `page` (min 1), `limit` (min 1, max 100).

`PaginatedResponseDto<T>`: `items` + `meta` (`PaginationMetaDto`: `page`, `limit`, `totalItems`, `totalPages`, `hasNextPage`, `hasPreviousPage`). Classes in `dto/`, not TypeScript `type` aliases.

---

## Stage 3: Prisma + PostgreSQL

**Commit:** `feat: add prisma and postgres`

### Tasks

- [ ] Install Prisma
- [ ] Add `prisma/schema.prisma`
- [ ] Add `PrismaService` + global `PrismaModule`
- [ ] Add npm scripts (Prisma CLI must load `src/config/load-env.ts` so `DATABASE_URL` is constructed)
- [ ] Run initial migration
- [ ] Enable `prisma generate` on install (`postinstall`)

### Dependencies

```bash
npm install @prisma/client
npm install -D prisma
npx prisma init
```

### `prisma/schema.prisma`

Prisma only accepts a URL (`url = env("DATABASE_URL")`). Env files store split `DATABASE_*` vars; `validateEnv` / `src/config/load-env.ts` set `DATABASE_URL` before Prisma runs. Do not add `DATABASE_URL` to `.env*`.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  USER
  ADMIN
}

enum Platform {
  WEB
  IOS
  ANDROID
}

model User {
  id                       String    @id @default(uuid())
  email                    String    @unique
  password                 String
  name                     String
  role                     Role      @default(USER)
  isActive                 Boolean   @default(true) @map("is_active")
  isEmailVerified          Boolean   @default(false) @map("is_email_verified")
  emailVerificationHash    String?   @map("email_verification_hash")
  emailVerificationExpires DateTime? @map("email_verification_expires")
  emailVerificationSentAt  DateTime? @map("email_verification_sent_at")
  passwordResetHash        String?   @map("password_reset_hash")
  passwordResetExpires     DateTime? @map("password_reset_expires")
  createdAt                DateTime  @default(now()) @map("created_at")
  updatedAt                DateTime  @updatedAt @map("updated_at")
  deletedAt                DateTime? @map("deleted_at")
  sessions                 Session[]

  @@map("users")
}

model Session {
  id         String    @id @default(uuid())
  userId     String    @map("user_id")
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  platform   Platform  @default(WEB)
  deviceId   String?   @map("device_id")
  deviceName String?   @map("device_name")
  appVersion String?   @map("app_version")
  osVersion  String?   @map("os_version")
  userAgent  String?   @map("user_agent")
  ipAddress  String?   @map("ip_address")
  lastUsedAt DateTime? @map("last_used_at")
  expiresAt  DateTime? @map("expires_at")
  isRevoked  Boolean   @default(false) @map("is_revoked")
  createdAt  DateTime  @default(now()) @map("created_at")
  updatedAt  DateTime  @updatedAt @map("updated_at")

  @@index([userId])
  @@map("sessions")
}
```

### `PrismaService`

Extend `PrismaClient`, implement `OnModuleInit` / `OnModuleDestroy`:

- `onModuleInit` → `$connect()`
- `onModuleDestroy` → `$disconnect()`

`PrismaModule` is `@Global()`, exports `PrismaService`. Shutdown hooks in `main.ts` make `onModuleDestroy` run on SIGINT/SIGTERM.

### Scripts

```json
{
  "prisma": {
    "seed": "ts-node -r ./src/config/load-env.ts prisma/seed.ts"
  },
  "scripts": {
    "postinstall": "node -r ts-node/register/transpile-only -r ./src/config/load-env.ts node_modules/prisma/build/index.js generate",
    "prisma:generate": "node -r ts-node/register/transpile-only -r ./src/config/load-env.ts node_modules/prisma/build/index.js generate",
    "prisma:migrate": "node -r ts-node/register/transpile-only -r ./src/config/load-env.ts node_modules/prisma/build/index.js migrate dev",
    "prisma:migrate:deploy": "node -r ts-node/register/transpile-only -r ./src/config/load-env.ts node_modules/prisma/build/index.js migrate deploy",
    "prisma:studio": "node -r ts-node/register/transpile-only -r ./src/config/load-env.ts node_modules/prisma/build/index.js studio",
    "seed": "prisma db seed"
  }
}
```

`prisma/seed.ts` can be a stub in this stage; implement the runner + `prisma/seeds/admin.seed.ts` in Stage 10.

Always persist and look up email as **lowercase + trimmed**. Unique on `email` then covers case-insensitive duplicates. DTOs that accept email use `@Transform(({ value }) => String(value).trim().toLowerCase())`.

### Soft delete

```ts
findByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  return this.prisma.user.findFirst({
    where: { email: normalized, deletedAt: null },
  });
}

softDelete(id: string, email: string) {
  return this.prisma.user.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      isActive: false,
      email: `deleted.${id}.${email}`,
    },
  });
}
```

User removal goes through `softDelete` so the original address can register again. Always revoke sessions in the same flow (Stage 7).

---

## Stage 4: Logger + Redis

**Commit:** `feat: add winston logger and redis`

### Tasks

- [ ] Winston `LoggerService` implementing Nest's `LoggerService`
- [ ] Redis module with `ioredis` (fail-fast retries)
- [ ] Import both in `AppModule`
- [ ] Wire Winston as the Nest logger in `main.ts`

```bash
npm install winston ioredis
```

Redis is used by BullMQ, session list cache, and the health check.

Logger: debug + color in non-production; json + file transports in production (`logs/error.log`, `logs/combined.log`). Ensure `logs/` is gitignored.

`LoggerService` implements `LoggerService` from `@nestjs/common` (`log`, `error`, `warn`, `debug`, `verbose`).

In `main.ts` (after `NestFactory.create`):

```ts
const app = await NestFactory.create(AppModule, { bufferLogs: true });
app.useLogger(app.get(LoggerService));
```

Nest internal logs (routes, shutdown, exceptions) then go through Winston. `LoggingInterceptor` and processors inject the same `LoggerService`.

---

## Stage 5: Users module

**Commit:** `feat: add users module`

### Tasks

- [ ] `UsersRepository` — Prisma wrappers
- [ ] `UsersService` — throw `NotFoundException` when missing
- [ ] `UsersModule` exports `UsersService` (and repository if auth needs it)
- [ ] Profile HTTP lives on auth; users module is the data layer

### Repository methods

- `findById(id)`
- `findByEmail(email)` — normalize to lowercase first
- `findByEmailWithPassword(email)` — include `password`
- `findByPasswordResetHash(hash)`
- `findByEmailVerificationHash(hash)`
- `create(data)`
- `update(id, data)`
- `setPasswordReset(id, hash, expiresAt)`
- `clearPasswordReset(id)`
- `setEmailVerification(id, hash, expiresAt, sentAt)`
- `clearEmailVerification(id)` — also set `isEmailVerified: true`
- `updatePassword(id, hashedPassword)` — also clears reset fields
- `softDelete(id, email)`

HTTP-facing service methods omit `password` and reset hashes. Auth uses the password-aware repository methods internally.

`UsersService.assertActive(user)` throws `UnauthorizedException` if `isActive` is false. Login, refresh, and JWT validation all use it.

`UsersService.assertEmailVerified(user)` throws `UnauthorizedException` (`Please verify your email`) if `isEmailVerified` is false. Login and refresh use it. JWT validation does **not** require it (a session issued at verify-time remains valid).

---

## Stage 6: Auth module

**Commit:** `feat: add jwt auth with refresh tokens`

### Tasks

- [ ] `AuthModule` with `PassportModule` + `JwtModule.registerAsync` + `SessionsModule` + `UsersModule`
- [ ] `JwtStrategy` (access) and `JwtRefreshStrategy`
- [ ] Apply `JwtAuthGuard`, `RolesGuard` globally (`APP_GUARD`). `ThrottlerGuard` is registered in `AppModule`
- [ ] Register / login / refresh / logout / profile / change-password / forgot-password / reset-password / verify-email / resend-verification / delete-account
- [ ] Verify-email creates a session and returns tokens
- [ ] Inactive-user and unverified-email checks on login and refresh
- [ ] Register returns 409 on duplicate email (case-insensitive); success does not issue tokens
- [ ] `SessionsModule` repository + service (list/revoke HTTP, device parser, and Redis cache land in Stage 7)

```bash
npm install @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt bowser @nestjs/throttler
npm install -D @types/passport-jwt @types/bcrypt
```

Auth uses these `SessionsService` methods:

- `createSession(userId, deviceInfo?, ipAddress?, userAgent?)`
- `validateSession(sessionId)` — throws if missing or `isRevoked`
- `touch(sessionId)` — update `lastUsedAt`
- `revokeSession(sessionId, userId)`
- `revokeAll(userId)`
- `revokeOthers(userId, currentSessionId)`

### Endpoints (all under `/api/auth`)

| Method | Path | Auth | Throttle | Purpose |
| --- | --- | --- | --- | --- |
| POST | `/auth/register` | Public | Auth limit | Create unverified `USER`, enqueue verification |
| POST | `/auth/login` | Public | Auth limit | Require verified + active; create session, return tokens |
| POST | `/auth/refresh` | Refresh JWT | Auth limit | Validate session + active + verified, rotate tokens |
| POST | `/auth/logout` | Access JWT | Default | Revoke current session |
| GET | `/auth/profile` | Access JWT | Default | Current user (includes `isEmailVerified`) |
| PATCH | `/auth/profile` | Access JWT | Default | Update name |
| DELETE | `/auth/profile` | Access JWT | Default | Soft-delete account, revoke all sessions |
| POST | `/auth/change-password` | Access JWT | Default | Verify old password, set new, revoke other sessions |
| POST | `/auth/forgot-password` | Public | Auth limit | Enqueue reset job (generic response) |
| POST | `/auth/reset-password` | Public | Auth limit | Set new password from token, revoke all sessions |
| POST | `/auth/verify-email` | Public | Auth limit | Mark verified, create session, return tokens |
| POST | `/auth/resend-email-verification` | Public | Auth limit | Enqueue verification job (generic response) |

### Throttling

In `AppModule`, `ThrottlerModule.forRootAsync` from `throttle.config.ts` (named throttlers `default` and `auth`) and `APP_GUARD` → `ThrottlerGuard`.

- Global `ThrottlerGuard`
- `@Throttle({ auth: { limit, ttl } })` on register, login, refresh, forgot-password, reset-password, verify-email, resend-email-verification
- `@SkipThrottle()` on health (Stage 9)

### Inactive users

If `user.isActive === false`:

- Login → `UnauthorizedException` (`Account is inactive`)
- Refresh → same
- `JwtStrategy.validate` → load user, reject inactive or soft-deleted, then `validateSession`

### Register

- Normalize email to lowercase before lookup/insert
- Email already exists (and not soft-deleted) → `ConflictException` (HTTP 409), including different casing (`A@x.com` vs `a@x.com`)
- Success: create user (`role: USER`, `isEmailVerified: false`) → store `sha256(verificationToken)` + expiry → enqueue `EMAIL_VERIFICATION` → return `{ message: 'Check your email to verify your account' }`
- **No session and no tokens** until verify-email succeeds

### Email verification (queue stub)

`VerifyEmailDto`: `token`, optional `deviceInfo`  
`ResendEmailVerificationDto`: `email`

**Verify** (`POST /auth/verify-email`):

1. SHA-256 the token and `findByEmailVerificationHash`
2. Reject if missing, expired, inactive, or already verified (already verified may still log them in if you prefer; default: `BadRequestException` `Invalid or expired token`)
3. `clearEmailVerification` (`isEmailVerified: true`, clear hash/expiry)
4. `createSession` → sign tokens → return the **login payload** (`accessToken`, `refreshToken`, `user`)

**Resend** (`POST /auth/resend-email-verification`):

1. Always return `{ message: 'If the email exists, a verification link was sent.' }`
2. If user exists, is active, and not verified: enforce `EMAIL_VERIFICATION_COOLDOWN_MINUTES` via `emailVerificationSentAt`
3. New token, SHA-256, enqueue `NOTIFICATION_JOBS.EMAIL_VERIFICATION` with `{ email, name, verificationToken, verifyUrl }` where `verifyUrl` is `${APP_URL}/verify-email?token=...`

**Login / refresh** require `isEmailVerified === true`.

### Delete account

`DELETE /auth/profile` (access JWT):

1. `revokeAll` sessions
2. `softDelete` (sets `deletedAt`, `isActive: false`, rewrites email so the address is free)
3. Return `{ message: 'Account deleted' }`

The current access token fails on the next request because the session is revoked and the user is inactive.

### Token behavior

- Access token: short-lived (`JWT_EXPIRES_IN`, default `15m`), signed with `JWT_SECRET`, payload includes `sub`, `email`, `role`, `sessionId`
- Refresh token: longer (`JWT_REFRESH_EXPIRES_IN`, default `7d`), signed with `JWT_REFRESH_SECRET`, payload includes `sub`, `sessionId`
- Login / **verify-email**: create a `Session` (`expiresAt` = now + refresh TTL), sign both tokens with that `sessionId`
- Refresh: verify refresh JWT → user exists, is active, and is email-verified → `validateSession` → `touch` → sign new tokens with the **same** `sessionId`
- Logout: `revokeSession` for `user.sessionId`
- Change password: update hash, then `revokeOthers` so other devices must log in again

### Forgot / reset password (queue stub)

`ForgotPasswordDto`: `email`  
`ResetPasswordDto`: `token`, `newPassword` (same password rules as register)

**Forgot** (`POST /auth/forgot-password`):

1. Always return `{ message: 'If the email exists, a reset link was sent.' }` (do not reveal whether the user exists)
2. If a matching active user exists: generate a random token, store `sha256(token)` in `passwordResetHash` plus expiry (`PASSWORD_RESET_EXPIRES_MINUTES`). Use SHA-256 (not bcrypt) so the hash is lookup-able.
3. Enqueue `NOTIFICATION_JOBS.PASSWORD_RESET_EMAIL` with `{ email, name, resetToken, resetUrl }` where `resetUrl` is `${APP_URL}/reset-password?token=...`
4. Processor logs the payload (no mailer yet)

**Reset** (`POST /auth/reset-password`):

1. SHA-256 the incoming token and `findByPasswordResetHash`
2. Reject if missing, expired, or inactive
3. `updatePassword`, `clearPasswordReset`, `revokeAll` sessions
4. Return a generic success message (client must login again)

### DTOs

- `RegisterDto`: name, email, password (min 8, upper + lower + number + special)
- `LoginDto`: email, password, optional `deviceInfo`
- `DeviceInfoDto`: optional `platform`, `deviceId`, `deviceName`, `appVersion`, `osVersion`, `userAgent`
- `RefreshTokenDto`: `refreshToken`
- `ChangePasswordDto`: `currentPassword`, `newPassword`
- `UpdateProfileDto`: optional name
- `ForgotPasswordDto`: email (normalized lowercase)
- `ResetPasswordDto`: token, newPassword
- `VerifyEmailDto`: token
- `ResendEmailVerificationDto`: email (normalized lowercase)

Email fields on register/login/forgot/resend use `@Transform` to trim + lowercase.

Pass `req.ip` and `req.headers['user-agent']` from the controller into `login` / `verify-email` as session context.

---

## Stage 7: Session management

**Commit:** `feat: add user session management`

### Tasks

- [ ] `SessionsRepository` wrapping Prisma
- [ ] `SessionsService` (create, list, validate, revoke, revoke all, revoke others, touch, Redis cache)
- [ ] `DeviceParserService` — parse web `User-Agent` with Bowser
- [ ] `SessionsController` under `auth/sessions`
- [ ] `SessionResponseDto`
- [ ] Import `SessionsModule` from `AuthModule`; export `SessionsService`

### Endpoints (all require access JWT)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/auth/sessions` | List current user's sessions |
| DELETE | `/auth/sessions/others` | Revoke every session except the current one |
| DELETE | `/auth/sessions/:id` | Revoke one session (must belong to current user) |
| DELETE | `/auth/sessions` | Revoke all sessions (logs out every device) |

Declare `/others` **before** `/:id` so `"others"` is not parsed as an id.

### Session create rules

- Default `platform` is `WEB`
- For `WEB`, parse `userAgent` (request header or `deviceInfo.userAgent`) with Bowser to fill `deviceName` and `osVersion` when the client omitted them
- For `IOS` / `ANDROID`, prefer explicit `deviceInfo` fields (`deviceId`, `deviceName`, `appVersion`, `osVersion`)
- Store `ipAddress` from the request
- Set `expiresAt` from `JWT_REFRESH_EXPIRES_IN`
- If the user already has `MAX_SESSIONS_PER_USER` active (not revoked) sessions, revoke the oldest one before creating the new session
- Invalidate Redis cache `sessions:{userId}` after create/revoke

### Repository methods

- `create(data)`
- `findById(id)`
- `findByUserId(userId)` — newest first
- `countActiveByUserId(userId)` — `isRevoked: false`
- `findOldestActive(userId)`
- `update(id, data)`
- `revoke(id)` — set `isRevoked: true`
- `revokeAll(userId)`
- `revokeOthers(userId, currentSessionId)`
- `revokeExpired()` — `expiresAt < now` and not already revoked (used by cron)

### Redis cache

- Key: `sessions:{userId}`
- TTL: `SESSION_CACHE_TTL`
- `getSessions` reads cache first, then DB
- Any revoke/create deletes the key

### `DeviceParserService`

```ts
parse(userAgent: string | undefined): { deviceName?: string; osVersion?: string }
```

Use Bowser: browser name + platform type → `deviceName`; OS version → `osVersion`.

### `SessionResponseDto`

```ts
{
  id: string;
  platform: Platform;
  deviceId: string | null;
  deviceName: string | null;
  appVersion: string | null;
  osVersion: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  isRevoked: boolean;
  isCurrent: boolean; // session.id === jwt.sessionId
}
```

List endpoint maps `isCurrent` from `CurrentUser().sessionId`.

`UsersService.softDelete` calls `sessionsService.revokeAll(userId)` so existing tokens stop working.

---

## Stage 8: BullMQ queues

**Commit:** `feat: add bullmq queues`

### Tasks

- [ ] Install `@nestjs/bullmq` + `bullmq`
- [ ] `QueuesModule` registers queues from constants
- [ ] `NotificationsProcessor` — welcome-email, email-verification, and password-reset-email jobs (log payload)
- [ ] `CronProcessor` — daily expired-session cleanup
- [ ] Register repeatable cron on module init
- [ ] `AuthService.register` / `resendEmailVerification` enqueue email-verification; `verifyEmail` enqueues welcome-email; `forgotPassword` enqueues password-reset-email
- [ ] Import `QueuesModule` in `AppModule`

```bash
npm install @nestjs/bullmq bullmq
```

### Constants (`queue.constants.ts`)

```ts
export const QUEUES = {
  NOTIFICATIONS: 'notifications',
  CRON: 'cron',
} as const;

export const NOTIFICATION_JOBS = {
  WELCOME_EMAIL: 'welcome-email',
  EMAIL_VERIFICATION: 'email-verification',
  PASSWORD_RESET_EMAIL: 'password-reset-email',
} as const;

export const CRON_JOBS = {
  CLEANUP_EXPIRED_SESSIONS: 'cleanup-expired-sessions',
} as const;
```

Welcome-email job data: `{ userId, email, name }` (after successful verify).  
Email-verification job data: `{ email, name, verificationToken, verifyUrl }`.  
Password-reset job data: `{ email, name, resetToken, resetUrl }`.

Processor logs with `LoggerService`. A mailer can replace the log later without changing producers.

Cron: daily (`0 0 * * *`). Calls `sessionsRepository.revokeExpired()` to mark sessions with `expiresAt` in the past as revoked.

`enableShutdownHooks()` in `main.ts` lets BullMQ workers close on process exit.

### `QueuesModule`

```ts
BullModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    connection: {
      host: config.getOrThrow('redis.host'),
      port: config.getOrThrow('redis.port'),
      password: config.get('redis.password') || undefined,
    },
  }),
})
BullModule.registerQueue(
  { name: QUEUES.NOTIFICATIONS },
  { name: QUEUES.CRON },
)
```

Use the same Redis connection settings as `RedisModule`.

---

## Stage 9: Health check

**Commit:** `feat: add health check`

### Tasks

- [ ] Install Terminus
- [ ] `HealthController` at `GET /health` (excluded from `api` prefix)
- [ ] Indicators: Prisma (`SELECT 1`), Redis `ping`, memory heap
- [ ] Public route and `@SkipThrottle()`

```bash
npm install @nestjs/terminus
```

Suggested response:

```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis": { "status": "up" },
    "memory_heap": { "status": "up" }
  }
}
```

Prisma check: `this.prisma.$queryRaw` `SELECT 1`.
Redis check: inject `REDIS_CLIENT` and `ping()`.

If Redis or Postgres is down, health returns HTTP 503.

Update `main.ts`:

```ts
app.setGlobalPrefix('api', { exclude: ['health'] });
```

---

## Stage 10: Seed + admin user

**Commit:** `feat: add database seeder`

### Tasks

- [ ] Implement `prisma/seed.ts` as the Prisma CLI runner only
- [ ] Implement `prisma/seeds/admin.seed.ts` (create admin if missing)
- [ ] Hash password with bcrypt (same salt rounds as `APP_CONSTANTS.SALT_ROUNDS`)
- [ ] Normalize admin email to lowercase
- [ ] Idempotent: skip if that email already exists

Do **not** add Nest seeder modules under `src/database/`. Seeds use `PrismaClient` directly so they work without Redis/queues.

### `prisma/seed.ts` (runner)

```ts
import '../src/config/load-env';
import { PrismaClient } from '@prisma/client';
import { seedAdmin } from './seeds/admin.seed';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  await seedAdmin(prisma);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

### `prisma/seeds/admin.seed.ts`

- Read `ADMIN_EMAIL` / `ADMIN_PASSWORD` from env
- `email = ADMIN_EMAIL.trim().toLowerCase()`
- `findUnique` by email; return if found
- `prisma.user.create` with `role: ADMIN`, `isEmailVerified: true`, `isActive: true`, hashed password
- Log `Admin user seeded: <email>`

Add more files under `prisma/seeds/` later (`roles.seed.ts`, etc.) and call them from `seed.ts`.

Runs with `prisma db seed` / `npm run seed`.

---

## Stage 11: GitHub Actions CI

**Commit:** `ci: add github actions workflow`

### Tasks

- [ ] Add `.github/workflows/ci.yml`
- [ ] Trigger on push/PR to `main` and `develop`
- [ ] Node 20, `npm ci`, `prisma generate`, format check, lint, build
- [ ] E2e job with Postgres + Redis service containers

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  lint-and-build:
    runs-on: ubuntu-latest
    env:
      DATABASE_HOST: localhost
      DATABASE_PORT: 5432
      DATABASE_USERNAME: user
      DATABASE_PASSWORD: pass
      DATABASE_NAME: ci
      DATABASE_SCHEMA: public
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run prisma:generate
      - run: npm run format:check
      - run: npm run lint
      - run: npm run build

  e2e:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: password
          POSTGRES_DB: nestjs_boilerplate
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
    env:
      NODE_ENV: development
      PORT: 3000
      APP_URL: http://localhost:3000
      CORS_ORIGINS: http://localhost:3000
      DATABASE_HOST: localhost
      DATABASE_PORT: 5432
      DATABASE_USERNAME: postgres
      DATABASE_PASSWORD: password
      DATABASE_NAME: nestjs_boilerplate
      DATABASE_SCHEMA: public
      JWT_SECRET: ci-access-token-secret-min-32-chars!!
      JWT_REFRESH_SECRET: ci-refresh-token-secret-min-32-chars!!
      REDIS_HOST: localhost
      REDIS_PORT: 6379
      ADMIN_EMAIL: admin@example.com
      ADMIN_PASSWORD: Admin@12345
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run prisma:migrate:deploy
      - run: npm run seed
      - run: npm run test:e2e
```

---

## Stage 12: README + final wiring

**Commit:** `docs: add boilerplate readme`

### Tasks

- [ ] Replace stock Nest README with a short project README
- [ ] Confirm `AppModule` import order and global guards
- [ ] Confirm stock `AppController` / `AppService` are gone
- [ ] Confirm Winston is wired with `app.useLogger`
- [ ] List scripts, env vars, and how to run locally (including e2e)
- [ ] Mark all stages complete in this file

### Local run (document in README)

```bash
docker compose up -d
cp .env.example .env.development
# set DATABASE_* and JWT secrets if they differ from compose defaults

npm install
npm run prisma:migrate
npm run seed
npm run start:dev
```

Needs Docker (Postgres + Redis) or equivalent services running locally.

### `AppModule` (final)

```
AppConfigModule
PrismaModule
UtilModule
LoggerModule
RedisModule
QueuesModule
UsersModule
AuthModule   # imports SessionsModule
HealthModule
```

Register `ThrottlerModule.forRootAsync` in `AppModule` (not only AuthModule) and provide `ThrottlerGuard` as a global `APP_GUARD` next to `JwtAuthGuard` and `RolesGuard`.

`RequestIdMiddleware` on `{*path}` (Nest 11 path-to-regexp wildcard).

`main.ts` globals: `bufferLogs` + `useLogger(LoggerService)`, `HttpExceptionFilter`, `LoggingInterceptor`, `ResponseInterceptor`.

---

## Stage 13: E2E suite

**Commit:** `test: add auth and health e2e`

### Tasks

- [ ] Replace stock `test/app.e2e-spec.ts`
- [ ] Add `test/helpers/prisma.ts` (PrismaClient for arranging verification tokens)
- [ ] Run against the same Compose / CI Postgres + Redis
- [ ] Keep tests small and stable

Use existing `npm run test:e2e` (`jest --config ./test/jest-e2e.json`). Tests boot the Nest app with `supertest`.

### Cases

| Case | Expect |
| --- | --- |
| `GET /health` | 200, database and redis up |
| `POST /api/auth/register` | 201/200, message only (no tokens) |
| Register same email, different case | 409 |
| `POST /api/auth/login` before verify | 401 |
| Arrange SHA-256 token on the user via Prisma, then `POST /api/auth/verify-email` | tokens + user |
| Login after verify | tokens |
| Login with `Admin@Example.com` vs seeded lowercase email | 200 (normalization) |
| `GET /api/auth/profile` with access token | 200, `isEmailVerified: true` |
| `DELETE /api/auth/profile` | success; reuse of access token → 401 |
| Register again with the deleted email | 201 (email freed by soft-delete rewrite) |
| Inactive user (set `isActive: false` via Prisma) login | 401 |

For verify-email, the raw token is not in the HTTP response. The test generates a token, writes `sha256(token)` + expiry with Prisma, then calls the API.

Point e2e `DATABASE_*` / Redis at Compose locally. CI uses service containers (Stage 11).

Throttle: use unique emails per test (timestamp or uuid) so auth limits do not flake. If needed, raise `THROTTLE_AUTH_LIMIT` in the e2e env.

---

## Naming and commits

| Kind | Style | Example |
| --- | --- | --- |
| Files | kebab-case | `jwt-auth.guard.ts` |
| Classes | PascalCase | `JwtAuthGuard` |
| Methods | camelCase | `findByEmail` |
| Constants | SCREAMING_SNAKE_CASE | `QUEUES` |
| DB columns | snake_case via `@map` | `created_at` |
| Commits | conventional, lower-case subject | `feat: add jwt auth with refresh tokens` |

Commitlint: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `revert`, `build`, `ci`. Subject max 100 chars, lower-case.

### Import order

1. Node built-ins
2. External packages
3. Internal `src/` modules
4. Relative imports
