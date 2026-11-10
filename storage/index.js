const { JsonFileStorage } = require('./json-file');

// Storage implementations share the async contract documented in json-file.js.
// Add another driver here when its adapter is available.
function createStorage(driver = process.env.STORAGE_DRIVER || 'json-file') {
  if (driver === 'json-file') return new JsonFileStorage();
  throw new Error(`Unknown storage driver "${driver}". Available drivers: json-file.`);
}

module.exports = { createStorage };
