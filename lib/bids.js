'use strict';

const { publicPostView } = require('./postLocation');

const CREATE_BIDS_SQL = `CREATE TABLE IF NOT EXISTS bids (
    id INT AUTO_INCREMENT,
    post_id INT NOT NULL,
    user_id INT NOT NULL,
    amount DECIMAL(8, 2) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY bids_post_user (post_id, user_id),
    KEY bids_user (user_id)
)`;

const BACKFILL_BIDS_SQL = `INSERT INTO bids (post_id, user_id, amount)
    SELECT p.id, p.current_bidder_id, p.current_bid
    FROM posts p
    WHERE p.current_bidder_id IS NOT NULL
      AND p.current_bid > 0
      AND NOT EXISTS (
        SELECT 1 FROM bids b
        WHERE b.post_id = p.id AND b.user_id = p.current_bidder_id
      )`;

function money(value) {
    if (value == null || value === '') {
        return null;
    }
    const amount = Number(value);
    return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : null;
}

function validateBidAmount({ maxPay, amount, lowestOtherBid, ownBid }) {
    const bid = money(amount);
    const pay = money(maxPay);
    if (bid == null || bid <= 0) {
        return { error: 'Bid must be greater than zero' };
    }
    if (pay == null || bid > pay) {
        return { error: 'Bid cannot be higher than the listed pay' };
    }

    const other = money(lowestOtherBid);
    if (other != null && other > 0 && bid >= other) {
        return { error: 'Bid must be lower than the current bid' };
    }

    const mine = money(ownBid);
    if ((other == null || other <= 0) && mine != null && bid > mine) {
        return { error: 'You can only lower your bid' };
    }

    return { value: bid };
}

function sortBids(bids) {
    return [...(bids || [])].sort((a, b) => {
        const byAmount = Number(a.amount) - Number(b.amount);
        if (byAmount !== 0) {
            return byAmount;
        }
        return Number(a.id) - Number(b.id);
    });
}

function leadingBid(bids) {
    return sortBids(bids)[0] || null;
}

function lowestOtherAmount(bids, userId) {
    const others = (bids || []).filter((bid) => Number(bid.user_id) !== Number(userId));
    const lead = leadingBid(others);
    return lead ? money(lead.amount) : null;
}

function profileGigs(posts, viewerId) {
    return (posts || []).map((post) => {
        const view = publicPostView(post, viewerId);
        view.was_filled = Boolean(post.accepted_user_id);
        return view;
    });
}

function bidsForPoster(bids, acceptedUserId) {
    const sorted = sortBids(bids);
    const leaderId = sorted[0] ? Number(sorted[0].id) : null;
    const hiredId = acceptedUserId == null ? null : Number(acceptedUserId);

    return sorted.map((bid) => ({
        id: Number(bid.id),
        user_id: Number(bid.user_id),
        name: bid.name,
        amount: money(bid.amount),
        created_at: bid.created_at,
        is_leading: Number(bid.id) === leaderId,
        is_hired: hiredId != null && Number(bid.user_id) === hiredId,
    }));
}

function ensureBidsTable(db, done) {
    db.query(CREATE_BIDS_SQL, (err) => {
        if (err) {
            done(err);
            return;
        }
        db.query(BACKFILL_BIDS_SQL, (backfillErr) => {
            done(backfillErr || null);
        });
    });
}

module.exports = {
    CREATE_BIDS_SQL,
    BACKFILL_BIDS_SQL,
    validateBidAmount,
    sortBids,
    leadingBid,
    lowestOtherAmount,
    bidsForPoster,
    profileGigs,
    ensureBidsTable,
};
