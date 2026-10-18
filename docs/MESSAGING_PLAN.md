# Easy Gig messaging plan

**Who:** whoever builds direct messages between posters and workers.  
**Why:** today the only way to reach a poster is to put contact details in a post description. A thread tied to the gig keeps the conversation, the agreed price, and any later dispute on Easy Gig instead of in someone's text messages.

## Storage versus delivery

These are two separate decisions.

- **Storage.** Messages live in MySQL. The recipient is usually offline when a message is sent, and both sides need the history later. On a gig board that history is the record of what was agreed, so a short auto-delete window would remove the thing people need when a job goes wrong.
- **Delivery.** How the open page learns that a new message exists. A socket connection is only a delivery choice. It does not replace the table.

| Delivery | Cost here | Use when |
|----------|-----------|----------|
| Polling (`fetch` every few seconds) | No new dependency. Works with the static HTML, the existing rate limiters, and a plain reverse proxy. | Now. Gig messages arrive a few times a day; a five second delay is fine. |
| Server-Sent Events | No new dependency. One long-lived HTTP response per open tab. | Polling load becomes noticeable. |
| WebSocket / socket.io | New dependency, reconnect handling, sign-in on upgrade, proxy upgrade config. | Typing indicators, presence, or real-time back-and-forth are wanted. |

Start with polling. Moving to SSE or a socket later changes only how the browser is told to fetch; the tables and routes below stay the same.

## Prerequisite: server sessions

Messaging is private data, so every route must know who is asking without trusting an id sent by the browser. That needs the httpOnly session cookie described in [PATH_TO_REVENUE.md](./PATH_TO_REVENUE.md). It is required for polling and for any socket design. The session work is in place: `requireUser` in `server.js` sets `req.userId` from the `eg_session` cookie.

## Schema

A conversation belongs to one post and one worker. "Message poster" on a search result finds or creates that row.

```sql
CREATE TABLE IF NOT EXISTS conversations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  post_id INT NOT NULL,
  poster_id INT NOT NULL,
  worker_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_message_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY one_thread_per_post_worker (post_id, worker_id),
  KEY poster_recent (poster_id, last_message_at),
  KEY worker_recent (worker_id, last_message_at)
);

CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  sender_id INT NOT NULL,
  body VARCHAR(2000) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME NULL,
  KEY convo_order (conversation_id, id)
);
```

Apply it with the MySQL client, as in [DEPLOYMENT_PLAN.md](./DEPLOYMENT_PLAN.md). Do not add HTTP routes that create tables.

## API

Every route runs behind `requireUser` and checks that `req.userId` is the conversation's `poster_id` or `worker_id`. A conversation the user is not part of returns 404, so ids cannot be probed.

| Route | Purpose |
|-------|---------|
| `POST /api/conversations` `{ postId }` | Find or create the thread between the signed-in user and the post owner. Reject messaging your own post. |
| `GET /api/conversations` | Inbox: other person's name, post title, last message, unread count, newest first. |
| `GET /api/conversations/:id/messages?after=<messageId>` | Messages newer than the last one the page has. This is the polling call; `convo_order` keeps it an index range scan. |
| `POST /api/conversations/:id/messages` `{ body }` | Send. Validate with `textField(body, 'Message', 2000)`. Update `last_message_at`. |
| `PUT /api/conversations/:id/read` | Set `read_at` on the other person's unread messages. |
| `GET /api/messages/unread-count` | Header badge. |

Rate limits: sends go in a limiter like `writeLimiter`. Polling gets its own limiter (about 20 per minute) so it does not use up `readLimiter` for search.

## Frontend

- A "Message" button on each search result in `public/javascript/main.js`, hidden on the signed-in user's own posts.
- `public/messages.html` and `public/javascript/messages.js`: inbox list and the open thread.
- Poll the open thread every 5 seconds and the unread count every 30 to 60 seconds from `updateHeaderScript.js`. Stop both while `document.hidden` is true.
- Render message text with `textContent`. Never put a message body into `innerHTML`.
- A "Messages" link in the account menu when signed in.

## Retention and deletion

- Keep a thread while both accounts and the post exist.
- Account deletion: choose one before launch. Either delete that user's messages with the account, or keep the thread and show "Deleted user" so the other side keeps their record. The second is kinder to the person who stays.
- Optional: a nightly job that removes conversations with no activity for about 12 months. That is a privacy and storage policy, not something the feature needs to work.

## Tests

- `node --test`: a non-participant gets 404, empty and oversized bodies get 400, `after` returns only newer rows, messaging your own post is rejected.
- `scripts/smoke.js`: messaging routes return 401 without a session cookie.

## Order of work

1. Server sessions (done).
2. Schema and the six routes, with tests.
3. Messages page, polling, header badge.
4. Account-deletion rule and the optional retention job.
5. SSE or a socket only if polling load or product needs call for it.
