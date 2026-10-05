# Imagine Now

sim, no prompt está descrito como imaginei, mas quero que você fique livre para deixar bem atrativo e dinâmico esse app - ele será usado em celulares principalmente

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2f610a4a-f356-40da-987d-591e5352e6ed).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Security and privacy configuration

Apply all SQL migrations in `drizzle/migrations` before deploying. The security
migration removes direct anonymous inserts and routes submissions through the
server, where validation, idempotency, a honeypot, and database-backed rate
limiting are enforced.

Configure these environment variables in the deployment platform:

- `SUPABASE_SERVICE_ROLE_KEY`: server-only Supabase key. Never expose it with a
  `VITE_` prefix.
- `VITE_PRIVACY_CONTACT`: the email address or contact channel shown in the
  privacy notice.
- `RATE_LIMIT_HASH_SECRET`: optional server-only secret used to pseudonymize
  request fingerprints. If omitted, the server-only Supabase service key is
  used as the secret.
- `VITE_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`: optional but recommended
  Cloudflare Turnstile keys. Configure both together to enable the challenge.

The browser draft is opt-in, expires after 24 hours, and can be deleted by the
person at any time. Health responses are never used to produce an automatic
diagnosis.
