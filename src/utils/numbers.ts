import Decimal from "decimal.js";

// Half-way values round away from zero, consistently for both signs.
const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export const decimal = (value: Decimal.Value = 0) => new D(value);
export function roundNumber(value: Decimal.Value): number {
  const rounded = decimal(value).toDecimalPlaces(2).toNumber();
  if (!Number.isFinite(rounded)) throw new Error("Invalid numeric value");
  return rounded === 0 ? 0 : rounded;
}
export function formatNumber(
  value: Decimal.Value | null | undefined,
  locale = "en-US",
): string {
  if (value == null || value === "") return "0";
  return roundNumber(value).toLocaleString(locale, {
    maximumFractionDigits: 2,
  });
}

// Explicit domain fields only: identifiers, telephone numbers and dates are untouched.
const numericFields = new Set([
  "amount_from",
  "amount_to",
  "amount_final",
  "realRate",
  "quantity",
  "qty",
  "payPrice",
  "sellPrice",
  "totalPrice",
  "discount",
  "remainingDebt",
  "partValue",
  "balance",
  "amount",
  "amount_base",
  "exchangeRate",
  "newSellPrice",
  "discountValue",
  "transferCost",
  "returnValue",
  "cost",
  "stockBefore",
  "stockAfter",
]);
export function normalizeNumbers<T>(value: T, key = ""): T {
  if (
    numericFields.has(key) &&
    (typeof value === "number" ||
      (typeof value === "string" && value.trim() !== ""))
  ) {
    return roundNumber(value) as T;
  }
  if (Array.isArray(value))
    return value.map((item) => normalizeNumbers(item)) as T;
  if (
    value &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return Object.fromEntries(
      Object.entries(value).map(([field, item]) => [
        field,
        normalizeNumbers(item, field.split("/").pop() || ""),
      ]),
    ) as T;
  }
  return value;
}

export function formatNumericField<T>(value: T, key: string): T | string {
  if (
    ["id", "code", "number", "phone", "timestamp"].includes(key) ||
    /(?:Id|Date|At)$/.test(key)
  )
    return value;
  if (
    typeof value === "number" ||
    (numericFields.has(key) &&
      typeof value === "string" &&
      value.trim() !== "" &&
      Number.isFinite(Number(value)))
  ) {
    return formatNumber(value as number | string);
  }
  return value;
}

export function normalizeInvoice<
  T extends {
    totalPrice: number;
    remainingDebt: number;
    paymentStatus: string;
    exchangeRate: number;
    amount_base: number;
    currency?: string;
    partValue?: number;
    discount?: number;
  },
>(input: T, total: Decimal.Value): T {
  const invoice = normalizeNumbers(input);
  const paid =
    invoice.paymentStatus === "cash"
      ? roundNumber(total)
      : invoice.paymentStatus === "debt"
        ? 0
        : invoice.partValue != null
          ? roundNumber(
              invoice.currency === "USD"
                ? invoice.partValue
                : decimal(invoice.partValue).div(invoice.exchangeRate),
            )
          : roundNumber(decimal(input.totalPrice).minus(input.remainingDebt));
  invoice.totalPrice = roundNumber(total);
  invoice.remainingDebt = roundNumber(decimal(invoice.totalPrice).minus(paid));
  invoice.amount_base = roundNumber(
    decimal(invoice.totalPrice).times(invoice.exchangeRate),
  );
  return invoice;
}
