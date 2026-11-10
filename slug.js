const { randomInt } = require('node:crypto');

const SLUG_LENGTH = 8;
const SLUG_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function generateSlug() {
  return Array.from(
    { length: SLUG_LENGTH },
    () => SLUG_CHARACTERS[randomInt(SLUG_CHARACTERS.length)]
  ).join('');
}

module.exports = { generateSlug, SLUG_LENGTH, SLUG_CHARACTERS };
