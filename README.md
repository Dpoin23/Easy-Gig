# Easy Gig

Local gig board: Express + MySQL API with a static HTML/CSS/JS frontend.

## Layout

```
server.js          # Express API + static file server
lib/               # Search ranking
public/            # Frontend (HTML, JS, CSS, images)
scripts/           # Smoke check, database seed, test-data cleanup
test/              # Unit tests and local testing notes
```

## Run

```bash
npm install
npm run dev          # http://localhost:3000  (override with PORT=3001)
```

Requires MySQL with database `easy_gig` (see connection settings in `server.js`). Without MySQL, the UI still loads; API calls will fail until the DB is up.

Sign-in sets an httpOnly `eg_session` cookie. Posting, bidding, profile edits, password changes, and deletes use the signed-in user from that cookie. `server.js` creates the `sessions` table on startup if it is missing.

A signed-in worker can message the poster of a gig from search. The thread stays on Easy Gig. The messages page polls for new messages; the account menu shows an unread count. Deleting an account keeps threads where that person was the worker and shows them as "Deleted user". Deleting a gig removes its threads.

Posting a gig requires a real city, neighborhood, or ZIP from Google Places, not typed-in free text. A street address is optional and hidden until the poster hires a bidder unless they choose to show it on the listing. Location search can use a city name, a selected place, or (if the user opts in) the current device location, plus a 5 / 10 / 25 / 50 mile filter. Precise addresses are stripped from public API responses. Google setup is in [docs/GOOGLE_PLACES.md](docs/GOOGLE_PLACES.md).

Search matches part of a title, location, pay type, or pay amount. Closer matches are listed first. Posts that only overlap in another field, or pay amounts nearby, appear below a Related searches line.

```bash
npm run seed         # 3 demo users and 3 gigs with real places; needs GOOGLE_PLACES_API_KEY; password is password123
npm run clear-test-data            # dry run: list demo/test rows to delete
npm run clear-test-data -- --yes   # delete them (add --legacy to also drop pre-Places posts)
npm run purge-stale-conversations   # dry run: conversations idle for 12 months
npm test
npm run lint
npm run syntax
```
