const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { rankPosts } = require('../lib/searchRank');

const posts = [
    {
        id: 1,
        title: 'Lawn mowing and edging',
        description: 'Weekly cut for a small yard',
        location: 'Seattle, WA',
        type_of_pay: 'hourly',
        max_pay: 40,
    },
    {
        id: 2,
        title: 'Mow the backyard',
        description: 'One visit, bring your own mower',
        location: 'Bellevue, WA',
        type_of_pay: 'one-time',
        max_pay: 80,
    },
    {
        id: 3,
        title: 'Yard cleanup',
        description: 'Weeding and mowing the edges',
        location: 'Seattle, WA',
        type_of_pay: 'one-time',
        max_pay: 120,
    },
    {
        id: 4,
        title: 'Dog walking',
        description: 'Weekday mornings',
        location: 'Tacoma, WA',
        type_of_pay: 'hourly',
        max_pay: 25,
    },
    {
        id: 5,
        title: 'Piano lessons',
        description: 'Beginners welcome',
        location: 'Kirkland, WA',
        type_of_pay: 'hourly',
        max_pay: 50,
    },
];

describe('rankPosts', () => {
    it('does not require an exact title', () => {
        const { relevant } = rankPosts(posts, 'mowing', 'title');
        assert.deepEqual(relevant.map((post) => post.id), [1, 2]);
    });

    it('lists fuller matches before partial ones, then related posts', () => {
        const { relevant, related } = rankPosts(posts, 'lawn mowing', 'title');
        assert.deepEqual(relevant.map((post) => post.id), [1, 2]);
        assert.deepEqual(related.map((post) => post.id), [3]);
    });

    it('keeps description-only overlap out of the direct matches', () => {
        const { relevant, related } = rankPosts(posts, 'mow', 'title');
        assert.ok(relevant.every((post) => post.id !== 3));
        assert.equal(related[0].id, 3);
    });

    it('matches a location without the full city string', () => {
        const { relevant, related } = rankPosts(posts, 'seattle', 'location');
        assert.deepEqual(relevant.map((post) => post.id), [1, 3]);
        assert.deepEqual(related, []);
    });

    it('treats nearby pay as related and an equal pay as relevant', () => {
        const { relevant, related } = rankPosts(posts, '50', 'pay');
        assert.deepEqual(relevant.map((post) => post.id), [5]);
        assert.ok(related.some((post) => post.id === 1));
        assert.ok(!related.some((post) => post.id === 3));
    });

    it('returns nothing for a blank search', () => {
        const grouped = rankPosts(posts, '   ', 'title');
        assert.deepEqual(grouped, { relevant: [], related: [] });
    });
});
