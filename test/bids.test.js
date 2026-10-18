const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    validateBidAmount,
    leadingBid,
    lowestOtherAmount,
    bidsForPoster,
    profileGigs,
} = require('../lib/bids');

describe('bids', () => {
    it('rejects a bid above the listed pay', () => {
        const result = validateBidAmount({ maxPay: 40, amount: 41, lowestOtherBid: null, ownBid: null });
        assert.equal(result.error, 'Bid cannot be higher than the listed pay');
    });

    it('requires a new bid to undercut the other offers', () => {
        const result = validateBidAmount({ maxPay: 40, amount: 30, lowestOtherBid: 25, ownBid: null });
        assert.equal(result.error, 'Bid must be lower than the current bid');
    });

    it('accepts the first bid on a gig', () => {
        const result = validateBidAmount({ maxPay: 80, amount: 70, lowestOtherBid: null, ownBid: null });
        assert.equal(result.value, 70);
    });

    it('lets the only bidder lower their bid', () => {
        const result = validateBidAmount({ maxPay: 40, amount: 20, lowestOtherBid: null, ownBid: 30 });
        assert.equal(result.value, 20);
    });

    it('rejects the only bidder raising their bid', () => {
        const result = validateBidAmount({ maxPay: 40, amount: 35, lowestOtherBid: null, ownBid: 30 });
        assert.equal(result.error, 'You can only lower your bid');
    });

    it('picks the lowest bid as the one shown on the gig', () => {
        const lead = leadingBid([
            { id: 2, user_id: 8, amount: 30 },
            { id: 1, user_id: 4, amount: 25 },
            { id: 3, user_id: 9, amount: 25 },
        ]);
        assert.equal(lead.user_id, 4);
        assert.equal(lowestOtherAmount([
            { id: 2, user_id: 8, amount: 30 },
            { id: 1, user_id: 4, amount: 25 },
        ], 8), 25);
    });

    it('lists every bidder for the poster and marks who was hired', () => {
        const rows = bidsForPoster([
            { id: 2, user_id: 8, name: 'Sam Chen', amount: '30.00', email: 'sam@example.com', created_at: '2026-10-01' },
            { id: 1, user_id: 4, name: 'Alex Rivera', amount: '25.50', email: 'alex@example.com', created_at: '2026-10-02' },
        ], 8);

        assert.deepEqual(rows.map((bid) => bid.user_id), [4, 8]);
        assert.equal(rows[0].is_leading, true);
        assert.equal(rows[1].is_hired, true);
        assert.equal(rows[0].amount, 25.5);
        assert.ok(!('email' in rows[0]));
    });

    it('shows filled gigs on a profile without the street address or the worker id', () => {
        const [gig] = profileGigs([
            {
                id: 9,
                user_id: 4,
                title: 'Move a couch',
                description: 'One flight of stairs',
                location: 'Ballard, Seattle, WA',
                max_pay: 80,
                type_of_pay: 'one-time',
                current_bid: 60,
                address_formatted: '500 Market St, Seattle, WA',
                address_visibility: 'after_hire',
                accepted_user_id: 4,
            },
        ], 10);

        assert.equal(gig.was_filled, true);
        assert.equal(gig.precise_address, null);
        assert.ok(!('accepted_user_id' in gig));
        assert.ok(!('address_formatted' in gig));
    });
});
