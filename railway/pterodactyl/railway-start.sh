#!/bin/ash
set -eu
cd /app

# The upstream image entrypoint handles migrations before this custom command.
# Create an initial administrator only when the database contains no users.
if [ -n "${PTERODACTYL_ADMIN_EMAIL:-}" ] && [ -n "${PTERODACTYL_ADMIN_PASSWORD:-}" ]; then
  users="$(php artisan tinker --execute='echo "USERS=".\\\\Pterodactyl\\\\Models\\\\User::count();' 2>/dev/null | sed -n 's/.*USERS=\\([0-9][0-9]*\\).*/\\1/p' | tail -1 || true)"
  if [ "${users:-unknown}" = "0" ]; then
    if php artisan p:user:make --email="$PTERODACTYL_ADMIN_EMAIL" --username="${PTERODACTYL_ADMIN_USERNAME:-admin}" --name-first="${PTERODACTYL_ADMIN_FIRST_NAME:-Sourajit}" --name-last="${PTERODACTYL_ADMIN_LAST_NAME:-VFX}" --password="$PTERODACTYL_ADMIN_PASSWORD" --admin=1 --no-interaction; then
      echo "[ninja-panel] initial Pterodactyl admin account created."
    else
      echo "[ninja-panel] admin bootstrap failed; check logs and configure via php artisan p:user:make."
    fi
  elif [ "${users:-unknown}" != "unknown" ]; then
    echo "[ninja-panel] database already contains users; leaving accounts unchanged."
  else
    echo "[ninja-panel] unable to read user count; skipping admin bootstrap."
  fi
fi

exec supervisord -n -c /etc/supervisord.conf
