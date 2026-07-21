// Formats a date as YYYY-MM-DD in the given IANA timezone, giving a
// comparable "local day" key without pulling in a date library.
function localDayKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function isSameLocalDay(isoDate: string, timeZone: string | null): boolean {
  const zone = timeZone ?? "UTC";
  return localDayKey(new Date(isoDate), zone) === localDayKey(new Date(), zone);
}

// Current local hour (0-23) in the given IANA timezone, used by the cron
// route to only generate chapters during a user's morning window.
export function getLocalHour(timeZone: string, date: Date = new Date()): number {
  const hourString = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return Number.parseInt(hourString, 10);
}
