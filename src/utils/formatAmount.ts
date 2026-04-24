export function formatTokenAmount(value: string | null | undefined, decimals = 4): string {
  if (!value) {
    return "Unavailable";
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return value;
  }

  if (numericValue === 0) {
    return "0";
  }

  if (numericValue >= 1) {
    return numericValue.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    });
  }

  return numericValue
    .toFixed(decimals)
    .replace(/\.?0+$/, "");
}
