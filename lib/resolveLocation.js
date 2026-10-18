'use strict';

const { placeDetails } = require('./places');
const {
    DEFAULT_VISIBILITY,
    publicLabel,
    assertUsableArea,
    addressFitsArea,
} = require('./postLocation');

async function resolveGigLocation({
    areaPlaceId,
    areaSessionToken,
    addressPlaceId,
    addressSessionToken,
    addressVisibility,
}) {
    const area = await placeDetails(areaPlaceId, areaSessionToken);
    const areaKind = assertUsableArea(area);
    if (areaKind.error) {
        return { error: areaKind.error };
    }
    if (areaKind.value === 'street') {
        return {
            error: 'Choose a city or neighborhood for the service area. You can add the street address separately.',
        };
    }

    let address = null;
    if (addressPlaceId) {
        address = await placeDetails(addressPlaceId, addressSessionToken);
        if (!address.formattedAddress) {
            return { error: 'Choose a specific address from the suggestions' };
        }
        if (!addressFitsArea(area, address)) {
            return { error: 'That address is too far from the selected city or service area' };
        }
    }

    const location = publicLabel(area);
    if (!location) {
        return { error: 'Choose a city or service area from the suggestions' };
    }

    return {
        value: {
            location,
            area,
            address,
            visibility: address ? addressVisibility || DEFAULT_VISIBILITY : DEFAULT_VISIBILITY,
        },
    };
}

const INSERT_POST_SQL = `INSERT INTO posts (
    title, description, location, max_pay, type_of_pay, user_id,
    place_id, locality, neighborhood, admin_area, country, postal_code, lat, lng,
    address_place_id, address_formatted, address_lat, address_lng, address_visibility
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

function insertPostParams({ title, description, pay, payType, userId }, resolved) {
    const { location, area, address, visibility } = resolved;
    return [
        title,
        description,
        location,
        pay,
        payType,
        userId,
        area.placeId,
        area.locality || null,
        area.neighborhood || null,
        area.admin_area || null,
        area.country || null,
        area.postal_code || null,
        area.lat,
        area.lng,
        address ? address.placeId : null,
        address ? address.formattedAddress : null,
        address ? address.lat : null,
        address ? address.lng : null,
        visibility,
    ];
}

module.exports = {
    resolveGigLocation,
    INSERT_POST_SQL,
    insertPostParams,
};
