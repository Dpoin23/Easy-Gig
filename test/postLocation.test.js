const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    milesBetween,
    publicLabel,
    assertUsableArea,
    canViewPreciseAddress,
    publicPostView,
    filterByRadius,
    addressFitsArea,
} = require('../lib/postLocation');

const seattle = {
    id: 1,
    user_id: 10,
    title: 'Lawn mowing',
    description: 'Small yard',
    location: 'Capitol Hill, Seattle, WA',
    locality: 'Seattle',
    neighborhood: 'Capitol Hill',
    admin_area: 'WA',
    lat: 47.625,
    lng: -122.322,
    max_pay: 40,
    type_of_pay: 'hourly',
    current_bid: 0,
    address_formatted: '123 Pike St, Seattle, WA 98101',
    address_lat: 47.609,
    address_lng: -122.339,
    address_visibility: 'after_hire',
    current_bidder_id: 22,
    accepted_user_id: null,
};

describe('postLocation', () => {
    it('measures miles between nearby Puget Sound cities', () => {
        const miles = milesBetween(47.6062, -122.3321, 47.6101, -122.2015);
        assert.ok(miles > 5 && miles < 10);
    });

    it('builds a public label from neighborhood and city, not the street', () => {
        assert.equal(
            publicLabel({
                neighborhood: 'Capitol Hill',
                locality: 'Seattle',
                admin_area: 'WA',
                formattedAddress: '123 Pike St, Seattle, WA 98101',
            }),
            'Capitol Hill, Seattle, WA'
        );
    });

    it('rejects a whole state as a service area', () => {
        const result = assertUsableArea({
            types: ['administrative_area_level_1', 'political'],
            locality: '',
            neighborhood: '',
            postal_code: '',
            county: '',
            lat: 47.4,
            lng: -120.7,
        });
        assert.equal(result.error, 'Choose a city, neighborhood, or ZIP — a whole state is too broad');
    });

    it('accepts a city as a service area', () => {
        const result = assertUsableArea({
            types: ['locality', 'political'],
            locality: 'Seattle',
            lat: 47.6062,
            lng: -122.3321,
        });
        assert.equal(result.value, 'area');
    });

    it('hides a private street address from public and bidder views', () => {
        assert.equal(canViewPreciseAddress(seattle, null), false);
        assert.equal(canViewPreciseAddress(seattle, 22), false);
        assert.equal(canViewPreciseAddress(seattle, 10), true);

        const publicView = publicPostView(seattle, null);
        assert.equal(publicView.precise_address, null);
        assert.equal(publicView.has_precise_address, true);
        assert.equal(publicView.address_shared_when, 'after_hire');
        assert.equal(publicView.location, 'Capitol Hill, Seattle, WA');
        assert.equal(publicView.completed, false);
        assert.equal(publicPostView({ ...seattle, completed_at: '2026-10-18' }, null).completed, true);
        assert.deepEqual(publicView.images, []);
        assert.ok(!('address_formatted' in publicView));
        assert.ok(!('address_lat' in publicView));
        assert.ok(!('current_bidder_id' in publicView));
        assert.ok(!('bid_count' in publicView));

        const owner = publicPostView({ ...seattle, bid_count: 2 }, 10);
        assert.equal(owner.bid_count, 2);
        assert.equal(owner.current_bidder_id, 22);

        const hired = publicPostView({ ...seattle, accepted_user_id: 22 }, 22);
        assert.equal(hired.precise_address, '123 Pike St, Seattle, WA 98101');
        assert.equal(hired.is_hired, true);
    });

    it('includes saved gig photos and drops unsafe names', () => {
        const name = `${'ab'.repeat(16)}.png`;
        const view = publicPostView({
            ...seattle,
            images: [
                { stored_name: name },
                { stored_name: '../server.js' },
                { url: 'https://evil.example/a.png' },
            ],
        }, null);
        assert.deepEqual(view.images, [{ url: `/uploads/posts/${name}` }]);
    });

    it('includes a public street address in the public view', () => {
        const view = publicPostView({ ...seattle, address_visibility: 'public' }, null);
        assert.equal(view.precise_address, '123 Pike St, Seattle, WA 98101');
        assert.equal(view.address_shared_when, 'now');
    });

    it('filters by distance using the public area, not an exact street', () => {
        const bellevue = { ...seattle, id: 2, lat: 47.6101, lng: -122.2015, location: 'Bellevue, WA' };
        const tacoma = { ...seattle, id: 3, lat: 47.2529, lng: -122.4443, location: 'Tacoma, WA' };
        const origin = { lat: 47.6062, lng: -122.3321 };
        const nearby = filterByRadius([seattle, bellevue, tacoma], origin, 10);
        assert.deepEqual(nearby.map((post) => post.id), [1, 2]);
    });

    it('rejects an address that is far from the service area', () => {
        assert.equal(
            addressFitsArea(
                { lat: 47.6062, lng: -122.3321 },
                { lat: 45.5152, lng: -122.6784 }
            ),
            false
        );
        assert.equal(
            addressFitsArea(
                { lat: 47.6062, lng: -122.3321 },
                { lat: 47.609, lng: -122.339 }
            ),
            true
        );
    });
});
