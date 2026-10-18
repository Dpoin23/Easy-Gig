'use strict';

const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const PLACE_URL = 'https://places.googleapis.com/v1/places';

const AREA_PRIMARY_TYPES = [
    'locality',
    'neighborhood',
    'postal_code',
    'sublocality',
    'administrative_area_level_2',
];

const AUTOCOMPLETE_FIELD_MASK = [
    'suggestions.placePrediction.placeId',
    'suggestions.placePrediction.text',
    'suggestions.placePrediction.structuredFormat',
    'suggestions.placePrediction.types',
].join(',');

const DETAILS_FIELD_MASK = [
    'id',
    'formattedAddress',
    'shortFormattedAddress',
    'location',
    'addressComponents',
    'types',
].join(',');

function getApiKey() {
    return String(process.env.GOOGLE_PLACES_API_KEY || '').trim();
}

function placesConfigured() {
    return Boolean(getApiKey());
}

function placesError(status, message) {
    const err = new Error(message);
    err.status = status;
    return err;
}

async function googFetch(url, options, timeoutMs = 5000) {
    const key = getApiKey();
    if (!key) {
        throw placesError(503, 'Location lookup is not configured');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': key,
                ...(options.headers || {}),
            },
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
            const message = body.error?.message || 'Location lookup failed';
            throw placesError(res.status === 429 ? 429 : 502, message);
        }
        return body;
    } catch (err) {
        if (err.name === 'AbortError') {
            throw placesError(504, 'Location lookup timed out');
        }
        throw err;
    } finally {
        clearTimeout(timer);
    }
}

function mapSuggestions(body) {
    const suggestions = Array.isArray(body?.suggestions) ? body.suggestions : [];
    return suggestions
        .map((row) => row.placePrediction)
        .filter(Boolean)
        .map((pred) => ({
            placeId: pred.placeId,
            text: pred.text?.text || '',
            mainText: pred.structuredFormat?.mainText?.text || pred.text?.text || '',
            secondaryText: pred.structuredFormat?.secondaryText?.text || '',
            types: pred.types || [],
        }));
}

async function autocomplete({ input, sessionToken, mode, locationBias } = {}) {
    const body = {
        input,
        languageCode: 'en',
    };
    if (sessionToken) {
        body.sessionToken = sessionToken;
    }
    if (mode === 'area') {
        body.includedPrimaryTypes = AREA_PRIMARY_TYPES;
    }
    if (
        locationBias &&
        Number.isFinite(Number(locationBias.lat)) &&
        Number.isFinite(Number(locationBias.lng))
    ) {
        body.locationBias = {
            circle: {
                center: {
                    latitude: Number(locationBias.lat),
                    longitude: Number(locationBias.lng),
                },
                radius: Number(locationBias.radiusMeters) || 50000,
            },
        };
    }

    const json = await googFetch(AUTOCOMPLETE_URL, {
        method: 'POST',
        headers: { 'X-Goog-FieldMask': AUTOCOMPLETE_FIELD_MASK },
        body: JSON.stringify(body),
    });
    return mapSuggestions(json);
}

function readComponent(components, type) {
    const list = Array.isArray(components) ? components : [];
    const row = list.find((item) => (item.types || []).includes(type));
    if (!row) {
        return null;
    }
    return {
        long: row.longText || row.long_name || '',
        short: row.shortText || row.short_name || '',
    };
}

function normalizePlace(raw) {
    const components = raw?.addressComponents || raw?.address_components || [];
    const locality =
        readComponent(components, 'locality') ||
        readComponent(components, 'postal_town') ||
        readComponent(components, 'sublocality') ||
        readComponent(components, 'sublocality_level_1');
    const neighborhood = readComponent(components, 'neighborhood');
    const admin = readComponent(components, 'administrative_area_level_1');
    const county = readComponent(components, 'administrative_area_level_2');
    const country = readComponent(components, 'country');
    const postal = readComponent(components, 'postal_code');
    const loc = raw?.location || {};

    return {
        placeId: raw?.id || raw?.placeId || null,
        formattedAddress: raw?.formattedAddress || raw?.formatted_address || '',
        shortFormattedAddress: raw?.shortFormattedAddress || '',
        types: raw?.types || [],
        locality: locality?.long || '',
        neighborhood: neighborhood?.long || '',
        admin_area: admin?.short || admin?.long || '',
        county: county?.long || '',
        country: country?.short || country?.long || '',
        postal_code: postal?.long || '',
        lat: loc.latitude ?? loc.lat ?? null,
        lng: loc.longitude ?? loc.lng ?? null,
    };
}

async function placeDetails(placeId, sessionToken) {
    const params = new URLSearchParams();
    if (sessionToken) {
        params.set('sessionToken', sessionToken);
    }
    const qs = params.toString();
    const url = `${PLACE_URL}/${encodeURIComponent(placeId)}${qs ? `?${qs}` : ''}`;
    const json = await googFetch(url, {
        method: 'GET',
        headers: { 'X-Goog-FieldMask': DETAILS_FIELD_MASK },
    });
    return normalizePlace(json);
}

module.exports = {
    AREA_PRIMARY_TYPES,
    placesConfigured,
    autocomplete,
    placeDetails,
    normalizePlace,
    mapSuggestions,
};
