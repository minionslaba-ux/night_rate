// Fails if any inline script of the game uses syntax newer than ES2018 (old WebViews on Honor/Huawei, old Android, iOS 12).
const fs = require('fs'), acorn = require('acorn');
const html = fs.readFileSync(process.argv[2], 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
let bad = 0;
for (const [i, code] of scripts.entries()) {
  try { acorn.parse(code, { ecmaVersion: 2018, sourceType: 'script' }); }
  catch (e) { bad++; const ln = code.split('\n')[e.loc.line - 1] || ''; console.log(`script ${i}: ${e.message}\n  ${ln.trim().slice(0, 160)}`); }
}
console.log(bad ? `legacy check: FAILED in ${bad} script(s)` : `legacy check: ok — ${scripts.length} scripts are ES2018`);
process.exit(bad ? 1 : 0);
