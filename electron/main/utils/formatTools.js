export function formatTimestamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0');

  const offsetMinutes = -date.getTimezoneOffset();
  const offsetSign = offsetMinutes >= 0 ? '+' : '-';
  const offsetHours = String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(2, '0');
  const offsetRemainderMinutes = String(Math.abs(offsetMinutes) % 60).padStart(2, '0');
  const utcOffset = `UTC ${offsetSign}${offsetHours}:${offsetRemainderMinutes}`;

  const timeZoneName = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local Time';

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds} ${utcOffset} ${timeZoneName}`;
}

export function formatSnapshotFilename(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}_${hours}${minutes}${seconds}`;
}

export function filenameToTimestamp(filename) {
  const name = filename.replace(/\.md$/, '');
  const [datePart, timePart] = name.split('_');
  if (!datePart || !timePart) return NaN;
  const [y, m, d] = datePart.split('-').map(Number);
  const h = parseInt(timePart.slice(0, 2), 10);
  const min = parseInt(timePart.slice(2, 4), 10);
  const s = parseInt(timePart.slice(4, 6), 10);
  return new Date(y, m - 1, d, h, min, s).getTime();
}
