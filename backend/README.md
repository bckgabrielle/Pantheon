# Pantheon backend

FastAPI + PostgreSQL storage for browser-based career memory.

```bash
cd backend
cp .env.example .env
# Create the PostgreSQL database/user described by DATABASE_URL, then:
venv/bin/uvicorn app.main:app --reload
```

For a no-setup local demo, put `DATABASE_URL=sqlite:///./pantheon.db` and `ALLOW_INSECURE_LOCALHOST=true` in `.env`. Do not use that insecure setting outside local development.

Interactive API documentation is at `http://127.0.0.1:8000/docs`. The extension contract is in [API_CONTRACT.md](API_CONTRACT.md).

## Verify the API

Restart Uvicorn after installing dependencies or changing environment settings, then visit:

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/
```

Protected endpoints require the API key from `.env`:

```bash
curl http://127.0.0.1:8000/tabs/current \
  -H "X-API-Key: replace-with-your-PANTHEON_API_KEY"
```

The development rate limiter allows 120 requests per client IP per minute by default. It is intentionally small and in-memory for this MVP; use a shared limiter (for example at an API gateway or in Redis) before scaling to multiple server processes.

## Inspect PostgreSQL

```bash
psql -h localhost -U pantheon -d pantheon
```

At the `pantheon=#` prompt:

```sql
\dt
SELECT id, email, name, created_at FROM users;
SELECT id, company, title, match_score, status FROM jobs;
SELECT id, status, submitted_at FROM applications;
SELECT id, message, remind_at, status FROM reminders;
SELECT id, title, url, is_open, first_seen_at FROM tabs;
\q
```
