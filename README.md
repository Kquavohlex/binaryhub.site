# NovaTrade — PalOption-inspired demo simulator

This is an independent demo application with a dark trading-terminal interface. It is **not affiliated with PalOption** and does not reproduce its private source code.

## Included
- Responsive frontend, login/register screens, simulated chart, demo trade form and history.
- Node.js + Express backend and PostgreSQL schema.
- Password hashing with bcrypt, short-lived HttpOnly JWT cookie, Helmet headers, rate limiting, input validation, parameterized SQL, and transaction/row locking for virtual balances.
- Virtual demo balance and ledger.
- M-Pesa route scaffold that is disabled by default.

## Important limits
- **Demo-only trading:** prices and outcomes are simulated/random. There is no live market feed and no real order execution.
- **M-Pesa is NOT implemented.** The status endpoint reports configuration; deposit and withdrawal endpoints return a clear error/501. Do not set `MPESA_ENABLED=true` expecting working payments.
- Payment records are deliberately separate from virtual trading funds. Never convert a real payment into a demo balance automatically.
- This is a starter project, not a production-ready financial service. Before production use, obtain a security review, add email verification/password reset, CSRF protection appropriate to the deployment, audit logging, monitoring, backup/restore tests, and abuse controls.

## Run locally (Android or computer)
A computer with Node.js 20+ and PostgreSQL is easiest. On Android, use a Linux environment such as Termux only if you are comfortable managing Node and PostgreSQL; cloud deployment is often simpler.

1. Install Node.js 20+ and PostgreSQL.
2. Create a database, for example:
   ```sql
   CREATE DATABASE paloption_demo;
   ```
3. Copy `.env.example` to `.env`. Set `DATABASE_URL` and a long random `JWT_SECRET`. Keep `.env` private and never upload it to GitHub.
4. Apply the schema:
   ```bash
   psql "$DATABASE_URL" -f schema.sql
   ```
5. Install and start:
   ```bash
   npm install
   npm start
   ```
6. Open `http://localhost:3000`, create an account, and practice with virtual funds.

## Deploy (beginner guide)
1. Push this folder to a **private GitHub repository**. Do not commit `.env`.
2. Create a managed PostgreSQL database, such as Neon or Render PostgreSQL. Copy its connection string.
3. Create a Node web service from that repository. Build command: `npm install`; start command: `npm start`.
4. Set environment variables in the hosting dashboard: `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET` (a new random secret), and `APP_ORIGIN` to your HTTPS domain.
5. Run `schema.sql` against the hosted database using its SQL editor or `psql`.
6. Visit `/api/health`. It should return `{"ok":true,"mode":"demo-only"}`.
7. Test registration, sign-in, virtual top-up, trade, and trade history. Test with a throwaway account first.

### Generate a JWT secret
Use a secure random generator, for example:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```
Paste the output into the host's secret/environment settings. Do not share it in chats or commit it.

## M-Pesa / Safaricom Daraja — not configured
To implement real STK Push deposits and B2C withdrawals, you need a Safaricom Daraja app, approved shortcode/till/paybill arrangement appropriate to the product, production credentials, publicly reachable HTTPS callback URLs, and any required business/regulatory approvals. The exact setup depends on your merchant account and use case.

Before enabling real transactions, implement and test:
- OAuth token acquisition and expiry handling.
- STK Push initiation and callback parsing.
- Callback authentication/verification where supported, amount/phone/reference validation, idempotency, and durable reconciliation.
- B2C payout initiation, result and timeout callbacks, operator authorization, withdrawal limits, fraud checks, and reconciliation.
- A separate **real-money ledger** with database transactions and immutable audit records. Never use `demo_wallets` for actual money.
- Sandbox tests and a controlled production rollout.

This project intentionally does not include working payment initiation because adding credentials alone is not enough to make payment flows safe. The endpoints remain disabled/incomplete.

## API overview
- `POST /api/auth/register` — `{ "email", "password", "displayName" }`
- `POST /api/auth/login` — `{ "email", "password" }`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/wallet/`
- `POST /api/wallet/demo-credit` — `{ "amount": 1000 }`, virtual units only
- `POST /api/trades/` — `{ "asset":"EUR/USD", "direction":"up", "stake":100, "durationSeconds":30 }`
- `GET /api/trades/`
- `POST /api/trades/:id/settle` — simulator settlement
- `GET /api/mpesa/status`
- `POST /api/mpesa/deposit` and `/withdraw` — not implemented
- `POST /api/mpesa/callback` — not configured

## Security checklist before public launch
- [ ] Set a unique 48-byte random JWT secret.
- [ ] Use HTTPS only and secure managed PostgreSQL credentials.
- [ ] Never expose `.env`, provider keys, or database credentials.
- [ ] Restrict CORS/origin if separate frontend hosting is added.
- [ ] Add CSRF defense if cookie-authenticated write endpoints are deployed cross-site.
- [ ] Add login-specific rate limits, email verification, password reset and account lockout policy.
- [ ] Add trade expiry worker and idempotent settlement rather than relying on client timers.
- [ ] Add server-side ownership checks and audited admin operations.
- [ ] Add database backups, restore drills, logging and monitoring.
- [ ] Keep M-Pesa disabled until a reviewed implementation is complete.
