const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { normalizePlace, mapSuggestions } = require('../lib/places');

describe('places', () => {
    it('reads Places API (New) address components into a city label', () => {
        const place = normalizePlace({
            id: 'ChIJu46S-ZZhNVERPbYRyvn_V48',
            formattedAddress: 'Seattle, WA, USA',
            shortFormattedAddress: 'Seattle, WA',
            types: ['locality', 'political'],
            location: { latitude: 47.6062, longitude: -122.3321 },
            addressComponents: [
                { longText: 'Seattle', shortText: 'Seattle', types: ['locality', 'political'] },
                {
                    longText: 'Washington',
                    shortText: 'WA',
                    types: ['administrative_area_level_1', 'political'],
                },
                { longText: 'United States', shortText: 'US', types: ['country', 'political'] },
            ],
        });

        assert.equal(place.placeId, 'ChIJu46S-ZZhNVERPbYRyvn_V48');
        assert.equal(place.locality, 'Seattle');
        assert.equal(place.admin_area, 'WA');
        assert.equal(place.lat, 47.6062);
        assert.equal(place.lng, -122.3321);
    });

    it('maps autocomplete suggestions without extra Google payload', () => {
        const suggestions = mapSuggestions({
            suggestions: [
                {
                    placePrediction: {
                        placeId: 'abc',
                        text: { text: 'Ballard, Seattle, WA, USA' },
                        structuredFormat: {
                            mainText: { text: 'Ballard' },
                            secondaryText: { text: 'Seattle, WA, USA' },
                        },
                        types: ['neighborhood', 'political'],
                    },
                },
            ],
        });

        assert.deepEqual(suggestions, [
            {
                placeId: 'abc',
                text: 'Ballard, Seattle, WA, USA',
                mainText: 'Ballard',
                secondaryText: 'Seattle, WA, USA',
                types: ['neighborhood', 'political'],
            },
        ]);
    });
});
