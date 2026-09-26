# Easy Gig path to revenue

**Who:** whoever builds the next slice of Easy Gig.  
**Why:** the app is a local gig board. People can post work and search it. Nothing in the product takes money, proves a person is real, or records that a gig was filled. Hosting it (see [DEPLOYMENT_PLAN.md](./DEPLOYMENT_PLAN.md)) does not make it a business.

Charge for something the board already almost does: getting a gig seen, then getting a gig filled. Do not start with ads or a worker subscription.

## What exists that money can sit on

| Today | Money implication |
|-------|-------------------|
| A post has title, description, location, max pay, pay type | A poster will pay to publish or to pin a post. |
| `current_bid` can be updated on a post | A number on a row is not a hire. There is no worker identity on the bid and no accept step. |
| Accounts are name, email, password (scrypt + salt) | Enough for a login. Not enough to pay a person or to trust a public board. |
| Search by title, location, pay type, pay | This is the surface people come back to. Empty search results mean there is nothing to sell. |

## Order of work

### 1. Make the board trustworthy enough to charge

Do this before Stripe. A paid post on an open write API will be refunded or abused.

- Server session (httpOnly cookie). Stop trusting `userId` from the browser on update, delete, bid, and password change.
- Stop returning `salt` from `/api/signin`.
- Unique email, and reject a second signup for the same address.
- Remove or lock the maintenance routes listed in the deployment plan.
- Poster can edit and delete only their own posts. A bid stores the bidding user's id.
- Report control: a signed-in user can flag a post; an admin flag hides it from search. One admin account is enough at the start.
- Terms and a privacy note linked from sign-up, including that Easy Gig is a board and does not employ the worker.

### 2. First dollar: paid post

Smallest product that can charge.

- Creating a post is free up to a low cap (for example three open posts).
- A fourth open post, or a “featured” pin on the search results, requires payment.
- Stripe Checkout (one-time). Webhook marks the post paid or featured. Do not trust the browser redirect alone.
- Email receipt to the poster.

Tools for this step:

| Tool | Job |
|------|-----|
| Stripe Checkout + webhooks | Take the posting or featured fee. Store `stripe_customer_id` and the Checkout session id on the user or post. |
| Stripe CLI (dev only) | Forward webhooks to a local server while building this. |
| Transactional email (Resend, Postmark, or SES) | Receipts now; verification and password reset in the same account. |
| Webhook signing secret | Env var, same treatment as the database password. |

Schema additions: `posts.paid_at`, `posts.featured_until`, `users.stripe_customer_id`, and a `payments` row (user, post, amount, Stripe id, status) so a refresh does not double-charge.

Success: one real card payment, webhook received, post visible as featured, receipt in the poster’s inbox. Refund that test charge.

### 3. Fill the gig: accept a bid, then take a cut

Only after strangers are posting and bidding without being paid to do it. A take rate on an empty board is a settings page.

Product to add:

- A bid is a row: post, worker, amount, message, time. Replaces overwriting a single `current_bid`.
- Poster accepts one bid. Other bids close.
- Poster pays the accepted amount through Stripe. Easy Gig keeps a fee (start at a flat percent, decide the number from the first ten paid posts, not before).
- Worker is paid out with Stripe Connect (Express accounts). Easy Gig never holds the worker’s bank details.
- In-app thread on that post only, after a bid exists, so payment does not depend on exchanging phone numbers in the description.
- Both sides mark the gig complete. Payout releases on poster confirm, or automatically after a stated window if the poster does not dispute.

Tools for this step:

| Tool | Job |
|------|-----|
| Stripe Connect | Pay workers and keep the platform fee in one charge. |
| Stripe Identity or manual review | Only if chargebacks show fake workers. Skip until that happens. |
| Email | “Your bid was accepted”, “You were paid”, dispute opened. |

Tax: Stripe issues the forms for connected accounts. Easy Gig still needs a record of fees collected. Do not build a payroll system.

### 4. Keep people coming back

Add these when step 2 or 3 has real users, not before.

| Tool or feature | Why |
|-----------------|-----|
| Email verification + password reset | Stops dead accounts and support mail you cannot answer. |
| Saved search or “new gigs in this city” email | The retention loop. Needs a location people actually type. |
| One review after a completed gig | Trust for the next poster. Cap at one review per completed job. |
| Plausible, or server logs of search queries | Shows whether location and category are real. Avoid a heavy analytics suite. |
| Sentry (or equivalent) | Payment webhooks fail quietly otherwise. |
| Basic admin list | Paid posts, open disputes, hidden posts. A password-protected page is enough. |

Maps, native apps, and social login wait until search-by-location is the reason people stay.

## What not to add yet

- Ads.
- A monthly fee for workers.
- Escrow outside Stripe.
- A mobile app.
- AI matching.
- Crypto payouts.

## Money checkpoint

Stop and look at real posts before Connect work:

- At least ten distinct people have posted without a demo seed.
- At least ten bids exist on those posts.
- Featured-post Checkout has been used by someone other than the developer.

If posts stay at zero, the next build is distribution (who the board is for, and a way to tell them), not another payment API.
