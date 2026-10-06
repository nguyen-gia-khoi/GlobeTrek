function formatRevenueAxis(value) {
  const amount = Math.round(Number(value) || 0);
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);

  const compact = (n, digits) => n.toLocaleString('vi-VN', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });

  if (abs >= 1000000000) return `${sign}${compact(abs / 1000000000, 1)} tỷ`;
  if (abs >= 1000000) return `${sign}${compact(abs / 1000000, 1)} tr`;
  if (abs >= 1000) return `${sign}${compact(abs / 1000, 0)} nghìn`;
  return amount.toLocaleString('vi-VN');
}
