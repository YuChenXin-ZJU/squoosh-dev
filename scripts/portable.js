const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

if (process.platform !== 'win32') {
  console.log('Portable build is only generated on Windows.');
  process.exit(0);
}

const root = path.join(__dirname, '..');
const tauriConfig = require(path.join(root, 'src-tauri', 'tauri.conf.json'));
const productName = tauriConfig.package?.productName || 'Squoosh-Desktop';
const version = tauriConfig.package?.version || '0.0.0';
const exeName = `${productName}.exe`;

const releaseDir = path.join(root, 'release-Squoosh-Desktop');
const portableExe = path.join(
  releaseDir,
  `${productName}_${version}_x64_portable.exe`,
);

const buildDir = path.join(root, 'build');
if (!fs.existsSync(buildDir)) {
  console.error(`Missing ${buildDir}. Run "npm run build" first.`);
  process.exit(1);
}

const cargoArgs = [
  'build',
  '--release',
  '--features',
  'custom-protocol,embedded-assets',
];
const cargoResult = spawnSync('cargo', cargoArgs, { stdio: 'inherit' });
if (cargoResult.status !== 0) {
  console.error('Failed to build embedded portable executable.');
  process.exit(cargoResult.status ?? 1);
}

const exePath = path.join(root, 'src-tauri', 'target', 'release', exeName);
if (!fs.existsSync(exePath)) {
  console.error(`Missing ${exePath}.`);
  process.exit(1);
}

fs.mkdirSync(releaseDir, { recursive: true });
fs.copyFileSync(exePath, portableExe);

console.log(`Portable output: ${portableExe}`);
