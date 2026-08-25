/**
 * Phase 10B.1 — timezone + weekly rule math (no DB).
 * Uses luxon with an explicit IANA zone; must not depend on the host TZ.
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../packages/shared/package.json'),
);
const { DateTime } = require('luxon');

let passed = 0;
let failed = 0;

function pass(name) {
  passed++;
  console.log(`  ✅ ${name}`);
}
function fail(name, detail) {
  failed++;
  console.log(`  ❌ ${name}: ${detail}`);
}

const TIME_HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function parseHhMm(value) {
  const m = TIME_HHMM_RE.exec(value.trim());
  if (!m) return null;
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

function weekdaySundayZeroInZone(isoDate, zone) {
  const dt = DateTime.fromISO(isoDate, { zone });
  return dt.weekday === 7 ? 0 : dt.weekday;
}

function localRangeToUtc({ dateIso, startTime, endTime, overnight, zone }) {
  const start = parseHhMm(startTime);
  const end = parseHhMm(endTime);
  const startLocal = DateTime.fromISO(dateIso, { zone }).set({
    hour: start.hour,
    minute: start.minute,
    second: 0,
    millisecond: 0,
  });
  let endLocal = DateTime.fromISO(dateIso, { zone }).set({
    hour: end.hour,
    minute: end.minute,
    second: 0,
    millisecond: 0,
  });
  const wrap = overnight && endLocal <= startLocal;
  if (wrap) endLocal = endLocal.plus({ days: 1 });
  return {
    startAt: startLocal.toUTC().toJSDate(),
    endAt: endLocal.toUTC().toJSDate(),
    endsNextDay: wrap,
  };
}

function validateTimes(period, startTime, endTime) {
  const start = parseHhMm(startTime);
  const end = parseHhMm(endTime);
  if (!start || !end) return false;
  const startMin = start.hour * 60 + start.minute;
  const endMin = end.hour * 60 + end.minute;
  if (period !== 'overnight' && endMin <= startMin) return false;
  return true;
}

function subtractHoursUtc(instant, hours) {
  return new Date(instant.getTime() - hours * 60 * 60 * 1000);
}

console.log('\n🧮 Phase 10B.1 availability math QA\n');

if (!validateTimes('morning', '09:00', '13:00')) fail('morning 09-13 valid', 'rejected');
else pass('weekly rule: morning 09:00-13:00 is valid');

if (validateTimes('morning', '13:00', '09:00')) fail('morning wrap rejected', 'accepted');
else pass('weekly rule: non-overnight wrap is rejected');

if (!validateTimes('overnight', '20:00', '10:00')) fail('overnight wrap valid', 'rejected');
else pass('weekly rule: overnight 20:00-10:00 is valid');

if (validateTimes('evening', '25:00', '22:00')) fail('invalid HH:mm rejected', 'accepted');
else pass('weekly rule: invalid HH:mm is rejected');

const zone = 'Asia/Amman';
const morning = localRangeToUtc({
  dateIso: '2026-11-15',
  startTime: '09:00',
  endTime: '13:00',
  overnight: false,
  zone,
});
if (
  morning.startAt.toISOString() === '2026-11-15T06:00:00.000Z' &&
  morning.endAt.toISOString() === '2026-11-15T10:00:00.000Z'
) {
  pass('Asia/Amman 09:00-13:00 → 06:00-10:00 UTC');
} else {
  fail('Amman morning UTC', `${morning.startAt.toISOString()} ${morning.endAt.toISOString()}`);
}

const prevTz = process.env.TZ;
process.env.TZ = 'America/Los_Angeles';
const morning2 = localRangeToUtc({
  dateIso: '2026-11-15',
  startTime: '09:00',
  endTime: '13:00',
  overnight: false,
  zone,
});
if (morning2.startAt.toISOString() === morning.startAt.toISOString()) {
  pass('conversion independent of machine TZ (America/Los_Angeles)');
} else {
  fail('machine TZ independence', morning2.startAt.toISOString());
}
process.env.TZ = 'UTC';
const morning3 = localRangeToUtc({
  dateIso: '2026-11-15',
  startTime: '09:00',
  endTime: '13:00',
  overnight: false,
  zone,
});
if (morning3.startAt.toISOString() === morning.startAt.toISOString()) {
  pass('conversion independent of machine TZ (UTC)');
} else {
  fail('machine TZ UTC independence', morning3.startAt.toISOString());
}
if (prevTz === undefined) delete process.env.TZ;
else process.env.TZ = prevTz;

const overnight = localRangeToUtc({
  dateIso: '2026-11-15',
  startTime: '20:00',
  endTime: '10:00',
  overnight: true,
  zone,
});
if (
  overnight.endsNextDay &&
  overnight.startAt.toISOString() === '2026-11-15T17:00:00.000Z' &&
  overnight.endAt.toISOString() === '2026-11-16T07:00:00.000Z'
) {
  pass('overnight 20:00-10:00 ends next local day in UTC');
} else {
  fail(
    'overnight next day',
    `${overnight.endsNextDay} ${overnight.startAt.toISOString()} ${overnight.endAt.toISOString()}`,
  );
}

if (weekdaySundayZeroInZone('2026-11-15', zone) === 0) {
  pass('2026-11-15 is Sunday=0 in Asia/Amman');
} else {
  fail('weekday Sunday', String(weekdaySundayZeroInZone('2026-11-15', zone)));
}

const start = new Date('2026-11-15T06:00:00.000Z');
const due0 = subtractHoursUtc(start, 0);
if (due0.toISOString() === start.toISOString()) {
  pass('BALANCE_DUE_HOURS_BEFORE_START=0 uses exact start instant');
} else {
  fail('hours=0', due0.toISOString());
}
const due24 = subtractHoursUtc(start, 24);
if (due24.toISOString() === '2026-11-14T06:00:00.000Z') {
  pass('balanceDueAt is 24h before real start (UTC math)');
} else {
  fail('hours=24', due24.toISOString());
}

const overlap = (aS, aE, bS, bE) => aS < bE && aE > bS;
const fdStart = new Date('2026-11-15T05:00:00.000Z');
const fdEnd = new Date('2026-11-15T17:00:00.000Z');
if (overlap(morning.startAt, morning.endAt, fdStart, fdEnd)) {
  pass('full-day interval overlaps morning');
} else fail('full-day vs morning overlap', 'no overlap');

const eve = localRangeToUtc({
  dateIso: '2026-11-15',
  startTime: '16:00',
  endTime: '22:00',
  overnight: false,
  zone,
});
if (!overlap(morning.startAt, morning.endAt, eve.startAt, eve.endAt)) {
  pass('non-overlapping morning and evening do not conflict');
} else fail('morning vs evening', 'unexpected overlap');

const nextMorning = localRangeToUtc({
  dateIso: '2026-11-16',
  startTime: '09:00',
  endTime: '13:00',
  overnight: false,
  zone,
});
if (overlap(overnight.startAt, overnight.endAt, nextMorning.startAt, nextMorning.endAt)) {
  pass('overnight overlaps next-day morning');
} else fail('overnight vs next morning', 'no overlap');

const ar = DateTime.fromISO('2026-11-15T06:00:00.000Z').setZone(zone).setLocale('ar').toFormat('HH:mm');
const en = DateTime.fromISO('2026-11-15T06:00:00.000Z').setZone(zone).setLocale('en').toFormat('HH:mm');
if (ar === '09:00' && en === '09:00') pass('Arabic and English format 09:00 in Asia/Amman');
else fail('i18n time format', `${ar} ${en}`);

console.log(`\n📊 ${passed} passed, ${failed} failed\n`);
if (failed) process.exit(1);
