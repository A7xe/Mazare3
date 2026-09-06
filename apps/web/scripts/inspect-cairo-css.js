const fs = require('fs');
const path = require('path');

function walk(d, acc = []) {
  if (!fs.existsSync(d)) return acc;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

const root = path.join(__dirname, '..', '.next');
const cssFiles = walk(root).filter((f) => f.endsWith('.css'));
const media = walk(path.join(root, 'static', 'media')).filter((f) =>
  /\.(woff2?|ttf|otf)$/i.test(f),
);

console.log('CSS files', cssFiles.length);
console.log('Media fonts', media.slice(0, 40).map((f) => path.basename(f)));

for (const f of cssFiles) {
  const t = fs.readFileSync(f, 'utf8');
  if (!/font-heading|font-cairo|@font-face|Cairo_/.test(t)) continue;
  console.log('\nCSS', f);
  console.log('heading', t.match(/\.font-heading\{[^}]+\}/g));
  console.log('cairo var', t.match(/--font-cairo:[^;]+;/g));
  const faces = [...t.matchAll(/@font-face\{[^}]+\}/g)].map((m) => m[0]);
  console.log('all faces', faces.length);
  for (const face of faces.slice(0, 12)) {
    console.log('---');
    console.log(face);
  }
  // next font variable class usually like .__className_xx { font-family: ... }
  const fam = t.match(/font-family:[^;}{]+/g) || [];
  console.log(
    'families sample',
    fam.filter((x) => /Cairo|var\(--font/i.test(x)).slice(0, 20),
  );
}
