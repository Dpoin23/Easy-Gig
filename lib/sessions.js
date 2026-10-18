'use strict';

const crypto = require('node:crypto');

const COOKIE_NAME = 'eg_session';
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function newSessionToken() {
    return crypto.randomBytes(32).toString('base64url');
}

function hashSessionToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function readSessionToken(cookieHeader) {
    if (typeof cookieHeader !== 'string') {
        return null;
    }

    for (const part of cookieHeader.split(';')) {
        const eq = part.indexOf('=');
        if (eq === -1 || part.slice(0, eq).trim() !== COOKIE_NAME) {
            continue;
        }
        const value = part.slice(eq + 1).trim();
        return TOKEN_PATTERN.test(value) ? value : null;
    }

    return null;
}

function cookieString(value, maxAge, secure) {
    const parts = [
        `${COOKIE_NAME}=${value}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        `Max-Age=${maxAge}`,
    ];
    if (secure) {
        parts.push('Secure');
    }
    return parts.join('; ');
}

function sessionCookie(token, secure) {
    return cookieString(token, SESSION_TTL_SECONDS, secure);
}

function clearSessionCookie(secure) {
    return cookieString('', 0, secure);
}

module.exports = {
    COOKIE_NAME,
    SESSION_TTL_SECONDS,
    newSessionToken,
    hashSessionToken,
    readSessionToken,
    sessionCookie,
    clearSessionCookie,
};
