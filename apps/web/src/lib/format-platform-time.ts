/** Format a UTC ISO instant in the platform (or provided) IANA zone. */
export function formatPlatformDateTime(
  iso: string | null | undefined,
  locale: string,
  timeZone = 'Asia/Amman',
): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-JO' : 'en-GB', {
    timeZone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatRemainingDuration(
  iso: string | null | undefined,
  locale: string,
  now = new Date(),
): string {
  if (!iso) return '';
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return '';
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return locale === 'ar' ? 'انتهت المهلة' : 'Expired';
  const totalMinutes = Math.ceil(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (locale === 'ar') {
    if (hours > 0) return `${hours} س ${minutes} د`;
    return `${minutes} د`;
  }
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** Civil YYYY-MM-DD in Asia/Amman — never the machine time zone. */
export function todayIsoInPlatformZone(timeZone = 'Asia/Amman'): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
