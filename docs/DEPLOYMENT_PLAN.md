# Easy Gig deployment plan

**Who:** whoever stands the app up so other people can use it.  
**Why:** Easy Gig runs on one machine today (`npm run dev`, MySQL on `localhost`). A hosted copy has to keep accounts and gigs after the laptop is closed, and it has to stop exposing routes that wipe data.

App shape today: Node `>=20`, Express serving `public/`, MySQL database `easy_gig`. Sign-in stores `userId` in `sessionStorage`. There is no Docker file, no process manager, and database settings are hardcoded in `server.js` and `scripts/seed.js`.

## What “hosted and usable” means

A person who is not on the developer machine can:

1. Open the site over HTTPS.
2. Create an account and sign in again later.
3. Post a gig (title, description, location, pay, pay type).
4. Search by title, location, pay type, or pay and see that post.
5. Come back the next day and find the same account and posts.

That needs a long-running Node process, a MySQL instance that survives restarts, a domain with TLS, and the fixes in the next section. Without those fixes the URL can load and still be unsafe to hand to strangers.

## Fix in this repo before a public URL

These are in the app today. Do them before DNS points at the server.

| Gap | Why it blocks a public host |
|-----|-----------------------------|
| MySQL host, user, and password are hardcoded | The password ships in git. Production needs env vars and a database user that is not `root`. |
| Open maintenance routes | `GET /createdb`, `GET /deletepost/:id`, `GET /deletespecificpostfortesting`, `DELETE /deleteallusers`, and the other non-`/api` table routes can create or destroy data with no sign-in. Remove them from the process that faces the internet. Keep schema changes in a migration script, not HTTP. |
| Sign-in is a browser `userId` | `/api/signin` returns `userId` and `salt`. Update, delete, bid, and password-change routes trust an id in the body. Anyone who can guess or read an id can act as that user. Usable for the public means an httpOnly session cookie (or equivalent) checked on every write. |
| `users` schema and inserts disagree | `GET /createuserstable` does not add `salt`, but `/api/adduser` inserts `salt`. Apply one schema that includes `salt` before the first real signup. |
| CORS is open (`app.use(cors())`) | Fine while the HTML and API share one origin. Lock it if a separate frontend host is added later. |
| `SELECT * FROM posts` on every search | Fine for a small board. Add a SQL `WHERE` (and an index on title/location) before the table is large. |
| Listen address | `app.listen(PORT)` accepts connections on every interface. In production bind Node to `127.0.0.1` and let the reverse proxy own `443`. |
| Seed script | `npm run seed` inserts demo accounts with a shared password. Do not run it on a public database. |

Rate limits on auth, writes, and reads are already in `server.js`. Keep them.

## What to run

One small Linux VM is enough. Same box for Node and MySQL until there is a reason to split them.

| Piece | Role | Notes |
|-------|------|--------|
| Domain | Public name | Point `A`/`AAAA` at the VM. |
| Caddy or nginx | TLS and reverse proxy | Terminate HTTPS, proxy to `127.0.0.1:3000`. |
| Node 20+ | `node server.js` | `npm ci --omit=dev`, then `npm start`. Run under systemd (or another supervisor) so it restarts on crash and on boot. |
| MySQL 8 | `easy_gig` | Dedicated user with rights only on that database. Persist the data directory (or use a managed MySQL and set the host in env). |
| Firewall | Expose 80 and 443 only | MySQL stays on localhost or a private network. |
| Backups | Daily dump of `easy_gig` | Accounts and posts are the product. A VM snapshot is not a substitute for a database dump stored off the box. |
| Env file | Secrets | Not committed. See below. |

Environment variables the app needs once the hardcoded connection is removed:

| Variable | Example |
|----------|---------|
| `PORT` | `3000` |
| `MYSQL_HOST` | `127.0.0.1` |
| `MYSQL_USER` | `easy_gig` |
| `MYSQL_PASSWORD` | from the host secret store |
| `MYSQL_DATABASE` | `easy_gig` |

## Schema to apply once

Do this with the MySQL client, not the HTTP maintenance routes.

```sql
CREATE DATABASE IF NOT EXISTS easy_gig;
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  salt VARCHAR(255) NOT NULL,
  UNIQUE KEY users_email (email)
);
CREATE TABLE IF NOT EXISTS posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description VARCHAR(255) NOT NULL,
  location VARCHAR(255) NOT NULL,
  max_pay DECIMAL(8, 2) NOT NULL,
  type_of_pay VARCHAR(255) NOT NULL,
  current_bid DECIMAL(8, 2) DEFAULT 0
);
```

`UNIQUE` on `email` is required so two accounts cannot share one address. The app does not enforce that today.

## Bring-up

From a checkout on the VM, after Node, MySQL, the schema, and the env file exist:

```bash
npm ci --omit=dev
npm test
npm start
```

Confirm, on the VM:

- `GET /` returns the home page.
- `POST /api/signin` with a bad body returns 400, not a stack trace.
- With MySQL stopped, `/api/*` returns 503 and the HTML still loads.
- Creating an account, posting, searching, signing out, and signing in again keeps the post.

`npm run smoke` checks static files and API plumbing on a throwaway port. It does not replace the account flow above.

Then put Caddy or nginx in front, confirm the browser shows a valid certificate, and create one real account through the public URL.

## After the first host

Not required to be usable, required before charging money or a wide launch. See [PATH_TO_REVENUE.md](./PATH_TO_REVENUE.md).

- Server-side sessions and no `salt` in the sign-in JSON.
- Email verification and password reset.
- Unique email enforced in the app as well as the database.
- Off-box backups and a restore drill.
- A health URL that checks MySQL, for the process supervisor.
