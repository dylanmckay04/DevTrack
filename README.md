# DevTrack

DevTrack is a full-stack job application tracker designed to feel fast, reliable, and production-oriented. It combines a drag-and-drop Kanban workflow with secure realtime updates, document storage, and scheduled reminders so users can manage their search in one place.

This project is the centerpiece of my portfolio and reflects how I approach software engineering end-to-end: product thinking, backend reliability, security hardening, and practical UX.

- Live app: https://dev-track-bice.vercel.app/
- Live API docs: https://devtrack-production-5644.up.railway.app/docs

## What This Project Demonstrates

- Full-stack ownership across React, FastAPI, PostgreSQL, Redis, and cloud storage
- Realtime architecture with server-authoritative events and user-scoped WebSocket delivery
- Security-focused implementation: rate limiting, upload validation, single-use socket tokens with replay protection
- Testing discipline with integration tests for authentication, authorization, CRUD, upload validation, and realtime edge cases
- CI pipeline with GitHub Actions running the full suite against real PostgreSQL and Redis service containers
- Flexible authentication: email/password and OAuth 2.0 (GitHub, Google) with automatic account linking
- Practical product design for a real user workflow rather than isolated feature demos

## Features

- Kanban board with four status columns: Applied -> Interviewing -> Offer -> Rejected
- Drag-and-drop Kanban cards with optimistic UI updates and automatic rollback on failed writes
- Full application CRUD with notes, job URL, and date tracking
- Document uploads (resume, cover letter) stored in Cloudflare R2, with content-type allowlisting and a 10 MB size cap
- In-app document preview: PDFs render inline via iframe, Word documents open in a new tab via presigned URLs
- Scheduled email reminders powered by Celery + Redis, with task IDs persisted so reminders can be cancelled before they fire
- Real-time board updates via WebSockets with automatic reconnect and token refresh
- Analytics dashboard with application stats and weekly activity charts
- JWT authentication with bcrypt-sha256 password hashing and short-lived signed WebSocket tokens
- Google and GitHub OAuth 2.0 sign-up/sign-in with automatic account linking by email
- Rate limiting on authentication endpoints (5 registrations/min, 10 logins/min) to prevent brute-force and enumeration attacks

## Key Engineering Highlights

- Server-originated board events (no client event echo) to keep the backend as the source of truth
- User-scoped websocket routing so clients only receive their own events
- Short-lived socket tokens minted from an authenticated HTTP endpoint
- Single-use jti replay protection backed by Redis, with a process-local fallback for temporary Redis outages
- Exponential-backoff websocket reconnect with token re-auth on reconnect
- Rate limiting on auth endpoints via slowapi (5/min register, 10/min login), disabled automatically in test runs
- Upload validation rejects non-PDF/Word content types and files over 10 MB before any cloud storage call

## Architecture

```text
┌─────────────┐     HTTP/WS      ┌─────────────────┐
│   React     │ ◄──────────────► │  FastAPI #1    │
│  Frontend   │                  │ (uvicorn + ws)  │
└─────────────┘                  └────────┬────────┘
                                        │
┌─────────────┐     HTTP/WS             │
│   React     │ ◄──────────────► ┌──────▼────────┐
│  Frontend   │                  │  FastAPI #2    │
└─────────────┘                  │ (uvicorn + ws) │
                                 └──────┬────────┘
                                        │
                     ┌────────────────────┼─────────────────────┐
                     │                    │                     │
              ┌──────▼──────┐    ┌───────▼────────┐    ┌──────▼────────┐
              │  PostgreSQL │    │     Redis      │    │  Cloudflare   │
              │  (database) │    │ (pub/sub +     │    │  R2           │
              │             │    │  task broker)  │    │ (file storage)│
              └─────────────┘    └───────┬────────┘    └──────────────┘
                                         │
                                 ┌───────▼───────┐
                                 │    Celery     │
                                 │    Worker     │
                                 └───────────────┘
```

## Tech Stack

### Languages

- Python
- JavaScript

### Frameworks

- FastAPI
- React

### Platform and Technical Components

- Alembic migrations
- SQLAlchemy ORM
- PostgreSQL
- Pydantic validation
- Uvicorn app server
- Cloudflare R2 for document storage
- Celery + Redis for scheduled reminders
- slowapi for request rate limiting
- User-scoped, server-originated WebSocket board events
- Pytest suite covering auth, CRUD, upload validation, and WebSocket security/replay hardening
- GitHub Actions CI (PostgreSQL 16 + Redis 7 service containers)

## Testing

The backend includes a pytest suite for authentication, authorization, application CRUD, and realtime/security behavior. Tests run against a dedicated PostgreSQL test database and use FastAPI TestClient with dependency overrides to isolate from production data.

### Test Coverage

- User registration and JWT authentication flow
- Protected route enforcement without a valid token
- Full application CRUD: create, read, update status, delete
- Authorization isolation (users cannot access each other’s applications)
- WebSocket event broadcast on application create/status updates
- Cross-user WebSocket event isolation
- Single-use short-lived socket token replay protection
- Redis-unavailable fallback behavior for socket token replay checks

Test strategy: focus on integration behavior at API and websocket boundaries where regressions are most likely to impact real users.

### Running Tests

1. Ensure a PostgreSQL database named devtrack_test exists locally.
2. From the backend directory, run:

```bash
pytest -v
```

## Technical Decisions

### Why Celery + Redis for reminders?

Reminders are one-off scheduled tasks at arbitrary times, which is a poor fit for cron-style scheduling. Running scheduling logic inside the FastAPI process risks losing pending tasks on process restarts. Celery workers with Redis persist scheduled tasks outside the web process and support scheduling with `apply_async(..., eta=...)`.

### Why WebSockets for board sync?

The board is a shared, stateful view. If one tab changes status, other tabs should update instantly without refresh. WebSockets provide low-latency server push and avoid polling overhead. DevTrack uses server-originated board events (not client echo) and user-scoped delivery so each user only receives their own events.

### Why enum-based application status?

The `ApplicationStatus` enum constrains status to `applied`, `interviewing`, `offer`, or `rejected`, preserving data integrity and ensuring each card maps to a valid board column.

### Why Cloudflare R2 over S3?

R2 is S3-compatible (same boto3 patterns) and avoids egress fees, which is cost-effective for frequent document download workflows.

### Why presigned URLs for document preview?

Rather than proxying file content through the FastAPI server (which would consume application memory and bandwidth), presigned URLs grant the frontend direct, time-limited access to R2 objects. This keeps the backend lightweight, shifts transfer costs to Cloudflare, and ensures URLs expire after 1 hour so leaked links become useless. PDF files render inline via a browser-native iframe; Word documents open in a new tab since browsers lack native .doc/.docx rendering.

### Why FastAPI over Flask?

FastAPI provides strong performance, automatic OpenAPI docs, and native async support that fits WebSockets and background-task workflows.

### Why PostgreSQL over SQLite?

PostgreSQL is a production-grade relational database with strong concurrency and integrity features. It also supports enum types used for application status.

### Why OAuth 2.0 alongside email/password?

Email/password authentication is familiar but creates friction for users who already trust GitHub or Google accounts. OAuth 2.0 reduces signup friction, eliminates password fatigue, and delegates credential security to providers with mature MSA and breach-detection infrastructure. The implementation links OAuth accounts to existing users by email (if a matching email/password account exists) so users can migrate seamlessly. The `hashed_password` column is nullable so OAuth-only users are first-class accounts.

## Security and Realtime Hardening

- Rate limiting on `/auth/register` (5/min) and `/auth/login` (10/min) to mitigate brute-force and credential-stuffing attacks
- OAuth 2.0 flows for GitHub and Google: authorization code exchange over HTTPS, scoped token requests (`user:email` for GitHub, `openid email profile` for Google), and primary-email fallback for GitHub accounts without a public email
- Document upload validation: content-type allowlist (PDF, Word) and 10 MB size cap enforced before any R2 call
- Document preview via presigned R2 URLs: ownership check before URL generation, 1-hour expiration limits exposure of leaked links
- Server-authoritative board events: application create/update/delete/status changes emit from backend after commit
- User-scoped delivery: each socket is bound to an authenticated user and receives only that user's events
- Short-lived socket tokens: frontend requests a dedicated token from `POST /auth/socket-token`
- Replay protection with `jti`: each socket token has a unique token ID that is consumed once at connect
- Redis-backed token tracking with fallback: Redis is primary, with process-local in-memory fallback for temporary Redis outages
- Client reconnect + re-auth: frontend reconnects with exponential backoff and mints a fresh socket token each attempt
- Global exception handler logs all unhandled errors with full context before returning a generic 500 response

Tradeoff note: in-memory connection management and fallback token tracking keep local development simple, but horizontal scale requires Redis pub/sub and shared token-state guarantees across instances.

## Local Development

1. Clone the repository:

```bash
git clone https://github.com/dylanmckay04/DevTrack.git
```

2. Create a `.env` file with the variables listed below.
3. Start services from project root:

```bash
docker compose up --build
```

4. Run the initial migration:

```bash
cd backend
alembic upgrade head
```

5. Verify health endpoint: http://localhost:8000/health
6. Open frontend: http://localhost:5173
7. Open local API docs: http://localhost:8000/docs

## Environment Variables

- `DATABASE_URL` (example: `postgresql://postgres:postgres@db:5432/devtrackdb`)
- `POSTGRES_USER` (example: `postgres`)
- `POSTGRES_PASSWORD` (example: `postgres`)
- `POSTGRES_DB` (example: `devtrackdb`)
- `SECRET_KEY` (generate securely, for example with Python `secrets.token_urlsafe(32)`)
- `REDIS_URL` (example: `redis://redis:6379/0`)
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_ACCOUNT_ID`
- `R2_BUCKET_NAME`
- `SMTP_HOST` (example: `smtp.gmail.com`)
- `SMTP_PORT` (example: `587`)
- `SMTP_USER`
- `SMTP_PASSWORD`
- `GITHUB_CLIENT_ID` (get from `https://github.com/settings/developers`)
- `GITHUB_CLIENT_SECRET` (get from `https://github.com/settings/developers`)
- `GITHUB_REDIRECT_URI` (example: `http://localhost/auth/github/callback`)
- `FRONTEND_URL` (example: `http://localhost:5173`)
- `GOOGLE_CLIENT_ID` (get from `console.cloud.google.com`)
- `GOOGLE_CLIENT_SECRET` (get from `console.cloud.google.com`)
- `GOOGLE_REDIRECT_URI` (example: `http://localhost/auth/google/callback`)

## API Endpoints

Interactive documentation: https://devtrack-production-5644.up.railway.app/docs

### Authentication

| Method | Endpoint | Description | Auth Required |
| --- | --- | --- | --- |
| POST | /auth/register | Create a new user account | No |
| POST | /auth/login | Login and receive a JWT token | No |
| GET | /auth/github | Redirect to GitHub OAuth authorization | No |
| GET | /auth/github/callback | GitHub OAuth callback handler | No |
| GET | /auth/google | Redirect to Google OAuth authorization | No |
| GET | /auth/google/callback | Google OAuth callback handler | No |
| GET | /auth/me | Get current authenticated user | Yes |
| POST | /auth/socket-token | Mint short-lived single-use WebSocket token | Yes |

### Applications

| Method | Endpoint | Description | Auth Required |
| --- | --- | --- | --- |
| GET | /applications | Get all applications for current user | Yes |
| POST | /applications | Create new application | Yes |
| GET | /applications/{id} | Get one application | Yes |
| PATCH | /applications/{id} | Update an application | Yes |
| PATCH | /applications/{id}/status | Update application status | Yes |
| DELETE | /applications/{id} | Delete an application | Yes |

### Documents

| Method | Endpoint | Description | Auth Required |
| --- | --- | --- | --- |
| POST | /applications/{id}/documents | Upload document to R2 | Yes |
| GET | /applications/{id}/documents | List application documents | Yes |
| GET | /applications/{id}/documents/{doc_id}/preview | Get presigned preview URL | Yes |
| DELETE | /applications/{id}/documents/{doc_id} | Delete document | Yes |

### Reminders

| Method | Endpoint | Description | Auth Required |
| --- | --- | --- | --- |
| POST | /reminders | Create scheduled reminder | Yes |
| GET | /reminders | Get reminders for current user | Yes |
| DELETE | /reminders/{id} | Delete reminder | Yes |

### WebSocket

| Protocol | Endpoint | Description |
| --- | --- | --- |
| WS | /ws/board | Real-time Kanban board sync |

## Known Limitations

- If Redis is unavailable, WebSocket pub/sub and socket token replay tracking falls back to process-local memory (not shared across instances)
- Reminders cannot be edited after creation

## Future Improvements

- Redis cluster support for high availability
