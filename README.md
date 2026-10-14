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