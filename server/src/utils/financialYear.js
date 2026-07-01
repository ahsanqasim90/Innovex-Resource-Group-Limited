export function financialYearFor(dateValue, startMonth = Number(process.env.FINANCIAL_YEAR_START_MONTH || 9)) {
  const date = new Date(dateValue || Date.now());
  const month = date.getUTCMonth() + 1;
  const year = date.getUTCFullYear();
  const startYear = month >= startMonth ? year : year - 1;
  return `${startYear}/${String(startYear + 1).slice(-2)}`;
}
