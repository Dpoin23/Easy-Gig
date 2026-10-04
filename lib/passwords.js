'use strict';

const crypto = require('node:crypto');

function passwordsMatch(storedHex, derived) {
    if (typeof storedHex !== 'string' || !Buffer.isBuffer(derived)) {
        return false;
    }

    const stored = Buffer.from(storedHex, 'hex');
    if (stored.length === 0 || stored.length !== derived.length) {
        return false;
    }

    return crypto.timingSafeEqual(stored, derived);
}

function findMatchingUser(rows, password) {
    if (!Array.isArray(rows) || typeof password !== 'string') {
        return null;
    }

    for (const user of rows) {
        if (!user || typeof user !== 'object') {
            continue;
        }

        try {
            const derived = crypto.scryptSync(password, String(user.salt ?? ''), 64);
            if (passwordsMatch(user.password, derived)) {
                return user;
            }
        } catch {
            continue;
        }
    }

    return null;
}

module.exports = {
    passwordsMatch,
    findMatchingUser,
};
