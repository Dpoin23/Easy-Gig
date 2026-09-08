# Easy Gig

Local gig board: Express + MySQL API with a static HTML/CSS/JS frontend.

## Layout

```
server.js          # Express API + static file server
public/            # Frontend (HTML, JS, CSS, images)
test/              # Unit tests and local testing notes
```

## Run

```bash
npm install
npm run dev          # http://localhost:3000  (override with PORT=3001)
```

Requires MySQL with database `easy_gig` (see connection settings in `server.js`). Without MySQL, the UI still loads; API calls will fail until the DB is up.

```bash
npm test
npm run lint
npm run syntax
```

## Current goals

- Profile/Links: consolidate profile link/signout link into one dropdown menu, add more links/diversify from there (consider placing create account there)
- Profile Box: update profile, user cannot view password in profile, only username and email, maintain edit button for those two
  - add another button for changing password
- Style changes throughout the website (mainly buttons)

## Bug fixes

- display posts button do further testing, when user deletes the final post add a function to check if there are any posts remaining, if the user has no posts remaining, automatically change the display posts button back to show posts.
- when trying to sign in two times, error sign displays stack (should replace each other)
- cannot signin/create acc, bug when one of the users got modified
