const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    DELETED_USER_LABEL,
    reviewStars,
    reviewDescription,
    reviewDecision,
    ratingFromStars,
    ratingFromAggregate,
    publicReview,
    publicPendingReview,
    isOpenGig,
} = require('../lib/reviews');

const prompt = {
    post_id: 4,
    post_title: 'Move a couch',
    poster_id: 1,
    worker_id: 2,
};

describe('reviews', () => {
    it('accepts a 1 to 5 star rating', () => {
        assert.equal(reviewStars(1).value, 1);
        assert.equal(reviewStars(5).value, 5);
        assert.equal(reviewStars('4').value, 4);
        assert.equal(reviewStars(0).status, 400);
        assert.equal(reviewStars(6).error, 'Rating must be from 1 to 5 stars');
        assert.equal(reviewStars(3.5).status, 400);
        assert.equal(reviewStars('').status, 400);
        assert.equal(reviewStars(null).status, 400);
    });

    it('requires a description and caps the length', () => {
        assert.equal(reviewDescription('  Careful with the stairs. ').value, 'Careful with the stairs.');
        assert.equal(reviewDescription('').status, 400);
        assert.equal(reviewDescription('   ').error, 'Review is required');
        assert.equal(reviewDescription('x'.repeat(1001)).error, 'Review is too long');
        assert.equal(reviewDescription('x'.repeat(1000)).value.length, 1000);
    });

    it('lets each side of a hire review the other once', () => {
        const poster = reviewDecision(prompt, 1, false);
        assert.equal(poster.role, 'poster');
        assert.equal(poster.revieweeId, 2);

        const worker = reviewDecision(prompt, 2, false);
        assert.equal(worker.role, 'worker');
        assert.equal(worker.revieweeId, 1);

        assert.equal(reviewDecision(prompt, 9, false).status, 403);
        assert.equal(reviewDecision(prompt, 1, true).status, 409);
        assert.equal(reviewDecision(prompt, 1, true).error, 'You already reviewed this gig');
        assert.equal(reviewDecision(null, 1, false).status, 404);
    });

    it('averages star ratings and treats an empty list as no reviews', () => {
        assert.deepEqual(ratingFromStars([]), { average: null, count: 0 });
        assert.deepEqual(ratingFromStars([5]), { average: 5, count: 1 });
        assert.deepEqual(ratingFromStars([5, 4, 4]), { average: 4.3, count: 3 });
        assert.deepEqual(ratingFromAggregate({ count: 0, average: null }), { average: null, count: 0 });
        assert.deepEqual(ratingFromAggregate({ count: '2', average: '4.5000' }), { average: 4.5, count: 2 });
    });

    it('shows a deleted author without exposing account ids', () => {
        const review = publicReview({
            id: 8,
            stars: 5,
            description: 'On time',
            post_title: 'Move a couch',
            author_name: null,
            created_at: '2026-10-18',
            reviewer_id: 2,
            reviewee_id: 1,
        });
        assert.equal(review.authorName, DELETED_USER_LABEL);
        assert.equal(review.description, 'On time');
        assert.ok(!('reviewer_id' in review));
        assert.ok(!('reviewee_id' in review));
    });

    it('points a finished gig at the other person and their thread', () => {
        const pending = publicPendingReview({
            ...prompt,
            reviewee_name: 'Sam Chen',
            conversation_id: 12,
        }, 1);
        assert.equal(pending.revieweeName, 'Sam Chen');
        assert.equal(pending.role, 'poster');
        assert.equal(pending.conversationId, 12);
        assert.equal(publicPendingReview({ ...prompt, reviewee_name: '', conversation_id: null }, 2).revieweeName, DELETED_USER_LABEL);
        assert.equal(publicPendingReview(prompt, 9), null);
    });

    it('keeps completed gigs off the public board', () => {
        assert.equal(isOpenGig({ id: 1, completed_at: null }), true);
        assert.equal(isOpenGig({ id: 2 }), true);
        assert.equal(isOpenGig({ id: 3, completed_at: '2026-10-18 12:00:00' }), false);
        assert.equal(isOpenGig(null), false);
    });
});
