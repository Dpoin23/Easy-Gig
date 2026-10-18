Running database: npm run dev
App URL: http://localhost:3000
Bypassing Nodemon if Needed: Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

Demo data:
npm run seed => 3 demo accounts (*@easygig.demo, password: password123) and 3 gigs with real Google Places locations.
Needs GOOGLE_PLACES_API_KEY in .env. Each new gig spends one Places lookup per place; gigs that already exist are skipped.

Clearing test data:
npm run clear-test-data => dry run, lists the demo and test rows it would delete
npm run clear-test-data -- --yes => deletes them
npm run clear-test-data -- --legacy --yes => also deletes every post made before real locations (no place id)

Testing Accounts:
account test1 => name: Test One, email: testone@gmail.com, password: testonedavid
account test2 => name: Test Two, email: testtwo@gmail.com, password: testtwodavid
These are removed by clear-test-data. Recreate them through the sign-up page if needed.

Testing Posts:
Post through the Post page. The city or service area must be picked from the suggestions; free-text locations like "testing" are rejected.
A street address is optional. Pick "Hide until hired" to check that it stays out of search results until the poster hires the bidder.
