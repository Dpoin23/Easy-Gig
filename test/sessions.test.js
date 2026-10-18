const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    COOKIE_NAME,
    SESSION_TTL_SECONDS,
    newSessionToken,
    hashSessionToken,
    readSessionToken,
    sessionCookie,
    clearSessionCookie,
} = require('../lib/sessions');

describe('newSessionToken', () => {
    it('makes a 43 character base64url token', () => {
        const token = newSessionToken();
        assert.match(token, /^[A-Za-z0-9_-]{43}$/);
    });

    it('does not repeat', () => {
        assert.notEqual(newSessionToken(), newSessionToken());
    });
});

describe('hashSessionToken', () => {
    it('is a stable sha256 hex digest', () => {
        const token = newSessionToken();
        assert.equal(hashSessionToken(token), hashSessionToken(token));
        assert.match(hashSessionToken(token), /^[0-9a-f]{64}$/);
    });

    it('differs from the token so the database never stores the cookie value', () => {
        const token = newSessionToken();
        assert.notEqual(hashSessionToken(token), token);
    });
});

describe('readSessionToken', () => {
    it('finds the session cookie among others', () => {
        const token = newSessionToken();
        assert.equal(readSessionToken(`theme=dark; ${COOKIE_NAME}=${token}; other=1`), token);
    });

    it('returns null without a cookie header', () => {
        assert.equal(readSessionToken(undefined), null);
        assert.equal(readSessionToken(''), null);
    });

    it('returns null when the session cookie is missing', () => {
        assert.equal(readSessionToken('theme=dark; other=1'), null);
    });

    it('rejects a malformed token', () => {
        assert.equal(readSessionToken(`${COOKIE_NAME}=short`), null);
        assert.equal(readSessionToken(`${COOKIE_NAME}=${'a'.repeat(42)}'`), null);
    });

    it('does not match a cookie whose name only ends with the session name', () => {
        const token = newSessionToken();
        assert.equal(readSessionToken(`x${COOKIE_NAME}=${token}`), null);
    });
});

describe('session cookies', () => {
    it('sets an httpOnly, same-site cookie for the session lifetime', () => {
        const cookie = sessionCookie('abc', false);
        assert.ok(cookie.startsWith(`${COOKIE_NAME}=abc;`));
        assert.ok(cookie.includes('HttpOnly'));
        assert.ok(cookie.includes('SameSite=Lax'));
        assert.ok(cookie.includes('Path=/'));
        assert.ok(cookie.includes(`Max-Age=${SESSION_TTL_SECONDS}`));
        assert.ok(!cookie.includes('Secure'));
    });

    it('adds Secure when asked', () => {
        assert.ok(sessionCookie('abc', true).endsWith('; Secure'));
    });

    it('clears with an empty value and zero age', () => {
        const cookie = clearSessionCookie(false);
        assert.ok(cookie.startsWith(`${COOKIE_NAME}=;`));
        assert.ok(cookie.includes('Max-Age=0'));
    });
});
