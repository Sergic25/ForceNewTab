'use strict';
// One source tree, two packages. Runtime JS is copied verbatim, never bundled.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const diagnosticFiles = ['inspection.js', 'button-evidence.js', 'diagnostics.js', 'outcome-trace.js', 'diagnostic-background.js', 'report-ui.js'];
const commonFiles = [...new Set([
  ...manifest.background.scripts, ...manifest.content_scripts.flatMap(script => script.js),
  ...Object.values(manifest.icons), ...Object.values(manifest.action.default_icon),
  ...Object.values(manifest.action.default_icon).map(file => file.replace('/enabled/', '/disabled/')),
  'icon.png', 'icon@2x.png', 'icon-disabled.png', 'icon-disabled@2x.png', 'LICENSE'
])];
function walk(dir) {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
    if (entry.isSymbolicLink()) throw new Error('Build inputs/outputs must not contain symlinks: ' + entry.name);
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}
function writeFolder(name, files) {
  const dir = path.join(dist, name);
  fs.mkdirSync(dir, {recursive: true});
  if (fs.lstatSync(dir).isSymbolicLink()) throw new Error('Output directory is a symlink');
  // Refuse stale/unmanaged files instead of silently shipping them or deleting them.
  for (const full of walk(dir)) {
    const relative = path.relative(dir, full).split(path.sep).join('/');
    if (!files.has(relative)) throw new Error('Unexpected build file; move it out before rebuilding: ' + full);
  }
  for (const [file, bytes] of files) {
    const target = path.join(dir, file);
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, bytes);
  }
}
// Standard uncompressed ZIP, with fixed timestamps for reproducible packages.
function zip(files) {
  const table = Array.from({length: 256}, (_, n) => {
    for (let bit = 0; bit < 8; bit++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
    return n >>> 0;
  });
  const local = [], central = []; let offset = 0, centralSize = 0;
  for (const [file, value] of [...files].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    const name = Buffer.from(file), data = Buffer.isBuffer(value) ? value : Buffer.from(value);
    let crc = 0xffffffff; for (const byte of data) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
    crc = (crc ^ 0xffffffff) >>> 0;
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x800, 6);
    header.writeUInt16LE(33, 12); header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(data.length, 18); header.writeUInt32LE(data.length, 22); header.writeUInt16LE(name.length, 26);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0x800, 8); entry.writeUInt16LE(33, 14); entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(data.length, 20); entry.writeUInt32LE(data.length, 24); entry.writeUInt16LE(name.length, 28);
    entry.writeUInt32LE(offset, 42);
    local.push(header, name, data); central.push(entry, name);
    offset += header.length + name.length + data.length; centralSize += entry.length + name.length;
  }
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(files.size, 8); end.writeUInt16LE(files.size, 10);
  end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, ...central, end]);
}
fs.mkdirSync(dist, {recursive: true});
if (fs.lstatSync(dist).isSymbolicLink()) throw new Error('dist must not be a symlink');
const hashes = [];
function archive(name, files) {
  const bytes = zip(files);
  fs.writeFileSync(path.join(dist, name), bytes);
  hashes.push(crypto.createHash('sha256').update(bytes).digest('hex') + '  ' + name);
}
for (const variant of ['ship', 'testing']) {
  const files = new Map(commonFiles.map(file => [file, fs.readFileSync(path.join(root, file))]));
  const config = structuredClone(manifest);
  let html = fs.readFileSync(path.join(root, 'changelog.html'), 'utf8');
  if (variant === 'testing') {
    config.name += ' — Testing';
    config.background.scripts.splice(2, 0, 'diagnostic-background.js');
    config.content_scripts[0].js.unshift('inspection.js', 'button-evidence.js', 'diagnostics.js');
    config.content_scripts[0].js.splice(config.content_scripts[0].js.indexOf('isolation-target.js'), 0, 'outcome-trace.js');
    for (const file of diagnosticFiles) files.set(file, fs.readFileSync(path.join(root, 'testing', file)));
    html = html.replace('· Test build', '· Testing with local diagnostics')
      .replace('</aside>', '</aside>\n' + fs.readFileSync(path.join(root, 'testing', 'report-section.html'), 'utf8'))
      .replace('</style>', fs.readFileSync(path.join(root, 'testing', 'report.css'), 'utf8') + '\n</style>')
      .replace('</body>', '<script src="report-ui.js"></script>\n</body>');
  } else {
    html = html.replace(' · Test build', '')
      .replace('This build is for testing in Firefox. Try the blank area around a card\'s heading and check that the correct destination opens while the original page stays unchanged.',
        'Middle-clicking a clear match opens the card destination directly, without activating the original card.')
      .replace('</ul>\n<p>Middle-clicking a clear match', '<li><strong>Minor code cleanup.</strong> Removed unused code and kept version reporting consistent.</li>\n</ul>\n<p>Middle-clicking a clear match');
  }
  files.set('manifest.json', JSON.stringify(config, null, 2) + '\n');
  files.set('changelog.html', html);
  writeFolder(variant, files);
  archive(`force-new-tab-${manifest.version}-${variant}-unsigned.xpi`, files);
  console.log(`${variant}: ${files.size} files; dist/${variant}/manifest.json`);
}
const source = new Map();
for (const entry of fs.readdirSync(root, {withFileTypes: true})) {
  if (entry.name === 'dist' || entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
  if (entry.isSymbolicLink()) throw new Error('Source input is a symlink');
  if (entry.isDirectory() && !['icons', 'docs', 'tests', 'testing', 'tools'].includes(entry.name)) continue;
  if (entry.isFile() && !/\.(js|json|md|html|png)$/.test(entry.name) && entry.name !== 'LICENSE') continue;
  const full = path.join(root, entry.name);
  for (const file of entry.isDirectory() ? walk(full) : [full]) source.set(path.relative(root, file).split(path.sep).join('/'), fs.readFileSync(file));
}
archive(`force-new-tab-${manifest.version}-source.zip`, source);
fs.writeFileSync(path.join(dist, 'SHA256SUMS.txt'), hashes.join('\n') + '\n');
console.log('Both variants share byte-identical navigation modules. Packages are unsigned and unpublished.');
