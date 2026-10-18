'use strict';

const EARTH_MILES = 3958.7613;
const ALLOWED_RADII = [5, 10, 25, 50];
const DEFAULT_RADIUS = 25;
const DEFAULT_VISIBILITY = 'after_hire';
const MAX_ADDRESS_DISTANCE_MILES = 50;

const AREA_TYPES = new Set([
    'locality',
    'postal_town',
    'sublocality',
    'sublocality_level_1',
    'sublocality_level_2',
    'neighborhood',
    'postal_code',
    'administrative_area_level_2',
    'administrative_area_level_3',
    'colloquial_area',
]);

const STREET_TYPES = new Set([
    'street_address',
    'premise',
    'subpremise',
    'route',
    'intersection',
    'plus_code',
]);

const POST_LOCATION_COLUMNS = [
    ['place_id', 'VARCHAR(255) NULL'],
    ['locality', 'VARCHAR(255) NULL'],
    ['neighborhood', 'VARCHAR(255) NULL'],
    ['admin_area', 'VARCHAR(64) NULL'],
    ['country', 'VARCHAR(64) NULL'],
    ['postal_code', 'VARCHAR(32) NULL'],
    ['lat', 'DECIMAL(10, 7) NULL'],
    ['lng', 'DECIMAL(10, 7) NULL'],
    ['address_place_id', 'VARCHAR(255) NULL'],
    ['address_formatted', 'VARCHAR(512) NULL'],
    ['address_lat', 'DECIMAL(10, 7) NULL'],
    ['address_lng', 'DECIMAL(10, 7) NULL'],
    ['address_visibility', "VARCHAR(32) NOT NULL DEFAULT 'after_hire'"],
    ['current_bidder_id', 'INT NULL'],
    ['accepted_user_id', 'INT NULL'],
];

function toNumber(value) {
    if (value == null || value === '') {
        return null;
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function milesBetween(lat1, lng1, lat2, lng2) {
    const aLat = toNumber(lat1);
    const aLng = toNumber(lng1);
    const bLat = toNumber(lat2);
    const bLng = toNumber(lng2);
    if ([aLat, aLng, bLat, bLng].some((n) => n == null)) {
        return null;
    }
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(bLat - aLat);
    const dLng = toRad(bLng - aLng);
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

function roundMiles(miles) {
    if (miles == null) {
        return null;
    }
    return Math.round(miles * 10) / 10;
}

function hasType(types, wanted) {
    return (types || []).includes(wanted);
}

function isStreetPlace(types) {
    return (types || []).some((type) => STREET_TYPES.has(type));
}

function isAreaPlace(types) {
    return (types || []).some((type) => AREA_TYPES.has(type));
}

function publicLabel(place) {
    const parts = [];
    if (place.neighborhood && place.neighborhood !== place.locality) {
        parts.push(place.neighborhood);
    }
    if (place.locality) {
        parts.push(place.locality);
    } else if (place.county) {
        parts.push(place.county);
    }
    if (place.admin_area) {
        parts.push(place.admin_area);
    }
    if (place.postal_code && parts.length === 0) {
        parts.push(place.postal_code);
    }
    if (parts.length) {
        return parts.join(', ');
    }
    return place.shortFormattedAddress || place.formattedAddress || '';
}

function assertUsableArea(place) {
    if (!place || toNumber(place.lat) == null || toNumber(place.lng) == null) {
        return { error: 'Choose a city or service area from the suggestions' };
    }

    const types = place.types || [];
    const hasLocalArea = Boolean(
        place.locality || place.neighborhood || place.postal_code || place.county
    );

    if (hasType(types, 'country') && !hasLocalArea) {
        return { error: 'Choose a city or neighborhood, not a country' };
    }
    if (hasType(types, 'administrative_area_level_1') && !hasLocalArea) {
        return { error: 'Choose a city, neighborhood, or ZIP — a whole state is too broad' };
    }
    if (isStreetPlace(types) && (place.locality || place.neighborhood || place.postal_code)) {
        return { value: 'street' };
    }
    if (isAreaPlace(types) || hasLocalArea) {
        return { value: 'area' };
    }
    return { error: 'Choose a city, neighborhood, ZIP, or county from the suggestions' };
}

function canViewPreciseAddress(post, viewerId) {
    if (!post || !post.address_formatted) {
        return false;
    }
    if (post.address_visibility === 'public') {
        return true;
    }
    const viewer = Number(viewerId);
    if (!Number.isInteger(viewer) || viewer <= 0) {
        return false;
    }
    return Number(post.user_id) === viewer || Number(post.accepted_user_id) === viewer;
}

function publicPostView(post, viewerId, origin) {
    const view = {
        id: post.id,
        user_id: post.user_id,
        title: post.title,
        description: post.description,
        location: post.location,
        locality: post.locality || null,
        neighborhood: post.neighborhood || null,
        admin_area: post.admin_area || null,
        country: post.country || null,
        postal_code: post.postal_code || null,
        lat: toNumber(post.lat),
        lng: toNumber(post.lng),
        max_pay: post.max_pay,
        type_of_pay: post.type_of_pay,
        current_bid: post.current_bid,
        address_visibility: post.address_visibility || DEFAULT_VISIBILITY,
        has_precise_address: Boolean(post.address_formatted),
        precise_address: null,
        address_shared_when: post.address_formatted
            ? post.address_visibility === 'public'
                ? 'now'
                : 'after_hire'
            : null,
    };

    if (origin) {
        view.distance_miles = roundMiles(milesBetween(origin.lat, origin.lng, view.lat, view.lng));
    }

    if (canViewPreciseAddress(post, viewerId)) {
        view.precise_address = post.address_formatted;
    }

    const viewer = Number(viewerId);
    const isOwner = Number.isInteger(viewer) && viewer > 0 && Number(post.user_id) === viewer;
    if (isOwner) {
        view.is_owner = true;
        view.current_bidder_id = post.current_bidder_id || null;
        view.accepted_user_id = post.accepted_user_id || null;
        if (post.bid_count != null && post.bid_count !== '') {
            view.bid_count = Number(post.bid_count);
        }
    } else if (Number.isInteger(viewer) && viewer > 0 && Number(post.accepted_user_id) === viewer) {
        view.is_hired = true;
    }

    return view;
}

function redactPosts(posts, viewerId, origin) {
    return (posts || []).map((post) => publicPostView(post, viewerId, origin));
}

function filterByRadius(posts, origin, radiusMiles) {
    if (!origin) {
        return posts;
    }
    const radius = ALLOWED_RADII.includes(Number(radiusMiles))
        ? Number(radiusMiles)
        : DEFAULT_RADIUS;
    return (posts || [])
        .map((post) => ({
            post,
            miles: milesBetween(origin.lat, origin.lng, post.lat, post.lng),
        }))
        .filter((entry) => entry.miles != null && entry.miles <= radius)
        .sort((a, b) => a.miles - b.miles || Number(a.post.id) - Number(b.post.id))
        .map((entry) => entry.post);
}

function addressFitsArea(area, address) {
    if (!area || !address) {
        return true;
    }
    const miles = milesBetween(area.lat, area.lng, address.lat, address.lng);
    if (miles == null) {
        return false;
    }
    return miles <= MAX_ADDRESS_DISTANCE_MILES;
}

function ensurePostsLocationColumns(db, done) {
    db.query(
        `SELECT COLUMN_NAME AS name
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'posts'`,
        (err, rows) => {
            if (err) {
                done(err);
                return;
            }
            if (!rows.length) {
                done();
                return;
            }

            const have = new Set(rows.map((row) => row.name));
            const missing = POST_LOCATION_COLUMNS.filter(([name]) => !have.has(name));

            const next = (index) => {
                if (index >= missing.length) {
                    done();
                    return;
                }
                const [name, definition] = missing[index];
                db.query(`ALTER TABLE posts ADD COLUMN \`${name}\` ${definition}`, (alterErr) => {
                    if (alterErr) {
                        done(alterErr);
                        return;
                    }
                    next(index + 1);
                });
            };
            next(0);
        }
    );
}

module.exports = {
    ALLOWED_RADII,
    DEFAULT_RADIUS,
    DEFAULT_VISIBILITY,
    MAX_ADDRESS_DISTANCE_MILES,
    POST_LOCATION_COLUMNS,
    milesBetween,
    publicLabel,
    assertUsableArea,
    canViewPreciseAddress,
    publicPostView,
    redactPosts,
    filterByRadius,
    addressFitsArea,
    isStreetPlace,
    ensurePostsLocationColumns,
};
