const test = require('node:test');
const assert = require('node:assert/strict');
const { generateSlug, SLUG_LENGTH } = require('../slug');

test('generates an 8-character slug', () => {
  assert.equal(generateSlug().length, SLUG_LENGTH);
});

test('uses only mixed-case alphanumeric characters', () => {
  const slug = generateSlug();

  assert.match(slug, /^[A-Za-z0-9]{8}$/);
});
