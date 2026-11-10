const fs = require('node:fs');
const path = require('node:path');

/**
 * File-backed implementation of the link storage contract:
 * - findByCode(code) -> Promise<{ url, expiresAt } | null>
 * - findByUrl(url) -> Promise<{ code, url } | null>
 * - createOrGet(url, makeCode) -> Promise<{ code, url, created }>
 * - list() -> Promise<Array<{ code, url, expiresAt }>>
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
    let migrated = false;
    for (const [code, saved] of Object.entries(this.links)) {
      if (typeof saved === 'string') {
        this.links[code] = { url: saved, expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() };
        migrated = true;
      }
    }
    if (migrated) this.save();
  }

  async findByCode(code) {
    const entry = this.getEntry(this.links[code]);
    if (!entry || Date.parse(entry.expiresAt) <= Date.now()) return null;
    return entry;
  }

  async findByUrl(url) {
    const entry = Object.entries(this.links).find(([, saved]) => {
      const value = this.getEntry(saved);
      return value && value.url === url && Date.parse(value.expiresAt) > Date.now();
    });
    if (!entry) return null;
    return { code: entry[0], ...this.getEntry(entry[1]) };
  }

  async createOrGet(url, makeCode) {
    // Keep the lookup and write together without yielding, so parallel requests
    // in this process cannot create duplicate entries for the same URL.
    const existingEntry = Object.entries(this.links).find(([, saved]) => {
      const value = this.getEntry(saved);
      return value && value.url === url && Date.parse(value.expiresAt) > Date.now();
    });
    const existing = existingEntry ? { code: existingEntry[0], ...this.getEntry(existingEntry[1]) } : null;
    if (existing) return { ...existing, created: false };

    let code;
    do {
      code = makeCode();
      const occupied = this.getEntry(this.links[code]);
      if (!occupied || Date.parse(occupied.expiresAt) <= Date.now()) break;
    } while (true);
    const entry = { url, expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() };
    const previous = this.links[code];
    this.links[code] = entry;
    try {
      this.save();
    } catch (error) {
      if (previous) this.links[code] = previous;
      else delete this.links[code];
      throw error;
    }
    return { code, ...entry, created: true };
  }

  async list() {
    return Object.entries(this.links)
      .map(([code, saved]) => ({ code, ...this.getEntry(saved) }))
      .filter((entry) => entry.expiresAt && Date.parse(entry.expiresAt) > Date.now());
  }

  getEntry(saved) {
    if (!saved || typeof saved.url !== 'string' || !saved.expiresAt) return null;
    return { url: saved.url, expiresAt: saved.expiresAt };
  }

  save() {
    const tempFile = `${this.filePath}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(this.links, null, 2));
    fs.renameSync(tempFile, this.filePath);
  }
}

module.exports = { JsonFileStorage };
