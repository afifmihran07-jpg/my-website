# High Street Society Production Setup

The release gate is intentionally closed until every section below is configured and tested against real services.

## PostgreSQL

1. Create managed PostgreSQL with automated backups and point-in-time recovery.
2. Set `DATABASE_URL` using `.env.example`.
3. Run `npx drizzle-kit migrate`.
4. Confirm every table in `server/db/schema.ts` exists.
5. Do not seed orders, customers, reviews, notifications, coupon usage, or analytics. Production starts empty.

## First Admin

1. Generate a long random bootstrap username and password.
2. Set `ADMIN_BOOTSTRAP_USERNAME` and `ADMIN_BOOTSTRAP_PASSWORD` only in the server environment.
3. Visit the private Admin URL directly. It is absent from the public storefront.
4. Complete mandatory username, strong password, recovery-email, and emergency-code setup.
5. Store the one-time code in a password manager.
6. Remove the bootstrap variables after setup and redeploy.

Admin sessions are random opaque tokens stored as SHA-256 hashes in PostgreSQL. The browser receives only a Secure, HttpOnly, SameSite=Strict cookie. Passwords and recovery codes are bcrypt hashes.

## Cloudinary

Configure the three Cloudinary variables. Test upload, reorder, replacement, and deletion from Admin. Confirm URLs/public IDs persist in PostgreSQL and images survive redeployment.

## Email Recovery

Configure SMTP. Confirm reset responses do not reveal whether an email exists, links expire after 15 minutes, work once, and revoke active sessions.

## SMS

Configure a real Bangladesh-compatible SMS provider. Until then records are stored as `unconfigured`; the application does not claim SMS delivery.

## Manual Payments

Customer uses Send Money, submits the transaction ID, and receives `pending_verification`. Only an Admin audit action changes payment to `paid` and order to `confirmed`.

## Backups

Enable provider backups and point-in-time recovery. Test restore into staging. Enable Cloudinary retention/versioning. Browser storage is not a backup.

## Release Gate

- PostgreSQL persists products, variants, categories, stock, orders, customers, coupons, reviews, CMS, settings, and notifications across devices.
- Every Admin API rejects requests without a valid server session.
- Bootstrap setup cannot run after completion.
- Concurrent last-item checkout does not oversell.
- Coupons and usage are calculated atomically server-side.
- Manual payment is never auto-confirmed.
- Reviews and reactions persist and duplicate reactions are blocked.
- CMS draft and publish persist in PostgreSQL.
- Cloudinary assets survive redeployment.
- SMS/email record real provider responses or `unconfigured`.
- Production build and complete acceptance tests pass.

Do not publish until every item passes using real credentials.