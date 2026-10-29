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
// Hashes verified against outputs/force-new-tab-icons-no-lines/export-verification.json.
// Compatibility aliases were independently checked against drop-in-extension.
const approvedIconHashes={
  "icons/enabled/icon-16.png": "1c7d7e23b220e2fb93b77637726df5561011a47f06800f3566658e2efe870a5d",
  "icons/enabled/icon-20.png": "c16204afc73671475cdfecbc615e87d3bb9e1e3cab83a8a7dda972ac4e158aec",
  "icons/enabled/icon-24.png": "a7146f9fbd2909ae8d33e1325b2368e210604b2b634797183d80f5f0ae838a48",
  "icons/enabled/icon-28.png": "4e6ea5f9431500f38037dfff057756edf6e9a614c5f9cae710ae270875d5f36f",
  "icons/enabled/icon-32.png": "ffc5a3f799b82d76fae26982afbf8262e75b8c77b59657183b090d3075f83e29",
  "icons/enabled/icon-40.png": "0505e452cf584b59070591969e5135c26bc24ffde0d00767e786e717042c5e27",
  "icons/enabled/icon-48.png": "8546af462e77693cc0b4f9a3c67f37725f450df018e8f8e43828654a545d9345",
  "icons/enabled/icon-56.png": "fffa95f751d17fa905292d2da542ac9562be154a8bfc7404926a3cacbbb07bce",
  "icons/enabled/icon-64.png": "b2a5307e16e4daacb4201150d1ee1ca67c5506ca4883f8f929015f4f1fb5445b",
  "icons/enabled/icon-96.png": "1bdae4d4f426173e2eb7ce1aa447c4a2fd244bf74b44a415c879ac451ccd2ffa",
  "icons/enabled/icon-128.png": "fd49bea84fa4964f8f0d03455083d1a3f42ad588e192c01edd36708ada832c39",
  "icons/disabled/icon-16.png": "b287e6597051f2ad9f767d35a3cf33bfa0ab456415fb9809bcf97613617c58b0",
  "icons/disabled/icon-20.png": "9d64c43262efb0bf322e6510e7404ad18781aec44eb1b20ec4d00aa6ef5296e4",
  "icons/disabled/icon-24.png": "555b20c57ae4cd35f23a87d8c29aae6e271c821e19603f15cf780f886d455410",
  "icons/disabled/icon-28.png": "dd1a61d74ff2408eea8516119980d80beb0788b8716bca8c928367b8ddd11d5e",
  "icons/disabled/icon-32.png": "827e4e4cb285b793d0dbd7f5bf55f6f8819349e7777687b1c3072396ae1a7c77",
  "icons/disabled/icon-40.png": "c9f78434da12795e90989a8199106027067f7509cbcd06044c7046db1ea1e285",
  "icons/disabled/icon-48.png": "5eac6602cebaeaffba59933413ba894d07b74949caee31d5d4c94157eb09f4bc",
  "icons/disabled/icon-56.png": "2d0905fd1674e854477b545249660a2ce6b6a8b81dc5d27499364eed5bb81424",
  "icons/disabled/icon-64.png": "e4867cc8ecf7a1b045d4fb8a712d99226ac98d5eccde323fe37a9eafad936ae9",
  "icons/disabled/icon-96.png": "630ddc2f596fcc7afbaf25a9eec8f4d8850b6c89c80d0d25550fa3de10eb3b2f",
  "icons/disabled/icon-128.png": "5c5eb9daa1d48053ecc3a818c341c85d631062e3cd6a9411e9f51734e51b576e",
  "icon.png": "8546af462e77693cc0b4f9a3c67f37725f450df018e8f8e43828654a545d9345",
  "icon@2x.png": "1bdae4d4f426173e2eb7ce1aa447c4a2fd244bf74b44a415c879ac451ccd2ffa",
  "icon-disabled.png": "5eac6602cebaeaffba59933413ba894d07b74949caee31d5d4c94157eb09f4bc",
  "icon-disabled@2x.png": "630ddc2f596fcc7afbaf25a9eec8f4d8850b6c89c80d0d25550fa3de10eb3b2f"
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

