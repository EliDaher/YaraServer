const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const resolveOperationDate = (value?: string): string => {
  const rawValue = typeof value === "string" ? value.trim() : "";

  if (!rawValue) {
    return new Date().toLocaleString();
  }

  let operationDate: Date;

  if (DATE_ONLY_PATTERN.test(rawValue)) {
    const [year, month, day] = rawValue.split("-").map(Number);
    const now = new Date();

    operationDate = new Date(
      year,
      month - 1,
      day,
      now.getHours(),
      now.getMinutes(),
      now.getSeconds(),
      now.getMilliseconds()
    );

    const isSameDate =
      operationDate.getFullYear() === year &&
      operationDate.getMonth() === month - 1 &&
      operationDate.getDate() === day;

    if (!isSameDate) {
      throw new Error("Invalid operation date");
    }

    return operationDate.toLocaleString();
  }

  operationDate = new Date(rawValue);

  if (Number.isNaN(operationDate.getTime())) {
    throw new Error("Invalid operation date");
  }

  return operationDate.toLocaleString();
};
