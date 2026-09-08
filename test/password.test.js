const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

describe('password hashing', () => {
  it('produces a deterministic scrypt hash for the same salt', () => {
    const password = 'test-password';
    const salt = 'fixed-salt-for-test';
    const hashA = crypto.scryptSync(password, salt, 64).toString('hex');
    const hashB = crypto.scryptSync(password, salt, 64).toString('hex');
    assert.equal(hashA, hashB);
    assert.equal(hashA.length, 128);
  });

  it('produces different hashes for different salts', () => {
    const password = 'test-password';
    const hashA = crypto.scryptSync(password, 'salt-a', 64).toString('hex');
    const hashB = crypto.scryptSync(password, 'salt-b', 64).toString('hex');
    assert.notEqual(hashA, hashB);
  });
});
