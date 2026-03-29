<h1>DevTrack</h1>
<p>A full-stack job application tracker built for developers. Track applications across a kanban board, upload documents to cloud storage, and schedule email reminders - all updated in real time via WebSockets.</p>
<p>To try the <strong>live full-stack application</strong>, click <a href="https://dev-track-bice.vercel.app/" target="_blank">here</a>.</p>
<p>To see the <strong>live API documentation</strong>, click <a href="https://devtrack-production-5644.up.railway.app/docs" target="_blank">here</a>.</p>

<h2>Features</h2>
<ul>
    <li>Kanban board with four status columns: <strong>Applied → Interviewing → Offer → Rejected</strong></li>
    <li>Full application CRUD with notes, job URL, and date tracking</li>
    <li>Document uploads (resumes, cover letters) stored in <strong>Cloudflare R2</strong></li>
    <li>Scheduled email reminders powered by <strong>Celery + Redis</strong></li>
    <li>Real-time board updates via <strong>WebSockets</strong> - no page refresh required</li>
    <li>Analytics dashboard with application stats and weekly activity charts</li>
    <li>JWT authentication with bcrypt-sha256 password hashing</li>
</ul>

<h2>Architecture</h2>
<pre>
┌─────────────┐     HTTP/WS      ┌─────────────────┐
│   React     │ ◄──────────────► │     FastAPI     │
│  Frontend   │                  │    (uvicorn)    │
└─────────────┘                  └────────┬────────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    │                     │                     │
             ┌──────▼──────┐    ┌─────────▼─────┐    ┌────────▼───────┐
             │  PostgreSQL │    │     Redis     │    │  Cloudflare R2 │
             │  (database) │    │ (task broker) │    │ (file storage) │
             └─────────────┘    └───────┬───────┘    └────────────────┘
                                        │
                                ┌───────▼───────┐
                                │    Celery     │
                                │    Worker     │
                                └───────────────┘
</pre>

<h2>Tech Stack</h2>
<h3>Languages</h3>
<ul>
    <li><a href="https://python.org" target="_blank">Python</a></li>
    <li><a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript" target="_blank">JavaScript</a></li>
</ul>
<h3>Frameworks</h3>
<ul>
    <li><a href="https://fastapi.tiangolo.com/" target="_blank">FastAPI</a></li>
    <li><a href="https://react.dev/" target="_blank">React</a></li>
</ul>
<h3>Technical Features</h3>
<ul>
    <li><a href="https://alembic.sqlalchemy.org/en/latest/" target="_blank">Alembic</a> migrations</li>
    <li>Authentication service with JWT tokens</li>
    <li>Backend server running on <a href="https://uvicorn.dev/" target="_blank">uvicorn</a></li>
    <li>bcrypt-sha256 password encryption</li>
    <li><a href="https://docs.celeryq.dev/en/stable/" target="_blank">Celery</a> + <a href="https://redis.io/" target="_blank">Redis</a> task queue for scheduled email reminders</li>
    <li><a href="https://developers.cloudflare.com/r2/" target="_blank">Cloudflare R2</a> for document storage</li>
    <li>Data validation with <a href="https://docs.pydantic.dev/latest/" target="_blank">Pydantic</a></li>
    <li><a href="https://www.postgresql.org/" target="_blank">PostgreSQL</a> database</li>
    <li>pytest test suite covering authentication, application CRUD, and WebSockets (20 tests)</li>
    <li><a href="https://www.sqlalchemy.org/" target="_blank">SQLAlchemy</a> for ORM interaction</li>
    <li>WebSocket support for real-time board sync</li>
</ul>
<h2>Testing</h2>
<p>The backend includes a pytest test suite covering authentication and core application CRUD operations. Tests run against a dedicated PostgreSQL test database and use FastAPI's <code>TestClient</code> with SQLAlchemy dependency overrides to ensure full isolation from the production database.</p>

<h3>Test Coverage</h3>
<ul>
    <li>User registration and JWT authentication flow</li>
    <li>Protected route enforcement without a valid token</li>
    <li>Full application CRUD: create, read, update status, delete</li>
    <li>Authorization isolation - users cannot access other users' applications</li>
</ul>

<h3>Running the tests</h3>
<ol>
    <li>Ensure a PostgreSQL database named <code>devtrack_test</code> exists locally</li>
    <li>From the <code>backend</code> directory, run <code>pytest -v</code></li>
</ol>
<h2>Technical Decisions</h2>
<h3>Why Celery + Redis for email reminders?</h3>
<p>Reminders need to fire at arbitrary user-defined times, which makes a cron job a poor fit - cron is designed for recurring tasks on a fixed schedule, not one-off events at unpredictable future times. A background thread inside FastAPI would work for simple cases but runs inside the same process as the web server, meaning any pending reminders would be lost if the server restarts. Celery with Redis as the broker runs in a completely separate worker process, persisting scheduled tasks in Redis so they survive server restarts. The <code>apply_async</code> method with an <code>eta</code> parameter maps directly to the reminder use case: schedule this task to run at a specific future datetime.</p>

<h3>Why WebSockets for the kanban board?</h3>
<p>The kanban board is a shared, stateful view - if two users (or two browser tabs) are looking at the same board and one moves an application to a new status, the other should see the change immediately without refreshing. WebSockets provide a persistent two-way connection between the client and server, allowing the server to push status updates to all connected clients the moment a change occurs. A polling approach would achieve a similar result but with unnecessary latency and wasted requests.</p>

<h3>Why use an enum for application status?</h3>
<p>The <code>ApplicationStatus</code> enum defined in the application model constrains the status field to exactly four valid values: <code>applied</code>, <code>interviewing</code>, <code>offer</code>, and <code>rejected</code>. This serves two purposes: it ensures data integrity at the database level so no invalid status string can ever be persisted, and it maps each application to exactly one kanban column. Without this constraint, a typo or unexpected value in the status field would silently cause an application to disappear from the board.</p>

<h3>Why Cloudflare R2 over AWS S3?</h3>
<p>R2 is S3-compatible, meaning it uses the same boto3 API - the only code change required is pointing the endpoint URL at Cloudflare's storage domain instead of AWS. R2 was chosen because it has no egress fees, whereas S3 charges for data transferred out of storage. For a document storage use case where files are frequently downloaded, this is a meaningful cost difference at scale.</p>

<h3>Why FastAPI over Flask?</h3>
<p>FastAPI was chosen for its performance, automatic Swagger/OpenAPI documentation generation, and native async support - which is important for a project using WebSockets and background tasks. Flask is a lightweight micro-framework that lacks these features out of the box.</p>

<h3>Why PostgreSQL over SQLite?</h3>
<p>PostgreSQL is the standard for modern production applications. Unlike SQLite, which stores the entire database in a single file, PostgreSQL is a full object-relational database system with strong support for concurrency, data integrity, and security. It also natively supports the <code>ENUM</code> type used for application status.</p>

<h2>How to run <em>DevTrack</em> locally</h2>
<ol>
    <li>Clone the Git repository by running <code>git clone https://github.com/dylanmckay04/DevTrack.git</code></li>
    <li>Create a <code>.env</code> file and add the necessary environment variables (<a href="#env">see section below</a>)</li>
    <li>Ensure <a href="https://www.docker.com/" target="_blank">Docker</a> is running and run <code>docker compose up --build</code> from the project root</li>
    <li>In a separate terminal, run the initial database migration: <code>cd backend && alembic upgrade head</code></li>
    <li>Go to <a href="http://localhost:8000/health" target="_blank">http://localhost:8000/health</a> and you should see <code>{"status": "ok"}</code></li>
    <li>Visit <a href="http://localhost:5173" target="_blank">http://localhost:5173</a> in your browser to use DevTrack</li>
    <li>API documentation is available at <a href="http://localhost:8000/docs" target="_blank">http://localhost:8000/docs</a></li>
</ol>

<h2 id="env">Environment Variables</h2>
<ol>
    <li><strong>DATABASE_URL</strong> - ex. <code>postgresql://postgres:postgres@db:5432/devtrackdb</code></li>
    <li><strong>POSTGRES_USER</strong> - ex. <code>postgres</code></li>
    <li><strong>POSTGRES_PASSWORD</strong> - ex. <code>postgres</code></li>
    <li><strong>POSTGRES_DB</strong> - ex. <code>devtrackdb</code></li>
    <li><strong>SECRET_KEY</strong> - create a secure token using <code>import secrets;secrets.token_urlsafe(32)</code></li>
    <li><strong>REDIS_URL</strong> - ex. <code>redis://redis:6379/0</code></li>
    <li><strong>R2_ACCESS_KEY_ID</strong> - from Cloudflare R2 → Manage R2 API Tokens</li>
    <li><strong>R2_SECRET_ACCESS_KEY</strong> - from Cloudflare R2 → Manage R2 API Tokens</li>
    <li><strong>R2_ACCOUNT_ID</strong> - found on the R2 dashboard sidebar</li>
    <li><strong>R2_BUCKET_NAME</strong> - the name of your R2 bucket</li>
    <li><strong>SMTP_HOST</strong> - ex. <code>smtp.gmail.com</code></li>
    <li><strong>SMTP_PORT</strong> - ex. <code>587</code></li>
    <li><strong>SMTP_USER</strong> - your sending email address</li>
    <li><strong>SMTP_PASSWORD</strong> - your SMTP app password</li>
</ol>

<h2>API Endpoints</h2>
<p>Interactive documentation is available at the live API: <a href="https://devtrack-production-5644.up.railway.app/docs" target="_blank">https://devtrack-production-5644.up.railway.app/docs</a></p>

### Authentication
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | /auth/register | Create a new user account | No |
| POST | /auth/login | Login and receive a JWT token | No |
| GET | /auth/me | Get the current authenticated user | Yes |

### Applications
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | /applications | Get all applications for current user | Yes |
| POST | /applications | Create a new application | Yes |
| GET | /applications/{id} | Get a single application | Yes |
| PATCH | /applications/{id} | Update an application | Yes |
| PATCH | /applications/{id}/status | Update application status | Yes |
| DELETE | /applications/{id} | Delete an application | Yes |

### Documents
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | /applications/{id}/documents | Upload a document to R2 | Yes |
| GET | /applications/{id}/documents | Get all documents for an application | Yes |
| DELETE | /applications/{id}/documents/{doc_id} | Delete a document | Yes |

### Reminders
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | /reminders | Create a scheduled reminder | Yes |
| GET | /reminders | Get all reminders for current user | Yes |
| DELETE | /reminders/{id} | Delete a reminder | Yes |

### WebSocket
| Protocol | Endpoint | Description |
|----------|----------|-------------|
| WS | /ws/board | Real-time kanban board sync |

<h2>Known Limitations</h2>
<ul>
    <li>WebSocket connections are managed in-memory, so board sync only works within a single server instance and does not persist across restarts.</li>
    <li>Documents cannot be previewed in the app - only uploaded and deleted.</li>
    <li>Reminders cannot be edited after creation, only deleted.</li>
    <li>No pagination on the kanban board for users with large numbers of applications.</li>
</ul>

<h2>Future Improvements</h2>
<ul>
    <li>Drag-and-drop kanban cards to update status.</li>
    <li>Presigned URL document preview so files can be viewed in the browser.</li>
    <li>WebSocket pub/sub via Redis so real-time sync works across multiple server instances.</li>
    <li>OAuth login (GitHub, Google) in addition to email/password.</li>
    <li>Email notification when application status changes.</li>
</ul>
