'use strict';
// Self-contained3.0.3 migration fingerprints. Historical per-site contracts are
// retained under archive-3.x; none are counted as current passing behavior.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8').replace(/^\uFEFF/,'');
const normalize=value=>value.replace(/\r\n/g,'\n').trimEnd();
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const manifest=JSON.parse(read('manifest.json'));
// Historical 3.0.3 fingerprints remain unchanged. Current icons are checked
// separately against the approved export-verification.json and drop-in pack.
const baselineHashes={
  "icon.png": "b68a8b1d23e9a0038a361fca6fe66b6de06611d9b70aeca8ed79f8386ee1d5ec",
  "icon@2x.png": "507201ced7c84627c69118d9a3781d22f6826f240811ae3a55978ebb24597559",
  "icon-disabled.png": "424e0e8d15537e37e5c7e07c838bce239bb4e7c9de9c574c99cfb35ed0a5fe77",
  "icon-disabled@2x.png": "b984d43389ed6bab4047bbff060f71a722e36e170624795f2b34d62a1b13ae3c",
  "LICENSE": "3f226a3cda638e56262a7d30e751615628dda35f03c13d71f130d88d22c4ed7d",
  "tests/run.cjs": "d499a704113376e7a0039076a1c1cb4d53eb7e914799ce6e76a2ee96c54c1d1e",
  "tests/discovery.cjs": "0d1be513c557536e2ac24e2a2d495b1aab4a2acc9610b193c99bb9f02eefd6bd",
  "tests/reddit-images.cjs": "4795b60b405f85c768589ac04c4b734e61d7a4ef7466497b45bcdfccac12e192",
  "tests/site-adapters.cjs": "d76dd3d4e09fe61d768e7eb8df620841c59285dd053ea5f1c15cd3515100f2ca",
  "tests/spotify-auth.cjs": "21baf34cf55e56a518338c6502c305ce3c5f9dfcdb5da9f69bc434a54cf911c9",
  "tests/legacy-regressions.cjs": "102845bff6013bc212c5ad52de8281a5c551d4332fdb84d230a16216c5fa9c1d"
};
// 4.2.6 intentionally replaces only the icon fields of this historical wiring.
const toolbarIconPaths=state=>Object.fromEntries([16,20,24,28,32,40,48,56,64,96,128].map(size=>[size,`icons/${state}/icon-${size}.png`]));
const manifestIconPaths=Object.fromEntries([32,48,64,96,128].map(size=>[size,`icons/enabled/icon-${size}.png`]));
// Hashes verified against outputs/force-new-tab-mozilla-icons/export-verification.json.
// Compatibility aliases were independently checked against drop-in-4.2.5.
const approvedIconHashes={
  "icons/enabled/icon-16.png": "471004070e569089779f66699d0811818f2bdbc7197a9f0478eca3485e66e69c",
  "icons/enabled/icon-20.png": "190001c7b495274e5b7f9272d9020c8f07060cb348770ee6c6e1ecbbdeb2aa0f",
  "icons/enabled/icon-24.png": "2b6d64cac0bf54bb3741c17b1538708e6c49508a49b44280d4e07a0a61454839",
  "icons/enabled/icon-28.png": "ca2fb7f9a5b274a21682dce6a2beb0ab317f8e7e6e0761bac1d841483c747662",
  "icons/enabled/icon-32.png": "f88a2fa2170811961941f4d9b797c6f7554d2ca993069e72c7bd0747d0dd1c0c",
  "icons/enabled/icon-40.png": "289da9078014d9e8b796363e8f97aebe671a656488905e18eb96a407adb30fba",
  "icons/enabled/icon-48.png": "7e201c4780919a2d58432a6592d6f427e8482cd4464a0095f8786bf301053cdb",
  "icons/enabled/icon-56.png": "f892692643ce6943a75f29a8fa7d4f5b64a7926ca49b25b2c168d1b34cdc4c99",
  "icons/enabled/icon-64.png": "a93665fed9f8d9c4ef655501e4aa6a5e524790ef4ebb1401911b8ad31b8265cc",
  "icons/enabled/icon-96.png": "68b5c6ab405e58c1fe526e3cb7275e14db778b56cd7e6b8dd5c6ba09302b9be6",
  "icons/enabled/icon-128.png": "96a5a6bb230d24b4fbad6dca00f814e768026cdb60ca4a04afdc50ae599ed84c",
  "icons/disabled/icon-16.png": "ada92574ca5a106c4973a0bb682ce6c42c8e8c7a19557cfff2f0586ad88ec7bb",
  "icons/disabled/icon-20.png": "14479d5cd64e1fc4f1e328e4dd9fa04b068ce67f990d7d3ed49e07c8501ab12a",
  "icons/disabled/icon-24.png": "69ebfecb09f88510d18fb8cf8b4bd95e77dc1906ff14f323cd2c8d4d9d82602a",
  "icons/disabled/icon-28.png": "2a701c76a583c5f1714bf4303644ad0a680ca11fde93dc7cafd8d7ae205f56ea",
  "icons/disabled/icon-32.png": "ed4b90d68743826e6b9e4c807d5e16a6f17e71f9f589699e9fccc4b5b50fa51f",
  "icons/disabled/icon-40.png": "e384ad979f2d307e0ea70b9fa58d5371f06b99cc06f69f32ab895a26807e75a3",
  "icons/disabled/icon-48.png": "af78313830570f63339feee09c9cc3b5b683f725520c939642b28f3fcc1af4b1",
  "icons/disabled/icon-56.png": "f2e0c6c218585639e9f2390483570df095e6c710258fcf174855383bcc029491",
  "icons/disabled/icon-64.png": "39f42b3127aac338a48dd281b4fc7c71e2c09761877ed6d55273d0badd7aa5a5",
  "icons/disabled/icon-96.png": "e8d0baa3a8d9a14040c880c13a5ff80581bb0cafe695c0525f39e7eaea38a1c6",
  "icons/disabled/icon-128.png": "de56fdc7c73cf80669faf4414e2ab7e848ff1a7d2116ee4f1e59c3e409466d71",
  "icon.png": "7e201c4780919a2d58432a6592d6f427e8482cd4464a0095f8786bf301053cdb",
  "icon@2x.png": "68b5c6ab405e58c1fe526e3cb7275e14db778b56cd7e6b8dd5c6ba09302b9be6",
  "icon-disabled.png": "af78313830570f63339feee09c9cc3b5b683f725520c939642b28f3fcc1af4b1",
  "icon-disabled@2x.png": "e8d0baa3a8d9a14040c880c13a5ff80581bb0cafe695c0525f39e7eaea38a1c6"
};
const preservedManifest={
  "permissions": [
    "cookies",
    "storage",
    "webNavigation"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "scripts": [
      "discovery.js",
      "background.js"
    ]
  },
  "content_scripts": [
    {
      "matches": [
        "<all_urls>"
      ],
      "js": [
        "resolver.js",
        "content.js"
      ],
      "run_at": "document_start",
      "all_frames": true,
      "match_about_blank": true
    }
  ],
  "icons": {
    "48": "icon.png",
    "96": "icon@2x.png"
  },
  "action": {
    "default_icon": {
      "48": "icon.png",
      "96": "icon@2x.png"
    },
    "default_title": "Force New Tab: ON"
  },
  "options_ui": {
    "open_in_tab": true,
    "page": "changelog.html"
  }
};
const backgroundHash="cd59d7d95570026b1cc288d556d7ffa9d4d211161c75d453c374f6fc264fda71";
function historical(file){
  const archived=path.join('tests','archive-3.x',file);
  return fs.existsSync(path.join(root,archived))?archived:path.join('tests',file);
}
let count=0;
function check(name,fn){fn();count++;console.log('PASS migration audit',name);}
check('loaded runtime has no provider names, fixed provider destinations, site test IDs or provider path matchers',()=>{
 const files=[...manifest.background.scripts,...manifest.content_scripts.flatMap(s=>s.js)];
 const forbidden=/spotify|bluesky|bsky\.app|reddit\.com|redd\.it|questrade|myportal|app-new-account-button|feedItem-by|postThreadItem-by|card-title-spotify/i;
 for(const file of files)assert.equal(forbidden.test(read(file)),false,file+' contains a site-specific marker');
 const resolver=read('resolver.js');
 assert.equal(/\.(?:hostname|host)\b/.test(resolver),false,'generic resolver must not gate on hostname');
 assert.equal(/data-testid|data-encore-id/.test(resolver),false,'component identity must use generic semantics');
});
check('approved icons replace historical assets while license permissions and manifest wiring stay preserved',()=>{
 for(const [file,expected]of Object.entries(approvedIconHashes))
   assert.equal(hash(fs.readFileSync(path.join(root,file))),expected,file+' approved icon');
 assert.equal(hash(fs.readFileSync(path.join(root,'LICENSE'))),baselineHashes.LICENSE,'LICENSE');
 const wiring=JSON.parse(JSON.stringify(manifest));
 assert.deepEqual(wiring.icons,manifestIconPaths,'approved listing icon sizes');
 assert.deepEqual(wiring.action.default_icon,toolbarIconPaths('enabled'),'approved toolbar default sizes');
 // Restore only approved icon fields before comparing the historical wiring.
 wiring.icons=preservedManifest.icons;
 wiring.action.default_icon=preservedManifest.action.default_icon;
 assert.deepEqual(wiring.background.scripts,['discovery.js','background.js','diagnostic-background.js','isolation-target.js','isolation-background.js']);
 assert.deepEqual(wiring.content_scripts[0].js,['inspection.js','button-evidence.js','diagnostics.js','resolver.js','component-link.js','app-data.js','outcome-trace.js','isolation-target.js','isolation-content.js','content.js']);
 wiring.background.scripts.splice(-2,2);
 wiring.content_scripts[0].js.splice(wiring.content_scripts[0].js.indexOf('isolation-target.js'),2);
 wiring.background.scripts.pop();
 wiring.content_scripts[0].js.splice(wiring.content_scripts[0].js.indexOf('button-evidence.js'),1);
 wiring.content_scripts[0].js.splice(wiring.content_scripts[0].js.indexOf('outcome-trace.js'),1);
 wiring.content_scripts[0].js.shift();
 wiring.content_scripts[0].js.shift();
 wiring.content_scripts[0].js.splice(1,2);
 for(const [key,value]of Object.entries(preservedManifest))assert.deepEqual(wiring[key],value,key);
 assert.ok(parseFloat(manifest.browser_specific_settings.gecko.strict_min_version)>=147,'native Navigation API needs Firefox147+');
});
check('background preserves routing storage and changelog apart from owned capture and approved icon mapping',()=>{
 let restored=normalize(read('background.js'));
 // Only the two approved icon literals may differ from the navigation baseline.
 for(const [approved,legacy]of [["{16: \"icons/enabled/icon-16.png\", 20: \"icons/enabled/icon-20.png\", 24: \"icons/enabled/icon-24.png\", 28: \"icons/enabled/icon-28.png\", 32: \"icons/enabled/icon-32.png\", 40: \"icons/enabled/icon-40.png\", 48: \"icons/enabled/icon-48.png\", 56: \"icons/enabled/icon-56.png\", 64: \"icons/enabled/icon-64.png\", 96: \"icons/enabled/icon-96.png\", 128: \"icons/enabled/icon-128.png\"}", "{48: \"icon.png\", 96: \"icon@2x.png\"}"],
["{16: \"icons/disabled/icon-16.png\", 20: \"icons/disabled/icon-20.png\", 24: \"icons/disabled/icon-24.png\", 28: \"icons/disabled/icon-28.png\", 32: \"icons/disabled/icon-32.png\", 40: \"icons/disabled/icon-40.png\", 48: \"icons/disabled/icon-48.png\", 56: \"icons/disabled/icon-56.png\", 64: \"icons/disabled/icon-64.png\", 96: \"icons/disabled/icon-96.png\", 128: \"icons/disabled/icon-128.png\"}", "{48: \"icon-disabled.png\", 96: \"icon-disabled@2x.png\"}"]]){
   assert.equal(restored.split(approved).length,2,'one exact approved icon literal');
   restored=restored.replace(approved,legacy);
 }
 const stripped=restored.replace(/^  if \(message\?\.type === "fnt-captured"\).*?\n/m,'');
 assert.equal(hash(stripped),backgroundHash);
});
check('original historical test files remain byte-identical',()=>{
 for(const file of ['run.cjs','discovery.cjs','reddit-images.cjs','site-adapters.cjs','spotify-auth.cjs','legacy-regressions.cjs']){
   const relative=historical(file);
   assert.equal(hash(fs.readFileSync(path.join(root,relative))),baselineHashes['tests/'+file],relative);
 }
});
check('core-suite migration changes only the obsolete raw-image fixture and approved icon expectations',()=>{
 let text=read('tests/core-regressions.cjs');
 text=text.replace('// 4.2.6: approved icon paths replace the historical 48/96 pair; toggle guards remain.\n','');
 text=text.replace("const toolbarIconPaths = state => Object.fromEntries([16,20,24,28,32,40,48,56,64,96,128].map(size => [size, `icons/${state}/icon-${size}.png`]));\n",'');
 text=text.replaceAll("toolbarIconPaths('enabled')","{48: 'icon.png', 96: 'icon@2x.png'}");
 text=text.replaceAll("toolbarIconPaths('disabled')","{48: 'icon-disabled.png', 96: 'icon-disabled@2x.png'}");
 text=text.replace(/^\/\/ Migrated core suite:[\s\S]*?\/\/ are retained from3\.0\.3; original run\.cjs is kept unchanged for reference\.\n/,'');
 text=text.replace('unknown plain button retains discovery fallback','unknown control arms discovery without guessing image URLs');
 text=text.replace("const target = el('button', {type: 'button'});","const target = el('img', {src: '/media'});");
 assert.equal(normalize(text),normalize(read(historical('run.cjs'))));
});
console.log(count+' migration audit checks passed.');
console.log('Superseded contracts: per-host image exclusion, provider-specific card recognition, fixed authentication endpoint lookup, and raw-image forced discovery. Archived tests are not counted as current passing tests.');

