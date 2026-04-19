import { get, ref } from "firebase/database";
import { database } from "../firebaseConfig";
import {
  getOperationCollections,
  normalizeOperations,
  OperationRow,
  toTimestamp,
} from "./operations.service";

const DEFAULT_TIMEZONE = "Asia/Damascus";
const BASELINE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

type OperationCategory =
  | "purchase"
  | "sell"
  | "payment"
  | "return"
  | "transfer"
  | "discount"
  | "other";

type AlertSeverity = "info" | "warning" | "critical";

type DailyStat = {
  operations: number;
  returns: number;
  paymentNet: number;
};

type AccountAttentionRow = {
  id: string;
  name: string;
  balance: number;
  openAmount: number;
};

type OverviewAlert = {
  code: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  metrics?: Record<string, number | string>;
};

export type TodayOverviewOptions = {
  includeRaw?: boolean;
  timezone?: string;
};

type TimestampedSlice = {
  today: Record<string, any>[];
  invalidDateCount: number;
};

const asRecord = (value: unknown): Record<string, any> =>
  value && typeof value === "object" ? (value as Record<string, any>) : {};

const asString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const toNumber = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toArray = (value: unknown): any[] => Object.values(asRecord(value));

const parseTimestampLoose = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const input = asString(value);
  if (!input) {
    return 0;
  }

  const parsed = Date.parse(input);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const toDateKey = (timestamp: number, timezone: string): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));

const average = (values: number[]) =>
  values.length
    ? values.reduce((sum, current) => sum + current, 0) / values.length
    : 0;

const toOperationCategory = (type: string): OperationCategory => {
  const normalized = asString(type);
  if (normalized === "purchase") return "purchase";
  if (normalized === "sell") return "sell";
  if (normalized.startsWith("payment:")) return "payment";
  if (normalized.includes("return")) return "return";
  if (normalized === "warehouse_transfer") return "transfer";
  if (normalized === "after_sell_discount") return "discount";
  return "other";
};

const getTimestampFromFields = (
  row: Record<string, any>,
  fields: string[]
): number => {
  for (const field of fields) {
    const rawValue = row[field];
    if (rawValue == null) {
      continue;
    }

    const parsed =
      field === "createdAt" && typeof rawValue === "number"
        ? toNumber(rawValue)
        : parseTimestampLoose(rawValue);

    if (parsed > 0) {
      return parsed;
    }
  }

  return 0;
};

const pickTodayRows = (
  rows: any[],
  dateFields: string[],
  todayDateKey: string,
  timezone: string
): TimestampedSlice => {
  let invalidDateCount = 0;
  const today: Record<string, any>[] = [];

  rows.forEach((entry) => {
    const row = asRecord(entry);
    const timestamp = getTimestampFromFields(row, dateFields);
    if (timestamp <= 0) {
      invalidDateCount += 1;
      return;
    }

    const rowDateKey = toDateKey(timestamp, timezone);
    if (rowDateKey === todayDateKey) {
      today.push(row);
    }
  });

  return { today, invalidDateCount };
};

const readCollection = async (path: string): Promise<any[]> => {
  const snapshot = await get(ref(database, path));
  return snapshot.exists() ? toArray(snapshot.val()) : [];
};

const incrementCount = (map: Map<string, number>, key: string, value = 1) => {
  if (!key) {
    return;
  }
  map.set(key, (map.get(key) || 0) + value);
};

const createCurrencyBucket = () => ({
  entries: 0,
  inflow: 0,
  outflow: 0,
  net: 0,
});

export const buildTodayOverview = async (
  options: TodayOverviewOptions = {}
) => {
  const timezone = options.timezone || DEFAULT_TIMEZONE;
  const includeRaw = Boolean(options.includeRaw);
  const generatedAt = new Date().toISOString();
  const todayDateKey = toDateKey(Date.now(), timezone);

  const [operationCollections, customersRaw, suppliersRaw] = await Promise.all([
    getOperationCollections(),
    readCollection("customer"),
    readCollection("supplier"),
  ]);

  const operations = normalizeOperations(
    operationCollections.purchases,
    operationCollections.sells,
    operationCollections.payments,
    operationCollections.returns,
    operationCollections.transfers,
    operationCollections.discounts
  );

  let invalidOperationDates = 0;
  const operationsToday: OperationRow[] = operations.filter((operation) => {
    const timestamp = toTimestamp(operation.date);
    if (timestamp <= 0) {
      invalidOperationDates += 1;
      return false;
    }
    return toDateKey(timestamp, timezone) === todayDateKey;
  });

  const purchasesSlice = pickTodayRows(
    operationCollections.purchases,
    ["date"],
    todayDateKey,
    timezone
  );
  const sellsSlice = pickTodayRows(
    operationCollections.sells,
    ["date"],
    todayDateKey,
    timezone
  );
  const paymentsSlice = pickTodayRows(
    operationCollections.payments,
    ["date"],
    todayDateKey,
    timezone
  );
  const returnsSlice = pickTodayRows(
    operationCollections.returns,
    ["createdDate", "date"],
    todayDateKey,
    timezone
  );
  const transfersSlice = pickTodayRows(
    operationCollections.transfers,
    ["createdAt", "date"],
    todayDateKey,
    timezone
  );
  const discountsSlice = pickTodayRows(
    operationCollections.discounts,
    ["date"],
    todayDateKey,
    timezone
  );

  const purchasesToday = purchasesSlice.today;
  const sellsToday = sellsSlice.today;
  const paymentsToday = paymentsSlice.today;
  const returnsToday = returnsSlice.today;
  const transfersToday = transfersSlice.today;
  const discountsToday = discountsSlice.today;

  const invalidDateRecords =
    invalidOperationDates +
    purchasesSlice.invalidDateCount +
    sellsSlice.invalidDateCount +
    paymentsSlice.invalidDateCount +
    returnsSlice.invalidDateCount +
    transfersSlice.invalidDateCount +
    discountsSlice.invalidDateCount;

  const categoryCounts: Record<OperationCategory, number> = {
    purchase: 0,
    sell: 0,
    payment: 0,
    return: 0,
    transfer: 0,
    discount: 0,
    other: 0,
  };
  const executerCounts = new Map<string, number>();
  operationsToday.forEach((operation) => {
    const category = toOperationCategory(operation.type);
    categoryCounts[category] += 1;
    incrementCount(executerCounts, asString(operation.executer) || "Unknown");
  });

  const warehouseCounts = new Map<string, number>();
  purchasesToday.forEach((row) => {
    incrementCount(warehouseCounts, asString(row.warehouse));
  });
  sellsToday.forEach((row) => {
    const products = Array.isArray(row.products) ? row.products : [];
    products.forEach((product: any) => {
      const warehouse = asString(asRecord(product).warehouse);
      incrementCount(warehouseCounts, warehouse);
    });
  });
  returnsToday.forEach((row) => {
    incrementCount(warehouseCounts, asString(row.warehouse));
  });
  transfersToday.forEach((row) => {
    incrementCount(warehouseCounts, asString(row.fromWarehouse));
    incrementCount(warehouseCounts, asString(row.toWarehouse));
  });

  let salesCashCount = 0;
  let salesPartCount = 0;
  let salesDebtCount = 0;
  let salesValueToday = 0;
  let salesValueBaseToday = 0;
  let salesRemainingDebtToday = 0;

  sellsToday.forEach((sell) => {
    const status = asString(sell.paymentStatus).toLowerCase();
    if (status === "cash") salesCashCount += 1;
    else if (status === "part") salesPartCount += 1;
    else if (status === "debt") salesDebtCount += 1;

    salesValueToday += toNumber(sell.totalPrice);
    salesValueBaseToday += toNumber(sell.amount_base);
    salesRemainingDebtToday += Math.max(0, toNumber(sell.remainingDebt));
  });

  let purchasesCashCount = 0;
  let purchasesPartCount = 0;
  let purchasesDebtCount = 0;
  let purchaseValueToday = 0;
  let purchaseValueBaseToday = 0;
  let purchasesRemainingDebtToday = 0;

  purchasesToday.forEach((purchase) => {
    const status = asString(purchase.paymentStatus).toLowerCase();
    if (status === "cash") purchasesCashCount += 1;
    else if (status === "part") purchasesPartCount += 1;
    else if (status === "debt") purchasesDebtCount += 1;

    purchaseValueToday += toNumber(purchase.totalPrice);
    purchaseValueBaseToday += toNumber(purchase.amount_base);
    purchasesRemainingDebtToday += Math.max(0, toNumber(purchase.remainingDebt));
  });

  let paymentsInflow = 0;
  let paymentsOutflow = 0;
  let paymentsInflowBase = 0;
  let paymentsOutflowBase = 0;
  let customerPaymentEntries = 0;
  let supplierPaymentEntries = 0;
  let returnPaymentsImpact = 0;
  const paymentsByCurrency: Record<
    string,
    { entries: number; inflow: number; outflow: number; net: number }
  > = {};

  paymentsToday.forEach((payment) => {
    const amount = toNumber(payment.amount);
    const amountBase = toNumber(payment.amount_base);
    const currency = asString(payment.currency) || "UNKNOWN";

    if (!paymentsByCurrency[currency]) {
      paymentsByCurrency[currency] = createCurrencyBucket();
    }

    const bucket = paymentsByCurrency[currency];
    bucket.entries += 1;

    if (amount >= 0) {
      paymentsInflow += amount;
      bucket.inflow += amount;
    } else {
      const absAmount = Math.abs(amount);
      paymentsOutflow += absAmount;
      bucket.outflow += absAmount;
    }
    bucket.net += amount;

    if (amountBase >= 0) {
      paymentsInflowBase += amountBase;
    } else {
      paymentsOutflowBase += Math.abs(amountBase);
    }

    if (payment.customerId) {
      customerPaymentEntries += 1;
    }
    if (payment.supplierId) {
      supplierPaymentEntries += 1;
    }
    if (asString(payment.type).toLowerCase() === "return") {
      returnPaymentsImpact += amount;
    }
  });

  const paymentsNet = paymentsInflow - paymentsOutflow;
  const paymentsNetBase = paymentsInflowBase - paymentsOutflowBase;

  const transferCostToday = transfersToday.reduce(
    (sum, transfer) => sum + toNumber(transfer.cost ?? transfer.amount),
    0
  );
  const returnEstimatedValue = returnsToday.reduce(
    (sum, row) => sum + toNumber(row.returnValue),
    0
  );
  const totalDiscountAmount = discountsToday.reduce((sum, discount) => {
    const rawAmount = toNumber(discount.amount);
    return sum + Math.abs(rawAmount);
  }, 0);

  const customerAttentionRows: AccountAttentionRow[] = customersRaw
    .map((entry) => asRecord(entry))
    .map((customer) => {
      const balance = toNumber(customer.balance);
      const openAmount = balance < 0 ? Math.abs(balance) : 0;
      return {
        id: asString(customer.id),
        name: asString(customer.name) || "Unknown customer",
        balance,
        openAmount,
      };
    })
    .filter((customer) => customer.openAmount > 0)
    .sort((a, b) => b.openAmount - a.openAmount);

  const supplierAttentionRows: AccountAttentionRow[] = suppliersRaw
    .map((entry) => asRecord(entry))
    .map((supplier) => {
      const balance = toNumber(supplier.balance);
      const openAmount = balance > 0 ? balance : 0;
      return {
        id: asString(supplier.id),
        name: asString(supplier.name) || "Unknown supplier",
        balance,
        openAmount,
      };
    })
    .filter((supplier) => supplier.openAmount > 0)
    .sort((a, b) => b.openAmount - a.openAmount);

  const openReceivablesTotal = customerAttentionRows.reduce(
    (sum, row) => sum + row.openAmount,
    0
  );
  const openPayablesTotal = supplierAttentionRows.reduce(
    (sum, row) => sum + row.openAmount,
    0
  );

  const dailyStats = new Map<string, DailyStat>();
  operations.forEach((operation) => {
    const timestamp = toTimestamp(operation.date);
    if (timestamp <= 0) {
      return;
    }

    const key = toDateKey(timestamp, timezone);
    if (!dailyStats.has(key)) {
      dailyStats.set(key, { operations: 0, returns: 0, paymentNet: 0 });
    }

    const stat = dailyStats.get(key)!;
    stat.operations += 1;

    const category = toOperationCategory(operation.type);
    if (category === "return") {
      stat.returns += 1;
    }
    if (category === "payment") {
      stat.paymentNet += toNumber(operation.amount);
    }
  });

  const previousDateKeys = Array.from({ length: BASELINE_DAYS }, (_, index) =>
    toDateKey(Date.now() - (index + 1) * DAY_MS, timezone)
  );

  const avgPreviousOperations = average(
    previousDateKeys.map((key) => dailyStats.get(key)?.operations || 0)
  );
  const avgPreviousReturns = average(
    previousDateKeys.map((key) => dailyStats.get(key)?.returns || 0)
  );
  const avgPreviousPaymentNet = average(
    previousDateKeys.map((key) => dailyStats.get(key)?.paymentNet || 0)
  );

  const anomalies: OverviewAlert[] = [];
  const totalInvoicesToday = sellsToday.length + purchasesToday.length;
  const debtInvoicesToday = salesDebtCount + purchasesDebtCount;
  const debtRatio = totalInvoicesToday
    ? debtInvoicesToday / totalInvoicesToday
    : 0;

  if (operationsToday.length === 0) {
    anomalies.push({
      code: "NO_ACTIVITY",
      severity: "critical",
      title: "No activity recorded today",
      detail:
        "No purchases, sales, payments, returns, transfers, or discounts were recorded for the current business day.",
    });
  }

  if (avgPreviousOperations >= 5 && operationsToday.length < avgPreviousOperations * 0.4) {
    anomalies.push({
      code: "ACTIVITY_DROP",
      severity: "warning",
      title: "Operational activity dropped vs baseline",
      detail:
        "Today activity is significantly lower than the recent 7-day average.",
      metrics: {
        todayOperations: operationsToday.length,
        baselineAverage: Number(avgPreviousOperations.toFixed(2)),
      },
    });
  }

  if (totalInvoicesToday >= 3 && debtRatio >= 0.6) {
    anomalies.push({
      code: "DEBT_HEAVY_DAY",
      severity: "warning",
      title: "Debt-heavy invoicing pattern",
      detail:
        "A high share of today invoices ended with debt status and may require follow-up.",
      metrics: {
        debtInvoices: debtInvoicesToday,
        totalInvoices: totalInvoicesToday,
        debtRatio: Number((debtRatio * 100).toFixed(2)),
      },
    });
  }

  if (
    (avgPreviousReturns > 0 &&
      returnsToday.length >= Math.max(3, Math.ceil(avgPreviousReturns * 2))) ||
    (avgPreviousReturns === 0 && returnsToday.length >= 4)
  ) {
    anomalies.push({
      code: "RETURN_SPIKE",
      severity: "warning",
      title: "Returns spiked above normal",
      detail:
        "Return activity today is significantly above the recent daily average.",
      metrics: {
        todayReturns: returnsToday.length,
        baselineAverage: Number(avgPreviousReturns.toFixed(2)),
      },
    });
  }

  if (avgPreviousPaymentNet > 0 && paymentsNet < avgPreviousPaymentNet * 0.4) {
    anomalies.push({
      code: "CASHFLOW_DROP",
      severity: "warning",
      title: "Net cashflow dropped vs baseline",
      detail:
        "Today net payment flow is well below the recent 7-day average trend.",
      metrics: {
        todayNet: Number(paymentsNet.toFixed(2)),
        baselineAverage: Number(avgPreviousPaymentNet.toFixed(2)),
      },
    });
  }

  const topCustomer = customerAttentionRows[0];
  if (
    topCustomer &&
    openReceivablesTotal > 0 &&
    topCustomer.openAmount / openReceivablesTotal >= 0.5
  ) {
    anomalies.push({
      code: "RECEIVABLE_CONCENTRATION",
      severity: "warning",
      title: "Receivables concentrated on one customer",
      detail:
        "One customer now represents at least half of all open receivables.",
      metrics: {
        customer: topCustomer.name,
        sharePercent: Number(
          ((topCustomer.openAmount / openReceivablesTotal) * 100).toFixed(2)
        ),
      },
    });
  }

  if (invalidDateRecords > 0) {
    anomalies.push({
      code: "DATA_QUALITY_DATES",
      severity: "info",
      title: "Some records have invalid dates",
      detail:
        "Some records were excluded from day-based calculations due to missing or unparseable dates.",
      metrics: { affectedRecords: invalidDateRecords },
    });
  }

  const topExecutersToday = Array.from(executerCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([executer, operationsCount]) => ({ executer, operationsCount }));

  const topWarehousesToday = Array.from(warehouseCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([warehouse, activityCount]) => ({ warehouse, activityCount }));

  const highlights: string[] = [];
  if (operationsToday.length > 0) {
    highlights.push(
      `${operationsToday.length} operations were recorded today across ${warehouseCounts.size} active warehouses.`
    );
    highlights.push(
      `Sales totaled ${salesValueToday.toFixed(2)} while purchases totaled ${purchaseValueToday.toFixed(2)}.`
    );
    highlights.push(
      `Net payment flow for today is ${paymentsNet.toFixed(2)} (${paymentsInflow.toFixed(
        2
      )} in / ${paymentsOutflow.toFixed(2)} out).`
    );
    if (topExecutersToday[0]) {
      highlights.push(
        `Top executer today: ${topExecutersToday[0].executer} with ${topExecutersToday[0].operationsCount} operations.`
      );
    }
  } else {
    highlights.push("No operational activity has been recorded for today yet.");
  }

  const recommendedActions: string[] = [];
  if (debtInvoicesToday > 0) {
    recommendedActions.push(
      "Follow up debt-based invoices created today and confirm expected collection/payment dates."
    );
  }
  if (customerAttentionRows.length > 0) {
    recommendedActions.push(
      "Prioritize receivables follow-up with the top outstanding customers."
    );
  }
  if (supplierAttentionRows.length > 0) {
    recommendedActions.push(
      "Review supplier payables and schedule the next payment batch to avoid pressure on supply."
    );
  }
  if (anomalies.some((anomaly) => anomaly.code === "RETURN_SPIKE")) {
    recommendedActions.push(
      "Audit today return operations by reason and product to identify potential quality or handling issues."
    );
  }
  if (operationsToday.length === 0) {
    recommendedActions.push(
      "Verify branch/system data-entry pipelines if business activity happened but no records are visible."
    );
  }
  if (!recommendedActions.length) {
    recommendedActions.push(
      "No urgent issues detected; continue monitoring debt and cashflow trends."
    );
  }

  const todayOperationSampleLimit = includeRaw ? 100 : 20;

  const response = {
    meta: {
      generatedAt,
      timezone,
      todayDate: todayDateKey,
      includeRaw,
      baselineDays: BASELINE_DAYS,
      dataQuality: {
        invalidDateRecords,
        notes:
          invalidDateRecords > 0
            ? [
                "Records with missing/unparseable dates are excluded from day-based metrics.",
              ]
            : [],
      },
    },
    operationalTotals: {
      totalOperationsToday: operationsToday.length,
      operationsByCategory: categoryCounts,
      activeExecuters: executerCounts.size,
      activeWarehouses: warehouseCounts.size,
      invoicesToday: {
        sells: sellsToday.length,
        purchases: purchasesToday.length,
      },
      returnsRecorded: returnsToday.length,
      paymentsRecorded: paymentsToday.length,
      transferOperations: transfersToday.length,
      discountOperations: discountsToday.length,
    },
    completedToday: {
      sales: {
        totalInvoices: sellsToday.length,
        cashInvoices: salesCashCount,
        partialInvoices: salesPartCount,
        debtInvoices: salesDebtCount,
        valueTotal: Number(salesValueToday.toFixed(2)),
      },
      purchases: {
        totalInvoices: purchasesToday.length,
        cashInvoices: purchasesCashCount,
        partialInvoices: purchasesPartCount,
        debtInvoices: purchasesDebtCount,
        valueTotal: Number(purchaseValueToday.toFixed(2)),
      },
      collections: {
        customerPaymentEntries,
        supplierPaymentEntries,
        incomingPayments: Number(paymentsInflow.toFixed(2)),
        outgoingPayments: Number(paymentsOutflow.toFixed(2)),
        netPayments: Number(paymentsNet.toFixed(2)),
      },
    },
    pendingAndBacklog: {
      todayOpenDebt: {
        sales: Number(salesRemainingDebtToday.toFixed(2)),
        purchases: Number(purchasesRemainingDebtToday.toFixed(2)),
      },
      receivables: {
        total: Number(openReceivablesTotal.toFixed(2)),
        customersWithOpenBalance: customerAttentionRows.length,
        topCustomers: customerAttentionRows.slice(0, 5),
      },
      payables: {
        total: Number(openPayablesTotal.toFixed(2)),
        suppliersWithOpenBalance: supplierAttentionRows.length,
        topSuppliers: supplierAttentionRows.slice(0, 5),
      },
    },
    financialActivity: {
      payments: {
        inflow: Number(paymentsInflow.toFixed(2)),
        outflow: Number(paymentsOutflow.toFixed(2)),
        net: Number(paymentsNet.toFixed(2)),
        inflowBase: Number(paymentsInflowBase.toFixed(2)),
        outflowBase: Number(paymentsOutflowBase.toFixed(2)),
        netBase: Number(paymentsNetBase.toFixed(2)),
        byCurrency: paymentsByCurrency,
      },
      sales: {
        invoiceCount: sellsToday.length,
        total: Number(salesValueToday.toFixed(2)),
        totalBase: Number(salesValueBaseToday.toFixed(2)),
      },
      purchases: {
        invoiceCount: purchasesToday.length,
        total: Number(purchaseValueToday.toFixed(2)),
        totalBase: Number(purchaseValueBaseToday.toFixed(2)),
      },
      returns: {
        count: returnsToday.length,
        estimatedValue: Number(returnEstimatedValue.toFixed(2)),
        paymentImpact: Number(returnPaymentsImpact.toFixed(2)),
      },
      transfers: {
        count: transfersToday.length,
        transferCost: Number(transferCostToday.toFixed(2)),
      },
      discounts: {
        count: discountsToday.length,
        totalDiscountAmount: Number(totalDiscountAmount.toFixed(2)),
      },
    },
    anomalies,
    highlights,
    recommendedActions,
    supportingData: {
      topExecutersToday,
      topWarehousesToday,
      operationSample: operationsToday.slice(0, todayOperationSampleLimit),
      raw: includeRaw
        ? {
            operationsToday,
            purchasesToday,
            sellsToday,
            paymentsToday,
            returnsToday,
            transfersToday,
            discountsToday,
          }
        : undefined,
    },
  };

  return response;
};
