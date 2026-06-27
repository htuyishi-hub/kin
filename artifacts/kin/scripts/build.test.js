const test = require('node:test');
const assert = require('node:assert/strict');

const { getDeploymentDomain } = require('./build');

test('uses a Railway public domain when present', () => {
  const env = { RAILWAY_PUBLIC_DOMAIN: 'example.up.railway.app' };
  assert.equal(getDeploymentDomain(env), 'example.up.railway.app');
});

test('falls back to localhost when no deployment domain is provided', () => {
  const env = {};
  assert.equal(getDeploymentDomain(env), 'localhost');
});
