const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    resolveGigLocation,
    INSERT_POST_SQL,
    insertPostParams,
} = require('../lib/resolveLocation');

const resolved = {
    location: 'Seattle, WA',
    area: {
        placeId: 'ChIJVTPokywQkFQRmtVEaUZlJRA',
        locality: 'Seattle',
        admin_area: 'WA',
        country: 'US',
        lat: 47.6062,
        lng: -122.3321,
    },
    address: null,
    visibility: 'after_hire',
};

describe('resolveLocation', () => {
    it('passes one value per insert placeholder', () => {
        const placeholders = INSERT_POST_SQL.match(/\?/g).length;
        const params = insertPostParams(
            { title: 'Mow', description: 'Small yard', pay: 40, payType: 'hourly', userId: 3 },
            resolved
        );
        assert.equal(params.length, placeholders);
        assert.equal(params[2], 'Seattle, WA');
        assert.equal(params[6], 'ChIJVTPokywQkFQRmtVEaUZlJRA');
        assert.equal(params[15], null);
    });

    it('fails before calling Google when no key is configured', async () => {
        const saved = process.env.GOOGLE_PLACES_API_KEY;
        delete process.env.GOOGLE_PLACES_API_KEY;
        try {
            await assert.rejects(
                resolveGigLocation({ areaPlaceId: 'abc' }),
                (err) => err.status === 503
            );
        } finally {
            if (saved !== undefined) {
                process.env.GOOGLE_PLACES_API_KEY = saved;
            }
        }
    });
});
