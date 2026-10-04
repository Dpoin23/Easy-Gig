const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { passwordsMatch, findMatchingUser } = require('../lib/passwords');

describe('passwordsMatch', () => {
    it('accepts the scrypt hash for the same password and salt', () => {
        const salt = 'fixed-salt';
        const derived = crypto.scryptSync('test-password', salt, 64);
        assert.equal(passwordsMatch(derived.toString('hex'), derived), true);
    });

    it('rejects a different password without throwing', () => {
        const derived = crypto.scryptSync('test-password', 'fixed-salt', 64);
        const other = crypto.scryptSync('other-password', 'fixed-salt', 64);
        assert.equal(passwordsMatch(other.toString('hex'), derived), false);
    });

    it('rejects a truncated hash instead of throwing', () => {
        const derived = crypto.scryptSync('test-password', 'fixed-salt', 64);
        assert.equal(passwordsMatch(derived.toString('hex').slice(0, 10), derived), false);
    });

    it('signs in the modified user when another row shares the email', () => {
        const saltA = 'salt-a';
        const saltB = 'salt-b';
        const rows = [
            {
                id: 1,
                name: 'First',
                salt: saltA,
                password: crypto.scryptSync('first-password', saltA, 64).toString('hex'),
            },
            {
                id: 2,
                name: 'Modified',
                salt: saltB,
                password: crypto.scryptSync('second-password', saltB, 64).toString('hex'),
            },
        ];

        assert.equal(findMatchingUser(rows, 'second-password').id, 2);
        assert.equal(findMatchingUser(rows, 'first-password').id, 1);
        assert.equal(findMatchingUser(rows, 'neither'), null);
        assert.equal(findMatchingUser(null, 'second-password'), null);
    });

    it('rejects missing stored hashes', () => {
        const derived = crypto.scryptSync('test-password', 'fixed-salt', 64);
        assert.equal(passwordsMatch(null, derived), false);
        assert.equal(passwordsMatch(undefined, derived), false);
        assert.equal(passwordsMatch('', derived), false);
    });
});
