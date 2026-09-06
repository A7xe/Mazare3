const fs = require('fs');
const path = require('path');

function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(css|js)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

const root = path.join(__dirname, '..', '.next');
if (!fs.existsSync(root)) {
  console.log('NO_NEXT_DIR');
  process.exit(0);
}

const files = walk(root);
let hitCount = 0;
for (const f of files) {
  let t;
  try {
    t = fs.readFileSync(f, 'utf8');
  } catch {
    continue;
  }
  if (!/Cairo|font-cairo|font-heading/.test(t)) continue;
  hitCount++;
  console.log('\nFILE', f);
  console.log('font-heading:', (t.match(/\.font-heading\{[^}]+\}/g) || []).slice(0, 3));
  console.log('font-cairo vars:', (t.match(/--font-cairo:[^;]+;/g) || []).slice(0, 5));
  const faces = [...t.matchAll(/@font-face\{[^}]+\}/g)].map((m) => m[0]);
  const cairoFaces = faces.filter((x) => /Cairo/i.test(x));
  console.log('Cairo @font-face count', cairoFaces.length);
  for (const face of cairoFaces.slice(0, 8)) console.log(face.slice(0, 500));
  console.log(
    'font-family Cairo snippets:',
    (t.match(/font-family:[^;]*Cairo[^;]*;/gi) || []).slice(0, 8),
  );
}
console.log('\nHIT_FILES', hitCount);
