const { chromium } = require('C:/Users/acer/OneDrive/Desktop/Mzar3/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright');

async function main() {
  const url =
    process.argv[2] || 'http://localhost:3000/ar/properties/chalet-emerald-dead-sea';
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(45000);

  const resp = await page.goto(url, { waitUntil: 'networkidle' });
  console.log('STATUS', resp && resp.status());

  await page.evaluate(async () => {
    try {
      await document.fonts.load('850 32px Cairo');
      await document.fonts.load('400 16px Cairo');
      await document.fonts.ready;
    } catch {}
  });
  await page.waitForTimeout(500);

  const report = await page.evaluate(() => {
    const h1 = document.querySelector('h1');
    if (!h1) return { error: 'NO_H1', title: document.title, bodySample: document.body?.innerText?.slice(0, 200) };

    const cs = getComputedStyle(h1);
    const bodyCs = getComputedStyle(document.body);

    const fonts = [];
    try {
      document.fonts.forEach((f) => {
        fonts.push({
          family: f.family,
          weight: f.weight,
          style: f.style,
          status: f.status,
        });
      });
    } catch {}

    let used = null;
    if (document.fonts && document.fonts.check) {
      used = {
        cairo850: document.fonts.check('850 32px Cairo'),
        cairo700: document.fonts.check('700 32px Cairo'),
        cairo400: document.fonts.check('400 32px Cairo'),
      };
    }

    const probe = document.createElement('div');
    probe.textContent = 'شاليه إيميرالد';
    probe.style.cssText =
      'position:fixed;left:-9999px;top:0;font-family:var(--font-cairo),Cairo,system-ui,sans-serif;font-size:28px;font-weight:850;font-style:normal;line-height:normal;';
    document.body.appendChild(probe);
    const pcs = getComputedStyle(probe);

    const bodyCairo = getComputedStyle(document.body).getPropertyValue('--font-cairo').trim();

    // Canvas-based glyph width heuristic: Cairo vs system at same size/weight
    function measure(family, text) {
      const c = document.createElement('canvas').getContext('2d');
      c.font = `850 32px ${family}`;
      return c.measureText(text).width;
    }
    const sample = 'شاليه إيميرالد';
    const widthCairo = measure('Cairo', sample);
    const widthSystem = measure('sans-serif', sample);
    const widthComputedFamily = measure(cs.fontFamily, sample);

    return {
      h1: {
        text: h1.textContent?.trim(),
        className: h1.className,
        hasFontHeading: h1.classList.contains('font-heading'),
        fontFamily: cs.fontFamily,
        fontWeight: cs.fontWeight,
        fontSize: cs.fontSize,
        fontStyle: cs.fontStyle,
        fontStretch: cs.fontStretch,
        fontVariationSettings: cs.fontVariationSettings,
        lineHeight: cs.lineHeight,
      },
      body: {
        fontFamily: bodyCs.fontFamily,
        fontWeight: bodyCs.fontWeight,
        fontCairoVar: bodyCairo,
      },
      fontsLoadedSample: fonts.filter((f) => /Cairo/i.test(f.family)),
      fontsCheck: used,
      probe28x850: {
        fontFamily: pcs.fontFamily,
        fontWeight: pcs.fontWeight,
        fontSize: pcs.fontSize,
        fontStyle: pcs.fontStyle,
        fontVariationSettings: pcs.fontVariationSettings,
      },
      glyphWidths: {
        sample,
        widthCairo,
        widthSystem,
        widthComputedFamily,
        matchesCairo: Math.abs(widthCairo - widthComputedFamily) < 0.5,
      },
    };
  });

  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}

main().catch((e) => {
  console.error('ERR', e);
  process.exit(1);
});
