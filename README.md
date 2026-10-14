# NINJA PANEL — SOURAJIT VFX

Pterodactyl-inspired self-hosted bot hosting panel for Python and Node.js.

## Important architecture note

A real hosting panel needs a Linux VPS with Docker. Do not deploy the Docker socket / container runner to a public free web host. This repository starts with a secure dashboard/API scaffold; the isolated runner must be installed on a VPS and configured with authentication before allowing users to create processes.

## Run the dashboard locally

```bash
npm install
ADMIN_PASSWORD='change-this-to-a-long-password' SESSION_SECRET='replace-with-at-least-32-random-characters' npm start
```

Open `http://localhost:3000`.

## Environment

- `PORT`: defaults to `3000`
- `ADMIN_PASSWORD`: required, minimum 12 characters
- `SESSION_SECRET`: required, minimum 32 characters

This starter does not yet start arbitrary user bots; it provides a login-protected panel UI and health endpoint. Deploy the dashboard and the isolated Docker runner as separate services on a VPS for real hosting.
## API (current implementation)

All routes use JSON. Browser account routes require an authenticated session.

- `GET /api/health` — health check.
- `GET /api/me` — current browser session.
- `POST /api/register` — public user registration.
- `POST /api/login` and `POST /api/logout` — browser authentication.
- `GET /api/servers` — currently returns an empty list and a runner-not-connected note.
- `GET /api/account/api-keys` — list the signed-in user's active API keys (never returns token secrets).
- `POST /api/account/api-keys` with `{"name":"my script"}` — create a key. Copy the returned `key.token` immediately; it is only shown once.
- `DELETE /api/account/api-keys/:id` — revoke one of the signed-in user's keys.
- `GET /api/v1/me` with header `Authorization: Bearer ninja_...` — verify an API token and return the account profile.

Example API request:

```sh
curl -H "Authorization: Bearer YOUR_NINJA_API_TOKEN" https://YOUR-PANEL-URL/api/v1/me
```

API tokens are stored as SHA-256 digests and can be revoked. Do not paste API tokens into public repositories, screenshots, or client-side websites.

## Not implemented yet

This commit adds account API-token management, not a Pterodactyl-equivalent execution engine. Server create/delete/start/stop, Docker runner authentication, live WebSocket console, file manager, resource enforcement, ports, backups, schedules, databases, and server allocations still require implementation and a separate secured Linux VPS. Do not expose the Docker socket to this public web service. For production, replace the JSON file and Express MemoryStore with a persistent database and persistent session store.
