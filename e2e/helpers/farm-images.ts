/** Diverse Unsplash covers — only URLs verified HTTP 200. */
export const QA_FARM_IMAGES = [
  'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80',
  'https://images.unsplash.com/photo-1602343168117-bb8ffe3e2e9f?w=1200&q=80',
  'https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=1200&q=80',
  'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1200&q=80',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80',
  'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&q=80',
  'https://images.unsplash.com/photo-1449844908441-8829872d2607?w=1200&q=80',
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200&q=80',
  'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=1200&q=80',
  'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200&q=80',
  'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200&q=80',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80',
  'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=1200&q=80',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80',
  'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&q=80',
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80',
  'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1200&q=80',
  'https://images.unsplash.com/photo-1600047509358-9dc75507daeb?w=1200&q=80',
  'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=1200&q=80',
] as const;

let imageCursor = 0;

/** Returns 2 unique URLs; cover is rotated so consecutive creates look different. */
export function nextQaFarmImages(seed?: string | number): string[] {
  let idx: number;
  if (seed === undefined) {
    idx = imageCursor % QA_FARM_IMAGES.length;
    imageCursor += 1;
  } else if (typeof seed === 'number') {
    idx = Math.abs(seed) % QA_FARM_IMAGES.length;
  } else {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    idx = h % QA_FARM_IMAGES.length;
  }
  const cover = QA_FARM_IMAGES[idx]!;
  const extra = QA_FARM_IMAGES[(idx + 5) % QA_FARM_IMAGES.length]!;
  return [cover, extra];
}
