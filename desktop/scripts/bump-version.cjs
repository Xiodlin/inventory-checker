const { readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');

const manifestPath = resolve(__dirname, '../package.json');
const lockPath = resolve(__dirname, '../../package-lock.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(manifest.version);
if (!match || !match.slice(1).every(value => Number.isSafeInteger(Number(value))) ||
    !Number.isSafeInteger(Number(match[3]) + 1)) {
  throw new Error('Automatic releases require a stable major.minor.patch version with safe integer components.');
}
if (lock.packages?.desktop?.name !== manifest.name || lock.packages.desktop.version !== manifest.version) {
  throw new Error('Desktop package and root lockfile must have matching names and versions before packaging.');
}
const version = `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
manifest.version = version;
lock.packages.desktop.version = version;
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
console.log(`Desktop release version: ${version}`);
