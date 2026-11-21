# Redis Setup Guide — Shared Rate Limits and Short-Lived Cache State

## Decision

**Redis is not required for the current setup.** The API currently runs with a process-local rate limiter and bounded in-memory signed-URL caches. That is sufficient for one Express process.

Add Redis when at least one of these becomes true:

- You run **two or more API instances/containers** behind a load balancer.
- You need a **single global limit** such as “10 image refreshes per user per minute” across all instances.
- You need shared short-lived state for abuse prevention, image-refresh cooldowns, or a shared signed-URL cache.
- You want central visibility into counter/cache keys during incidents.

Do **not** add Redis for these reasons:

- It will not fix missing or broken images by itself.
- It is not a replacement for Supabase/PostgreSQL data.
- It is not needed for signed-URL correctness: Supabase signing is stateless, and `refresh: true` already bypasses the local signed-URL cache.
- It will not replace the client-side image cooldown; that still helps avoid unnecessary requests.

**Recommendation for this project:** keep the current in-memory limiter until multi-instance deployment is real. When it is, implement **Phase 1 only** below. Phases 2 and 3 are optional follow-ups.

### RackNerd VM deployment decision

For the planned single RackNerd VM with roughly 30+ users per day, **do not install Redis**. Run one Express process using `systemd` or PM2 `fork` mode, with Nginx as the reverse proxy if needed. At this traffic level, the process-local limiter and bounded signed-URL cache are more than sufficient, and a server restart resetting a one-minute counter is acceptable.

Redis becomes necessary only if that VM starts multiple Node workers or containers, such as PM2 `cluster` mode, Docker replicas, or several API instances behind a load balancer. If clustering is enabled, either set the worker count to `1` or implement Phase 1 below so all workers share the same rate-limit counter.

---

## Scope

| Phase | What Redis stores | Benefit | Priority |
|---|---|---|---|
| 1 | Rate-limit counters | True global 10/min limit across all API replicas | Do this first |
| 2 | Image-refresh cooldown keys | One re-sign per asset per 60s across devices/users | Optional |
| 3 | Signed-URL cache entries | Fewer duplicate Supabase signing calls across replicas | Optional, more complex |

This guide uses `ioredis` and keeps `memory` as the default store so existing tests and local development keep working.

---

## Phase 0 — Local Redis

### Option A: Docker Desktop (preferred on Windows)

```powershell
docker run --name mm-redis -p 6379:6379 -d redis:7-alpine
```

Verify:

```powershell
docker exec -it mm-redis redis-cli ping
```

Expected:

```text
PONG
```

Stop/start later:

```powershell
docker stop mm-redis
docker start mm-redis
```

Remove it:

```powershell
docker rm -f mm-redis
```

Persistence is not required for rate-limit counters or signed-URL cache entries. If you want persistence anyway, add `-v mm-redis-data:/data` and start with `redis-server --appendonly yes`.

### Option B: Native Windows / WSL2

Use one of:

- **Memurai** (Windows service, Redis-compatible).
- **WSL2 + Redis**: `sudo apt install redis-server` then `sudo service redis-server start`.

Verify from PowerShell or WSL:

```bash
redis-cli ping
```

### Option C: Managed Redis

Use a managed provider on a private network with TLS, for example:

- Upstash Redis
- Aiven for Redis
- AWS ElastiCache
- Azure Cache for Redis

Use a `rediss://...` connection URL in production.

---

## Phase 1 — Shared Rate Limiter

### 1. Add the dependency

From `server/`:

```powershell
npm install ioredis
```

This updates `package.json` and `package-lock.json`. Commit both.

### 2. Add environment variables

Add to `server/src/.env` for local use:

```env
RATE_LIMIT_STORE=memory
REDIS_URL=redis://localhost:6379
REDIS_KEY_PREFIX=mm:
```

Add the same keys with safe defaults to `server/src/.env.example`:

```env
# memory | redis
RATE_LIMIT_STORE=memory
REDIS_URL=redis://localhost:6379
REDIS_KEY_PREFIX=mm:
```

For managed TLS Redis:

```env
RATE_LIMIT_STORE=redis
REDIS_URL=rediss://USER:PASSWORD@HOST:6380
REDIS_KEY_PREFIX=mm:
```

Add defaults in `server/src/config/env.js` alongside the existing `autoExport()` defaults:

```js
if (!process.env.RATE_LIMIT_STORE) process.env.RATE_LIMIT_STORE = 'memory';
if (!process.env.REDIS_KEY_PREFIX) process.env.REDIS_KEY_PREFIX = 'mm:';
```

`REDIS_URL` should remain explicit; do not invent a production default.

### 3. Create `server/src/config/redis.js`

```js
import Redis from 'ioredis';

const store = process.env.RATE_LIMIT_STORE || 'memory';
const url = process.env.REDIS_URL;
const keyPrefix = process.env.REDIS_KEY_PREFIX || 'mm:';

let client = null;

if (store === 'redis') {
  if (!url) throw new Error('REDIS_URL is required when RATE_LIMIT_STORE=redis');

  const options = {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: (times) => Math.min(times * 200, 2000),
  };
  if (url.startsWith('rediss://')) options.tls = {};

  client = new Redis(url, options);
  client.on('error', (error) => console.error('Redis connection error:', error.message));
}

export function isRedisEnabled() {
  return store === 'redis';
}

export function getRedis() {
  if (!client) throw new Error('Redis is not enabled');
  return client;
}

export function redisKey(...parts) {
  return `${keyPrefix}${parts.join(':')}`;
}

export async function closeRedis() {
  if (client && client.status !== 'end') await client.quit();
}
```

### 4. Add a store adapter to `server/src/middleware/rateLimit.js`

Keep the existing in-memory `Map` as the default. Add an injected `store` option with this contract:

```js
// Returns { count, retryAfterMs }
await store.increment(key, windowMs);
```

The Redis implementation must be atomic. Use a Lua script, not separate `INCR` + `EXPIRE` calls:

```js
const incrementScript = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
  return { count, redis.call('PTTL', KEYS[1]) }
`;

async function increment(key, windowMs) {
  const redis = getRedis();
  const [count, ttl] = await redis.eval(incrementScript, 1, redisKey('ratelimit', key), windowMs);
  return { count, retryAfterMs: Math.max(1, Number(ttl)) };
}
```

Middleware changes:

- Make the returned middleware `async`.
- Call `await store.increment(...)`.
- Keep the key as `${keyPrefix}${req.user?.id || req.ip || 'anonymous'}`.
- Namespace the Redis key with `redisKey('ratelimit', key)`.
- Keep `Retry-After` based on `retryAfterMs / 1000`.
- If Redis throws, **fail open** initially: log (throttled) and call `next()`. This prevents a Redis outage from blocking every user. Revisit fail-closed only if abuse risk requires it.

Important: keep rate limiters **after** `authenticate` on protected routes so the key is `req.user.id`, with IP only as fallback.

No route changes are needed for the current endpoints:

- `server/src/routes/assetRoutes.js`
- `server/src/routes/adminAssetRoutes.js`
- all existing admin/vendor/geocode route modules

They already call `rateLimit({ ... })`, so they will pick up the shared store through the factory default.

### 5. Add graceful shutdown

In `server/src/app.js`, close Redis on `SIGTERM`/`SIGINT` so connections drain cleanly:

```js
import { isRedisEnabled, closeRedis } from './config/redis.js';

async function shutdown() {
  if (isRedisEnabled()) await closeRedis();
  process.exit(0);
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
```

### 6. Tests

Update `server/tests/rateLimit.test.js` for the async store contract:

- existing tests continue with the in-memory store;
- add a fake store test proving `increment()` is awaited;
- add a fake store failure test proving the middleware fails open;
- assert `Retry-After` is derived from `retryAfterMs`.

Do not require a live Redis server in the default test suite. If you want an integration test, gate it behind `REDIS_TEST_URL`:

```js
const redisTest = process.env.REDIS_TEST_URL ? test : test.skip;
```

---

## Phase 2 — Shared Image-Refresh Cooldown (Optional)

The client already stores a 60-second cooldown in `localStorage`. That covers one browser. Redis can enforce it globally.

Integration point: `createRefreshAssetImageHandler()` in `server/src/controllers/assetController.js`.

Suggested Redis key:

```text
mm:image-refresh:cooldown:<size>:<hash(normalized object path)>
```

TTL:

```text
60 seconds
```

Flow:

1. Validate and parse the object path with `parseAssetObjectPath()` as today.
2. Atomically check/set the cooldown key.
3. If the key already exists:
   - return a cached signed URL from Redis if one is stored, otherwise
   - return `429 RATE_LIMITED` with an accurate `Retry-After`.
4. If the key was newly set, perform the DB reference check and sign one asset.

Use the same storage-path normalization as the client so signed-token changes do not bypass the cooldown.

This phase can re-use the atomic Lua helper from Phase 1.

---

## Phase 3 — Shared Signed-URL Cache (Optional)

Only do this after Phase 1 is stable and you have measured duplicate signing calls across replicas.

Key format:

```text
mm:asset-url:<bucket>:<size>:<objectPath>
```

Value:

```text
the signed URL string
```

TTL:

```text
3000 seconds (same as BUCKET_DURATION)
```

Requirements:

- Keep `refresh: true` bypassing the cached value so recovery always re-signs.
- Use an in-flight lock (`SET key token NX PX 10000`) to coalesce concurrent signings.
- On upload/replace, invalidate every size variant for the object path. Avoid `KEYS` in production; keep a Redis `SET` of cache keys per object path and delete its members.
- Keep the local in-memory cache as a short L1 cache only if its invalidation story remains simple; otherwise remove it.

This is the highest-complexity phase because invalidation must work across every API instance.

---

## Production checklist

- [ ] Redis runs on a private network, not exposed to the internet.
- [ ] Production uses `rediss://` TLS and a password/ACL.
- [ ] `RATE_LIMIT_STORE=redis` is set on every API instance.
- [ ] `REDIS_KEY_PREFIX` matches across instances and environments.
- [ ] Redis maxmemory policy is `noeviction` for rate-limit counters, or counters live in a dedicated Redis DB.
- [ ] Monitoring covers memory, `evicted_keys`, connection count, and command latency.
- [ ] `closeRedis()` runs on `SIGTERM`.
- [ ] Rollback tested: set `RATE_LIMIT_STORE=memory` and restart all instances.

Do not store orders, notifications, auth sessions, or other business state in Redis as part of this work. Supabase remains the source of truth.

---

## Verification

Local smoke test:

```powershell
docker exec -it mm-redis redis-cli ping
cd server
npm test
```

With `RATE_LIMIT_STORE=redis` and the server running:

```powershell
# Hit the refresh endpoint 11 times with the same bearer token.
# The 11th response must be 429 RATE_LIMITED with Retry-After.

docker exec -it mm-redis redis-cli --scan --pattern "mm:ratelimit:*"
```

Multi-instance test:

1. Start API instance A on port `4000` and instance B on port `4001`, both pointing to the same Redis.
2. Send 5 refresh requests to A and 5 to B with the same token.
3. The next request to either instance must be limited.
4. Stop one instance and confirm the surviving instance still enforces the counter.

If that passes, Phase 1 is complete. Do not proceed to Phase 2 or 3 unless there is a measured need.

---

## Rollback

1. Set `RATE_LIMIT_STORE=memory` in the environment.
2. Restart every API instance.
3. Optionally remove `ioredis` with `npm uninstall ioredis`.
4. Delete Redis keys with the configured prefix only if you need a clean slate:

```powershell
docker exec -it mm-redis redis-cli --scan --pattern "mm:*" | ForEach-Object { docker exec -it mm-redis redis-cli DEL $_ }
```

Current application data is unaffected; Redis only holds short-lived counters/cache values.
