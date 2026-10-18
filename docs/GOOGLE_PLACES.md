# Google Places for Easy Gig locations

**Who:** whoever runs the app and posts or searches gigs.  
**Why:** gig locations must be real cities, neighborhoods, or addresses from Google, not free text. The API key stays on the server.

Easy Gig never sends the Google key to the browser. The post form and location search call `/api/places/autocomplete`. Creating a post calls Google Place Details again on the server so a client cannot invent a place id, coordinates, or street address.

## Create a key

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create or pick a project.
3. Enable billing on that project. Places API (New) is not free; autocomplete and place details are billed per request. See [Places API usage and billing](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing).
4. Enable **Places API (New)** (`places.googleapis.com`). This is the current Places product, not the legacy Places API.
5. APIs & Services → Credentials → **Create credentials** → API key.
6. Restrict the key:
   - **Application restriction:** IP addresses of the machine that runs `node server.js` (or none while you are on localhost).
   - **API restriction:** Places API (New) only.
7. Copy the key into a `.env` file in the repo root (see `.env.example`):

```bash
cp .env.example .env
```

```
GOOGLE_PLACES_API_KEY=your_key_here
```

8. Restart the Node process. `lib/loadEnv.js` reads `.env` on startup and does not override variables already in the environment.

Without a key, the site still loads. Autocomplete and new posts that need a place return `503 Location lookup is not configured`, and `npm run seed` stops before inserting any gigs.

## Seeding without wasting lookups

`npm run seed` resolves demo gig locations through the same Place Details path as `/api/addpost`, so seeded gigs carry real place ids and coordinates. To keep usage low it seeds only three gigs (Seattle with one hidden street address, Bellevue, Tacoma). That is four autocomplete sessions, each ending in one Place Details request. Gigs that already exist are skipped, so a second run makes no Places calls. The script prints how many lookups it made.

Clear the old free-text demo and test rows first:

```bash
npm run clear-test-data          # dry run
npm run clear-test-data -- --yes
npm run seed
```

## What the app calls

Official docs used for this integration:

- [Autocomplete (New)](https://developers.google.com/maps/documentation/places/web-service/place-autocomplete)
- [Place Details (New)](https://developers.google.com/maps/documentation/places/web-service/place-details)
- [Session tokens](https://developers.google.com/maps/documentation/places/web-service/using-session-tokens)

| User action | Easy Gig route | Google call |
|-------------|----------------|-------------|
| Type in city or address | `POST /api/places/autocomplete` | `POST https://places.googleapis.com/v1/places:autocomplete` |
| Submit a gig | `POST /api/addpost` | `GET https://places.googleapis.com/v1/places/{placeId}` |
| Search near a selected place | `GET /api/getpostsbylocation?placeId=` | Place Details for that origin, then distance on stored area coordinates |

The browser generates a UUID session token per autocomplete session and sends it with the matching Place Details request so Google can bill the keystrokes plus the details call as one session.

Field masks are required. Autocomplete requests only prediction text and place ids. Details requests only `id`, formatted address, location, address components, and types (Places Details Essentials, not Pro fields such as `displayName`).

## Location rules in the product

**Posting.** A city, neighborhood, ZIP, or county from autocomplete is required. A street address is optional. Default visibility is hide-until-hired. Distance search uses the public area coordinates, not the hidden street, so a private house cannot be triangulated from the search API.

**Browsing.** Location search accepts a typed city, a selected Google place, or an optional “Use my location” button. Distance choices are 5, 10, 25, or 50 miles. The browser does not ask for geolocation until that button is clicked.

**Bidding / hiring.** Cards always show the public area. If a street is stored but hidden, the card says it is shared after hire. Public JSON never includes `address_formatted`, `address_lat`, or `address_lng` unless the viewer is the poster, the hired worker, or the poster chose “show on the listing”. `GET /api/posts/:id/address` enforces the same rule.

**Attribution.** Autocomplete suggestions include a “Powered by Google” line because predictions are shown without a map. See [Places API policies](https://developers.google.com/maps/documentation/places/web-service/policies).

## Local check

```bash
curl -s http://localhost:3000/api/places/autocomplete \
  -H 'Content-Type: application/json' \
  -d '{"input":"seatt","mode":"area"}'
```

Configured: JSON `suggestions` with Seattle-area places. Missing key: `{"error":"Location lookup is not configured"}`.
