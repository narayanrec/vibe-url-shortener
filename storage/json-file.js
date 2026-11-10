const fs = require('node:fs');
const path = require('node:path');

/**
 * File-backed implementation of the link storage contract:
 * - findByCode(code) -> Promise<string | null>
 * - findByUrl(url) -> Promise<{ code, url } | null>
 * - createOrGet(url, makeCode) -> Promise<{ code, url, created }>
 * - list() -> Promise<Array<{ code, url }>>
 *
 * createOrGet must return an existing code for a URL already in storage.
 */
class JsonFileStorage {
  constructor(filePath = path.join(__dirname, '..', 'links.json')) {
    this.filePath = filePath;
    this.links = {};
    try {
      this.links = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw new Error(`Could not load links from ${this.filePath}: ${error.message}`);
    }
  }

  async findByCode(code) {
    return this.links[code] || null;
  }

  async findByUrl(url) {
    const entry = Object.entries(this.links).find(([, savedUrl]) => savedUrl === url);
    return entry ? { code: entry[0], url: entry[1] } : null;
  }

  async createOrGet(url, makeCode) {
    // Keep the lookup and write together without yielding, so parallel requests
    // in this process cannot create duplicate entries for the same URL.
    const existingEntry = Object.entries(this.links).find(([, savedUrl]) => savedUrl === url);
    const existing = existingEntry ? { code: existingEntry[0], url: existingEntry[1] } : null;
    if (existing) return { ...existing, created: false };

    let code;
    do { code = makeCode(); } while (this.links[code]);
    this.links[code] = url;
    try {
      this.save();
    } catch (error) {
      delete this.links[code];
      throw error;
    }
    return { code, url, created: true };
  }

  async list() {
    return Object.entries(this.links).map(([code, url]) => ({ code, url }));
  }

  save() {
    const tempFile = `${this.filePath}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(this.links, null, 2));
    fs.renameSync(tempFile, this.filePath);
  }
}

module.exports = { JsonFileStorage };
