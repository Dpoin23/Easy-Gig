# Easy Gig

Local gig board: Express + MySQL API with a static HTML/CSS/JS frontend.

## Layout

```
server.js          # Express API + static file server
lib/               # Search ranking
public/            # Frontend (HTML, JS, CSS, images)
scripts/           # Smoke check and database seed
test/              # Unit tests and local testing notes
```

## Run

```bash
npm install
npm run dev          # http://localhost:3000  (override with PORT=3001)
```

Requires MySQL with database `easy_gig` (see connection settings in `server.js`). Without MySQL, the UI still loads; API calls will fail until the DB is up.

Search matches part of a title, location, pay type, or pay amount. Closer matches are listed first. Posts that only overlap in another field, or pay amounts nearby, appear below a Related searches line.

```bash
npm run seed         # demo users and gigs; password is password123
npm test
npm run lint
npm run syntax
```
