#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# A repository can update only its own Compose project and release directory.
exec 9>.deploy.lock
flock 9
# Ubuntu's legacy docker-compose does not provide the Compose v2 plugin.
# Use the existing indexes: a background update may hold the separate lists lock.
# Wait for the install lock instead of deleting locks or stopping package-manager processes.
if ! docker compose version >/dev/null 2>&1; then
    DEBIAN_FRONTEND=noninteractive apt-get -o DPkg::Lock::Timeout=300 install -y --no-install-recommends docker-compose-v2
    docker compose version >/dev/null
fi
compose=(docker compose --project-name personal-wish-list-bot --env-file .release.env -f docker-compose.prod.yml)
"${compose[@]}" config --quiet
"${compose[@]}" pull
mkdir -p uploads runtime
[ -f service-account.prod.json ] || { echo "Missing runtime service account" >&2; exit 1; }
docker volume create personal-wish-list-bot-caddy-data >/dev/null
docker volume create personal-wish-list-bot-caddy-config >/dev/null
docker run --rm --network none -e ACME_EMAIL="${ACME_EMAIL:-fedorrychkov@yandex.ru}" -v "$PWD/.docker/production:/etc/caddy:ro" caddy:2.11.7-alpine caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile

# Stop only this project's old containers on its first migration; retain them for rollback.
stopped=()
rollback_legacy() {
    if [ "${#stopped[@]}" -gt 0 ]; then
        "${compose[@]}" stop app gateway || true
        for ((i=${#stopped[@]}-1; i>=0; i--)); do docker start "${stopped[$i]}" >/dev/null; done
    fi
}
trap rollback_legacy ERR
legacy=(nginx-container nestjs-container)
for container in "${legacy[@]}"; do
    if [ "$(docker inspect --format '{{.State.Running}}' "$container" 2>/dev/null || true)" = true ]; then
        docker stop "$container" >/dev/null
        stopped+=("$container")
    fi
done
if [ ! -f .runtime-migrated ] && docker inspect nestjs-container >/dev/null 2>&1; then
    for item in uploads sessions.json; do
        destination=uploads
        [ "$item" != sessions.json ] || destination=runtime/sessions.json
        # A missing old path is normal. Other copy errors abort rather than lose state.
        source_path="nestjs-container:/usr/src/app/$item"
        [ "$item" != uploads ] || source_path="$source_path/."
        error_file=$(mktemp)
        if ! docker cp "$source_path" "$destination" 2>"$error_file"; then
            if ! grep -Eq 'Could not find|no such file or directory|No such container:path' "$error_file"; then
                cat "$error_file" >&2
                rm -f "$error_file"
                false
            fi
        fi
        rm -f "$error_file"
    done
fi

"${compose[@]}" up -d --no-deps app
app_id=$("${compose[@]}" ps -q app)
ready=false
for ((attempt=0; attempt<90; attempt++)); do
    if [ "$(docker inspect --format '{{.State.Health.Status}}' "$app_id")" = healthy ]; then
        ready=true
        break
    fi
    sleep 2
done
if [ "$ready" != true ]; then
    echo 'Application healthcheck failed; deployment stopped.' >&2
    false
fi
gateway_id=$("${compose[@]}" ps -q gateway)
if [ -n "$gateway_id" ] && [ "$(docker inspect --format '{{.State.Running}}' "$gateway_id")" = true ]; then
    # Reload routes without restarting the shared gateway or its other web application.
    "${compose[@]}" exec -T gateway caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
else
    "${compose[@]}" up -d --no-deps gateway
fi
for ((attempt=0; attempt<60; attempt++)); do
    if curl --fail --silent --show-error --connect-timeout 3 --max-time 10 https://wish-bot-api.dev-api-services.com/v1/healthcheck >/dev/null 2>&1; then
        echo 'Public HTTPS and its certificate are valid.'
        break
    fi
    if [ "$attempt" -eq 59 ]; then
        echo 'Public HTTPS check failed. Check DNS, ports 80/443 and gateway logs.' >&2
        false
    fi
    sleep 3
done
touch .runtime-migrated
trap - ERR
echo 'Production application is healthy.'
