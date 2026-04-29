export function formatDate(
  timestamp: number,
  locale: string,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  },
): string {
  return new Date(timestamp).toLocaleDateString(locale, options);
}
