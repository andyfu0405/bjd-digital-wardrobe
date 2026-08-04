export function getBalanceCountdown(dateString?: string, now = new Date()): string | null {
  if (!dateString) return null;
  const [year, month, day] = dateString.split("-").map(Number);
  if (!year || !month || !day) return null;
  const todayValue = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const dueValue = Date.UTC(year, month - 1, day);
  const days = Math.round((dueValue - todayValue) / 86400000);
  if (days > 0) return `距离补款截止还有 ${days} 天`;
  if (days === 0) return "今天截止";
  return `已逾期 ${Math.abs(days)} 天`;
}

export function changeStatusPreserving<T extends object, S extends string>(values: T, status: S): T & { status: S } {
  return { ...values, status };
}
