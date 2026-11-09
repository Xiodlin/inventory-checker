const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync, existsSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { test } = require('node:test');
const desktop = require('../package.json');

for (const command of ['package', 'package:mac', 'package:win']) {
  test(`${command} increments only the desktop patch version before packaging`, () => {
    const directory = mkdtempSync(join(tmpdir(), 'inventory-release-version-'));
    const save = (path, value) => writeFileSync(join(directory, path), JSON.stringify(value, null, 2));
    const load = path => JSON.parse(readFileSync(join(directory, path), 'utf8'));
    try {
      mkdirSync(join(directory, 'desktop'));
      mkdirSync(join(directory, 'desktop/scripts'));
      copyFileSync(join(__dirname, '../scripts/bump-version.cjs'), join(directory, 'desktop/scripts/bump-version.cjs'));
      save('package.json', { name: 'release-fixture', version: '4.0.0', private: true, workspaces: ['desktop'] });
      save('desktop/package.json', {
        name: desktop.name, version: '1.0.9',
        scripts: {
          [`pre${command}`]: desktop.scripts[`pre${command}`],
          [command]: 'node -e "require(\'node:fs\').writeFileSync(\'built-version\', require(\'./package.json\').version)"',
        },
      });
      save('package-lock.json', {
        name: 'release-fixture', version: '4.0.0', lockfileVersion: 3, requires: true,
        packages: {
          '': { name: 'release-fixture', version: '4.0.0', workspaces: ['desktop'] },
          desktop: { name: desktop.name, version: '1.0.9' },
        },
      });
      assert.ok(process.env.npm_execpath, 'Run via npm run test:release --workspace desktop');
      for (const expected of ['1.0.10', '1.0.11']) {
        execFileSync(process.execPath, [process.env.npm_execpath, 'run', command, '--workspace', 'desktop'], {
          cwd: directory, stdio: 'pipe',
        });
        assert.equal(load('desktop/package.json').version, expected);
        assert.equal(load('package-lock.json').packages.desktop.version, expected);
        assert.equal(readFileSync(join(directory, 'desktop/built-version'), 'utf8'), expected);
        assert.equal(load('package.json').version, '4.0.0');
        assert.equal(load('package-lock.json').version, '4.0.0');
      }
      assert.equal(existsSync(join(directory, '.git')), false);
      const lock = load('package-lock.json');
      lock.packages.desktop.version = '0.0.0';
      save('package-lock.json', lock);
      assert.throws(() => execFileSync(process.execPath, [process.env.npm_execpath, 'run', command, '--workspace', 'desktop'], {
        cwd: directory, stdio: 'pipe',
      }), /matching names and versions/);
      assert.equal(load('desktop/package.json').version, '1.0.11');
      assert.equal(load('package-lock.json').packages.desktop.version, '0.0.0');
      assert.equal(readFileSync(join(directory, 'desktop/built-version'), 'utf8'), '1.0.11');
      save('desktop/package.json', { ...load('desktop/package.json'), version: '1.0.12-beta.1' });
      assert.throws(() => execFileSync(process.execPath, [process.env.npm_execpath, 'run', command, '--workspace', 'desktop'], {
        cwd: directory, stdio: 'pipe',
      }), /stable major.minor.patch/);
      assert.equal(load('desktop/package.json').version, '1.0.12-beta.1');
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
}
