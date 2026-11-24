export function formatMoney(amount, currencyLocale = 'India') {
  const currency =
    currencyLocale === 'United States'
      ? 'USD'
      : currencyLocale === 'United Arab Emirates'
        ? 'AED'
        : 'INR';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(Number(amount) || 0);
  } catch {
    return `₹${Number(amount) || 0}`;
  }
}

export function formatDate(value, timeZone = 'Asia/Kolkata') {
  if (!value) return '-';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(value));
  } catch {
    return new Date(value).toLocaleDateString();
  }
}
