'use strict';

const PAY_TYPES = new Set(['one-time', 'hourly', 'yearly']);
const PLACE_MODES = new Set(['area', 'address', 'search']);
const ADDRESS_VISIBILITY = new Set(['after_hire', 'public']);
const ALLOWED_RADII = new Set([5, 10, 25, 50]);
const MAX_TEXT = 255;
const MAX_SEARCH = 200;
const MAX_PAY = 999999.99;
const MAX_PLACE_ID = 255;
const MAX_SESSION_TOKEN = 64;

function textField(value, label, max = MAX_TEXT) {
    if (typeof value !== 'string') {
        return { error: `${label} is required` };
    }

    const text = value.trim();
    if (!text) {
        return { error: `${label} is required` };
    }
    if (text.length > max) {
        return { error: `${label} is too long` };
    }

    return { value: text };
}

function emailField(value) {
    const parsed = textField(value, 'Email');
    if (parsed.error) {
        return parsed;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsed.value)) {
        return { error: 'Email is invalid' };
    }
    return parsed;
}

function passwordField(value) {
    if (typeof value !== 'string' || value.length < 8 || value.length > 64) {
        return { error: 'Password must be 8 to 64 characters' };
    }
    return { value };
}

function signinPassword(value) {
    if (typeof value !== 'string' || value.length === 0 || value.length > 64) {
        return { error: 'Password is required' };
    }
    return { value };
}

function idField(value, label) {
    if (typeof value === 'string' && value.trim() === '') {
        return { error: `${label} is invalid` };
    }
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) {
        return { error: `${label} is invalid` };
    }
    return { value: id };
}

function moneyField(value, label) {
    if (typeof value === 'string' && value.trim() === '') {
        return { error: `${label} is invalid` };
    }
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0 || amount > MAX_PAY) {
        return { error: `${label} is invalid` };
    }
    return { value: Math.round(amount * 100) / 100 };
}

function payTypeField(value) {
    const parsed = textField(value, 'Pay type', 32);
    if (parsed.error) {
        return parsed;
    }
    const type = parsed.value.toLowerCase();
    if (!PAY_TYPES.has(type)) {
        return { error: 'Pay type is invalid' };
    }
    return { value: type };
}

function searchField(value) {
    if (value == null) {
        return { value: '' };
    }
    if (typeof value !== 'string') {
        return { error: 'Search must be text' };
    }
    const text = value.trim();
    if (text.length > MAX_SEARCH) {
        return { error: 'Search is too long' };
    }
    return { value: text };
}

function placeIdField(value, label, required = false) {
    if (value == null || (typeof value === 'string' && value.trim() === '')) {
        return required ? { error: `${label} is required` } : { value: null };
    }
    if (typeof value !== 'string') {
        return { error: `${label} is invalid` };
    }
    const text = value.trim();
    if (text.length > MAX_PLACE_ID || /\s/.test(text) || /[^\x21-\x7E]/.test(text)) {
        return { error: `${label} is invalid` };
    }
    return { value: text };
}

function sessionTokenField(value) {
    if (value == null || value === '') {
        return { value: null };
    }
    if (typeof value !== 'string') {
        return { error: 'Session token is invalid' };
    }
    const text = value.trim();
    if (!text || text.length > MAX_SESSION_TOKEN) {
        return { error: 'Session token is invalid' };
    }
    return { value: text };
}

function placesModeField(value) {
    if (value == null || value === '') {
        return { value: 'search' };
    }
    if (typeof value !== 'string') {
        return { error: 'Place search type is invalid' };
    }
    const mode = value.trim().toLowerCase();
    if (!PLACE_MODES.has(mode)) {
        return { error: 'Place search type is invalid' };
    }
    return { value: mode };
}

function addressVisibilityField(value) {
    if (value == null || value === '') {
        return { value: 'after_hire' };
    }
    if (typeof value !== 'string') {
        return { error: 'Address visibility is invalid' };
    }
    const visibility = value.trim().toLowerCase();
    if (!ADDRESS_VISIBILITY.has(visibility)) {
        return { error: 'Address visibility is invalid' };
    }
    return { value: visibility };
}

function radiusField(value) {
    if (value == null || value === '') {
        return { value: 25 };
    }
    const miles = Number(value);
    if (!ALLOWED_RADII.has(miles)) {
        return { error: 'Distance must be 5, 10, 25, or 50 miles' };
    }
    return { value: miles };
}

function coordinateField(value, label, min, max) {
    if (value == null || value === '') {
        return { value: null };
    }
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < min || amount > max) {
        return { error: `${label} is invalid` };
    }
    return { value: amount };
}

function latField(value) {
    return coordinateField(value, 'Latitude', -90, 90);
}

function lngField(value) {
    return coordinateField(value, 'Longitude', -180, 180);
}

module.exports = {
    textField,
    emailField,
    passwordField,
    signinPassword,
    idField,
    moneyField,
    payTypeField,
    searchField,
    placeIdField,
    sessionTokenField,
    placesModeField,
    addressVisibilityField,
    radiusField,
    latField,
    lngField,
};
