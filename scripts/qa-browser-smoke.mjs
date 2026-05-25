/**
 * Phase 3D — smoke test pages + booking flow (API + HTML)
 */
const WEB = process.env.WEB_BASE ?? 'http://localhost:3000';
const API = process.env.API_BASE ?? 'http://localhost:4000/api/v1';

const PAGES = [
  '/ar',
  '/en',
  '/ar/search',
  '/en/search',
  '/ar/search?verifiedOnly=true&sort=price_asc',
  '/ar/properties/chalet-emerald-dead-sea',
  '/en/properties/chalet-emerald-dead-sea',
  '/ar/account/bookings',
  '/ar/login',
  '/ar/owner',
  '/en/owner',
  '/en/owner/bookings',
  '/en/owner/availability',
];

async function main() {
  console.log('=== Phase 3D browser smoke ===\n');
  let ok = 0;
  let fail = 0;

  for (const path of PAGES) {
    try {
      const res = await fetch(`${WEB}${path}`, { redirect: 'follow' });
      const html = await res.text();
      if (res.status !== 200) {
        console.log(`❌ ${path} → ${res.status}`);
        fail++;
        continue;
      }
      const bad = [];
      if (html.includes('exactAddress')) bad.push('exactAddress leaked');
      if (html.includes('ownerPhone') || html.includes('whatsapp')) bad.push('sensitive');
      if (path.includes('properties/') && html.includes('comingSoon')) bad.push('comingSoon on property');
      if (bad.length) {
        console.log(`⚠️  ${path} → ${bad.join(', ')}`);
      } else {
        console.log(`✅ ${path}`);
      }
      ok++;
    } catch (e) {
      console.log(`❌ ${path} → ${e.message}`);
      fail++;
    }
  }

  let cookie = '';
  const login = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'customer@mazare3.jo', password: 'Mazare3Demo2026!' }),
  });
  cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
  const me = await fetch(`${API}/auth/me`, { headers: { Cookie: cookie } });
  console.log(me.status === 200 ? '✅ auth/me with cookie' : `❌ auth/me ${me.status}`);

  console.log(`\nPages: ${ok} ok, ${fail} failed`);
  if (fail) process.exit(1);
}

main();
