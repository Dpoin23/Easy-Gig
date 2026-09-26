'use strict';

const PAY_TYPES = new Set(['one-time', 'hourly', 'yearly']);
const MAX_TEXT = 255;
const MAX_SEARCH = 200;
const MAX_PAY = 999999.99;

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

module.exports = {
    textField,
    emailField,
    passwordField,
    signinPassword,
    idField,
    moneyField,
    payTypeField,
    searchField,
};
