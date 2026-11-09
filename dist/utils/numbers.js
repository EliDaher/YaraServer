"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decimal = void 0;
exports.roundNumber = roundNumber;
exports.formatNumber = formatNumber;
exports.normalizeNumbers = normalizeNumbers;
exports.formatNumericField = formatNumericField;
exports.normalizeInvoice = normalizeInvoice;
const decimal_js_1 = __importDefault(require("decimal.js"));
// Half-way values round away from zero, consistently for both signs.
const D = decimal_js_1.default.clone({ precision: 40, rounding: decimal_js_1.default.ROUND_HALF_UP });
const decimal = (value = 0) => new D(value);
exports.decimal = decimal;
function roundNumber(value) {
    const rounded = (0, exports.decimal)(value).toDecimalPlaces(2).toNumber();
    if (!Number.isFinite(rounded))
        throw new Error("Invalid numeric value");
    return rounded === 0 ? 0 : rounded;
}
function formatNumber(value, locale = "en-US") {
    if (value == null || value === "")
        return "0";
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
function normalizeNumbers(value, key = "") {
    if (numericFields.has(key) &&
        (typeof value === "number" ||
            (typeof value === "string" && value.trim() !== ""))) {
        return roundNumber(value);
    }
    if (Array.isArray(value))
        return value.map((item) => normalizeNumbers(item));
    if (value &&
        typeof value === "object" &&
        Object.getPrototypeOf(value) === Object.prototype) {
        return Object.fromEntries(Object.entries(value).map(([field, item]) => [
            field,
            normalizeNumbers(item, field.split("/").pop() || ""),
        ]));
    }
    return value;
}
function formatNumericField(value, key) {
    if (["id", "code", "number", "phone", "timestamp"].includes(key) ||
        /(?:Id|Date|At)$/.test(key))
        return value;
    if (typeof value === "number" ||
        (numericFields.has(key) &&
            typeof value === "string" &&
            value.trim() !== "" &&
            Number.isFinite(Number(value)))) {
        return formatNumber(value);
    }
    return value;
}
function normalizeInvoice(input, total) {
    const invoice = normalizeNumbers(input);
    const paid = invoice.paymentStatus === "cash"
        ? roundNumber(total)
        : invoice.paymentStatus === "debt"
            ? 0
            : invoice.partValue != null
                ? roundNumber(invoice.currency === "USD"
                    ? invoice.partValue
                    : (0, exports.decimal)(invoice.partValue).div(invoice.exchangeRate))
                : roundNumber((0, exports.decimal)(input.totalPrice).minus(input.remainingDebt));
    invoice.totalPrice = roundNumber(total);
    invoice.remainingDebt = roundNumber((0, exports.decimal)(invoice.totalPrice).minus(paid));
    invoice.amount_base = roundNumber((0, exports.decimal)(invoice.totalPrice).times(invoice.exchangeRate));
    return invoice;
}
