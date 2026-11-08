const { spawnSync } = require('node:child_process');
const { join } = require('node:path');

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (process.platform === 'darwin') {
  run(process.execPath, [require.resolve('electron-builder/cli.js'), '--dir', '--mac',
    '-c.mac.identity=-', '-c.directories.output=release/local-dev']);
  const bundle = join(process.cwd(), 'release/local-dev', `mac${process.arch === 'arm64' ? '-arm64' : ''}`, 'Inventory Checker.app');
  run('codesign', ['--verify', '--deep', '--strict', bundle]);
  console.log('Signed local app ready. Exit any older tray instance before launching; macOS manages notification permission.');
  if (!process.argv.includes('--prepare')) run(join(bundle, 'Contents/MacOS/Inventory Checker'), []);
} else if (!process.argv.includes('--prepare')) {
  run(require('electron'), ['.']);
}
