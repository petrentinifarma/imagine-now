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

## Private Excel export

Patients only fill out and submit the form. They do not receive a copy of their
answers and have no access to the spreadsheet export.

To generate an editable Excel file with every submitted assessment, create an
ignored `.env.export.local` file on the administrative computer:

```dotenv
SUPABASE_SERVICE_ROLE_KEY=your-private-service-role-key
```

Never place this key in the tracked `.env` file. Then run:

```sh
npm run export:health-intakes
```

The file is created in `private-exports/`, which is excluded from Git. It
contains a summary by patient, a chronological evolution table, the complete
submitted data, and a usage guide. Assessments are grouped by normalized phone
number, so a phone change must be reconciled manually before longitudinal
comparison.

To select another private destination:

```sh
npm run export:health-intakes -- --output /protected/path/anamneses.xlsx
```

The command reads `VITE_SUPABASE_URL` from the existing `.env` file (or accepts
`SUPABASE_URL`) and reads the private key from `.env.export.local` or the
operating system environment. Never expose the service-role key in browser code
or variables prefixed with `VITE_`.
