#!/usr/bin/env node
/**
 * Build script for Firefox packaging.
 * Creates dist-firefox/ folder and XPI with forward-slash paths (AMO requirement).
 *
 * Usage:
 *   node scripts/build-firefox.cjs
 */

const fs = require('fs');
const path = require('path');
const { ZipArchive: ArchiverZip } = require('archiver');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist-firefox');

// Clean previous build
if (fs.existsSync(DIST)) {
  fs.rmSync(DIST, { recursive: true });
}

fs.mkdirSync(DIST, { recursive: true });

// Copy manifest-firefox.json as manifest.json
fs.copyFileSync(
  path.join(ROOT, 'manifest-firefox.json'),
  path.join(DIST, 'manifest.json')
);

// Recursively copy directories
function copyDir(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const file of fs.readdirSync(srcDir)) {
    const srcPath = path.join(srcDir, file);
    const destPath = path.join(destDir, file);
    if (fs.statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyDir(path.join(ROOT, 'src'), path.join(DIST, 'src'));
copyDir(path.join(ROOT, 'icons'), path.join(DIST, 'icons'));
copyDir(path.join(ROOT, '_locales'), path.join(DIST, '_locales'));

console.log('Firefox build created at: ' + DIST);

// Create XPI with forward-slash paths (AMO requirement)
const version = JSON.parse(fs.readFileSync(path.join(DIST, 'manifest.json'), 'utf-8')).version;
const xpiName = `gemini-project-manager-pro-${version}.xpi`;
const xpiPath = path.join(DIST, xpiName);

const output = fs.createWriteStream(xpiPath);
const archive = new ArchiverZip({ zlib: { level: 9 } });

output.on('close', () => {
  console.log('XPI created: ' + xpiPath + ' (' + Math.round(fs.statSync(xpiPath).size / 1024) + ' KB)');
  console.log('');
  console.log('To load temporarily: about:debugging → This Firefox → Load Temporary Add-on → dist-firefox/manifest.json');
  console.log('To publish on AMO:   Upload ' + xpiName + ' to https://addons.mozilla.org/developers/');
});

archive.on('error', (err) => { throw err; });

archive.pipe(output);

// Add files with forward-slash paths
archive.file(path.join(DIST, 'manifest.json'), { name: 'manifest.json' });

function addDirToArchive(archive, dirPath, prefix) {
  for (const file of fs.readdirSync(dirPath)) {
    const fullPath = path.join(dirPath, file);
    const entryName = prefix + '/' + file;
    if (fs.statSync(fullPath).isDirectory()) {
      addDirToArchive(archive, fullPath, entryName);
    } else if (file !== 'generate-icons.html' && file !== 'README.md') {
      archive.file(fullPath, { name: entryName });
    }
  }
}

addDirToArchive(archive, path.join(DIST, 'src'), 'src');
addDirToArchive(archive, path.join(DIST, 'icons'), 'icons');
addDirToArchive(archive, path.join(DIST, '_locales'), '_locales');

archive.finalize();