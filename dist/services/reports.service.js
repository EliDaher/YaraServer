"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTodayOverview = void 0;
const database_1 = require("firebase/database");
const firebaseConfig_1 = require("../firebaseConfig");
const DEFAULT_TIMEZONE = "Asia/Damascus";
const BASELINE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const RAW_COLLECTION_LIMIT = 400;
const RAW_OPERATION_LIMIT = 800;
const asRecord = (value) => value && typeof value === "object" ? value : {};
const asString = (value) => typeof value === "string" ? value.trim() : "";
const toNumber = (value) => {
    const parsed = Number(value !== null && value !== void 0 ? value : 0);
    return Number.isFinite(parsed) ? parsed : 0;
};
const parseTimestampLoose = (value) => {
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
const toDateKey = (timestamp, timezone) => new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
}).format(new Date(timestamp));
const toOperationDateString = (value, fallbackTimestamp) => {
    if (typeof value === "number") {
        const asDate = new Date(value);
        return Number.isNaN(asDate.getTime())
            ? new Date(fallbackTimestamp).toISOString()
            : asDate.toISOString();
    }
    const asText = asString(value);
    return asText || new Date(fallbackTimestamp).toISOString();
};
const average = (values) => values.length
    ? values.reduce((sum, current) => sum + current, 0) / values.length
    : 0;
const normalizeExecuter = (row) => asString(row.executer) || asString(row.performedBy) || "Unknown";
const incrementCount = (map, key, value = 1) => {
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
const pushTopAccount = (topAccounts, row, limit = 5) => {
    topAccounts.push(row);
    topAccounts.sort((a, b) => b.openAmount - a.openAmount);
    if (topAccounts.length > limit) {
        topAccounts.length = limit;
    }
};
const pushCapped = (list, value, limit, onTruncated) => {
    if (list.length < limit) {
        list.push(value);
        return;
    }
    onTruncated();
};
const pushRecentSample = (buffer, item, maxItems) => {
    if (buffer.length < maxItems) {
        buffer.push(item);
        return;
    }
    let minIndex = 0;
    for (let i = 1; i < buffer.length; i += 1) {
        if (buffer[i]._timestamp < buffer[minIndex]._timestamp) {
            minIndex = i;
        }
    }
    if (item._timestamp > buffer[minIndex]._timestamp) {
        buffer[minIndex] = item;
    }
};
const ensureDailyStat = (map, dateKey) => {
    if (!map.has(dateKey)) {
        map.set(dateKey, { operations: 0, returns: 0, paymentNet: 0 });
    }
    return map.get(dateKey);
};
const processSnapshotRows = (path, rowHandler) => __awaiter(void 0, void 0, void 0, function* () {
    const snapshot = yield (0, database_1.get)((0, database_1.ref)(firebaseConfig_1.database, path));
    if (!snapshot.exists()) {
        return;
    }
    snapshot.forEach((child) => {
        rowHandler(asRecord(child.val()), child.key || "");
        return false;
    });
});
const buildTodayOverview = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (options = {}) {
    const timezone = options.timezone || DEFAULT_TIMEZONE;
    const includeRaw = Boolean(options.includeRaw);
    const generatedAt = new Date().toISOString();
    const nowTimestamp = Date.now();
    const todayDateKey = toDateKey(nowTimestamp, timezone);
    let invalidDateRecords = 0;
    let operationsTodayCount = 0;
    const categoryCounts = {
        purchase: 0,
        sell: 0,
        payment: 0,
        return: 0,
        transfer: 0,
        discount: 0,
        other: 0,
    };
    const executerCounts = new Map();
    const warehouseCounts = new Map();
    const dailyStats = new Map();
    let sellsTodayCount = 0;
    let salesCashCount = 0;
    let salesPartCount = 0;
    let salesDebtCount = 0;
    let salesValueToday = 0;
    let salesValueBaseToday = 0;
    let salesRemainingDebtToday = 0;
    let purchasesTodayCount = 0;
    let purchasesCashCount = 0;
    let purchasesPartCount = 0;
    let purchasesDebtCount = 0;
    let purchaseValueToday = 0;
    let purchaseValueBaseToday = 0;
    let purchasesRemainingDebtToday = 0;
    let paymentsTodayCount = 0;
    let paymentsInflow = 0;
    let paymentsOutflow = 0;
    let paymentsInflowBase = 0;
    let paymentsOutflowBase = 0;
    let customerPaymentEntries = 0;
    let supplierPaymentEntries = 0;
    let returnPaymentsImpact = 0;
    const paymentsByCurrency = {};
    let returnsTodayCount = 0;
    let returnEstimatedValue = 0;
    let transfersTodayCount = 0;
    let transferCostToday = 0;
    let discountsTodayCount = 0;
    let totalDiscountAmount = 0;
    let openReceivablesTotal = 0;
    let openPayablesTotal = 0;
    let customersWithOpenBalance = 0;
    let suppliersWithOpenBalance = 0;
    const topCustomers = [];
    const topSuppliers = [];
    const sampleBufferLimit = includeRaw ? 300 : 120;
    const sampleOperationBuffer = [];
    const rawBuckets = includeRaw
        ? {
            operationsToday: [],
            purchasesToday: [],
            sellsToday: [],
            paymentsToday: [],
            returnsToday: [],
            transfersToday: [],
            discountsToday: [],
        }
        : null;
    const rawTruncated = includeRaw
        ? {
            operationsToday: false,
            purchasesToday: false,
            sellsToday: false,
            paymentsToday: false,
            returnsToday: false,
            transfersToday: false,
            discountsToday: false,
        }
        : null;
    const registerDailyOperation = (dateKey, category, paymentNetImpact = 0) => {
        const stat = ensureDailyStat(dailyStats, dateKey);
        stat.operations += 1;
        if (category === "return") {
            stat.returns += 1;
        }
        if (category === "payment") {
            stat.paymentNet += paymentNetImpact;
        }
    };
    const registerTodayOperation = (category, row, timestamp, warehouses = []) => {
        operationsTodayCount += 1;
        categoryCounts[category] += 1;
        incrementCount(executerCounts, row.executer || "Unknown");
        warehouses.forEach((warehouse) => incrementCount(warehouseCounts, warehouse));
        pushRecentSample(sampleOperationBuffer, Object.assign(Object.assign({}, row), { _timestamp: timestamp }), sampleBufferLimit);
        if (rawBuckets && rawTruncated) {
            pushCapped(rawBuckets.operationsToday, row, RAW_OPERATION_LIMIT, () => (rawTruncated.operationsToday = true));
        }
    };
    yield processSnapshotRows("purchases", (row, key) => {
        const timestamp = parseTimestampLoose(row.date);
        if (timestamp <= 0) {
            invalidDateRecords += 1;
            return;
        }
        const dateKey = toDateKey(timestamp, timezone);
        registerDailyOperation(dateKey, "purchase");
        if (dateKey !== todayDateKey) {
            return;
        }
        purchasesTodayCount += 1;
        const warehouse = asString(row.warehouse);
        const executer = normalizeExecuter(row);
        const amount = toNumber(row.totalPrice);
        const currency = asString(row.currency);
        const referenceId = asString(row.id) || asString(row.referenceId) || key || "-";
        const status = asString(row.paymentStatus).toLowerCase();
        if (status === "cash")
            purchasesCashCount += 1;
        else if (status === "part")
            purchasesPartCount += 1;
        else if (status === "debt")
            purchasesDebtCount += 1;
        purchaseValueToday += amount;
        purchaseValueBaseToday += toNumber(row.amount_base);
        purchasesRemainingDebtToday += Math.max(0, toNumber(row.remainingDebt));
        registerTodayOperation("purchase", {
            id: referenceId,
            type: "purchase",
            executer,
            date: toOperationDateString(row.date, timestamp),
            referenceId,
            amount,
            currency,
            details: asString(row.name) ||
                asString(row.code) ||
                `Purchase supplier:${asString(row.supplierId)}`,
        }, timestamp, warehouse ? [warehouse] : []);
        if (rawBuckets && rawTruncated) {
            pushCapped(rawBuckets.purchasesToday, row, RAW_COLLECTION_LIMIT, () => (rawTruncated.purchasesToday = true));
        }
    });
    yield processSnapshotRows("sells", (row, key) => {
        const timestamp = parseTimestampLoose(row.date);
        if (timestamp <= 0) {
            invalidDateRecords += 1;
            return;
        }
        const dateKey = toDateKey(timestamp, timezone);
        registerDailyOperation(dateKey, "sell");
        if (dateKey !== todayDateKey) {
            return;
        }
        sellsTodayCount += 1;
        const executer = normalizeExecuter(row);
        const amount = toNumber(row.totalPrice);
        const currency = asString(row.currency);
        const referenceId = asString(row.id) || asString(row.referenceId) || key || "-";
        const status = asString(row.paymentStatus).toLowerCase();
        const productWarehouses = [];
        const products = Array.isArray(row.products) ? row.products : [];
        products.forEach((product) => {
            const warehouse = asString(asRecord(product).warehouse);
            if (warehouse) {
                productWarehouses.push(warehouse);
            }
        });
        if (status === "cash")
            salesCashCount += 1;
        else if (status === "part")
            salesPartCount += 1;
        else if (status === "debt")
            salesDebtCount += 1;
        salesValueToday += amount;
        salesValueBaseToday += toNumber(row.amount_base);
        salesRemainingDebtToday += Math.max(0, toNumber(row.remainingDebt));
        registerTodayOperation("sell", {
            id: referenceId,
            type: "sell",
            executer,
            date: toOperationDateString(row.date, timestamp),
            referenceId,
            amount,
            currency,
            details: `Sell customer:${asString(row.customerId)}`,
        }, timestamp, productWarehouses);
        if (rawBuckets && rawTruncated) {
            pushCapped(rawBuckets.sellsToday, row, RAW_COLLECTION_LIMIT, () => (rawTruncated.sellsToday = true));
        }
    });
    yield processSnapshotRows("payment", (row, key) => {
        const timestamp = parseTimestampLoose(row.date);
        if (timestamp <= 0) {
            invalidDateRecords += 1;
            return;
        }
        const dateKey = toDateKey(timestamp, timezone);
        const amount = toNumber(row.amount);
        registerDailyOperation(dateKey, "payment", amount);
        if (dateKey !== todayDateKey) {
            return;
        }
        paymentsTodayCount += 1;
        const executer = normalizeExecuter(row);
        const currency = asString(row.currency) || "UNKNOWN";
        const referenceId = asString(row.id) || asString(row.referenceId) || key || "-";
        if (!paymentsByCurrency[currency]) {
            paymentsByCurrency[currency] = createCurrencyBucket();
        }
        const currencyBucket = paymentsByCurrency[currency];
        currencyBucket.entries += 1;
        if (amount >= 0) {
            paymentsInflow += amount;
            currencyBucket.inflow += amount;
        }
        else {
            const absAmount = Math.abs(amount);
            paymentsOutflow += absAmount;
            currencyBucket.outflow += absAmount;
        }
        currencyBucket.net += amount;
        const amountBase = toNumber(row.amount_base);
        if (amountBase >= 0) {
            paymentsInflowBase += amountBase;
        }
        else {
            paymentsOutflowBase += Math.abs(amountBase);
        }
        if (row.customerId) {
            customerPaymentEntries += 1;
        }
        if (row.supplierId) {
            supplierPaymentEntries += 1;
        }
        if (asString(row.type).toLowerCase() === "return") {
            returnPaymentsImpact += amount;
        }
        registerTodayOperation("payment", {
            id: referenceId,
            type: `payment:${asString(row.type) || "entry"}`,
            executer,
            date: toOperationDateString(row.date, timestamp),
            referenceId,
            amount,
            currency,
            details: asString(row.note) || "Payment operation",
        }, timestamp);
        if (rawBuckets && rawTruncated) {
            pushCapped(rawBuckets.paymentsToday, row, RAW_COLLECTION_LIMIT, () => (rawTruncated.paymentsToday = true));
        }
    });
    yield processSnapshotRows("returns", (row, key) => {
        const timestamp = parseTimestampLoose(row.createdDate) || parseTimestampLoose(row.date);
        if (timestamp <= 0) {
            invalidDateRecords += 1;
            return;
        }
        const dateKey = toDateKey(timestamp, timezone);
        registerDailyOperation(dateKey, "return");
        if (dateKey !== todayDateKey) {
            return;
        }
        returnsTodayCount += 1;
        returnEstimatedValue += toNumber(row.returnValue);
        const warehouse = asString(row.warehouse);
        const executer = normalizeExecuter(row);
        const referenceId = asString(row.id) || asString(row.referenceId) || key || "-";
        const amount = toNumber(row.returnValue);
        registerTodayOperation("return", {
            id: referenceId,
            type: asString(row.type) || "return",
            executer,
            date: toOperationDateString(row.createdDate || row.date, timestamp),
            referenceId,
            amount,
            currency: asString(row.currency),
            details: `${asString(row.productCode) || "item"} qty:${toNumber(row.qty)}`,
        }, timestamp, warehouse ? [warehouse] : []);
        if (rawBuckets && rawTruncated) {
            pushCapped(rawBuckets.returnsToday, row, RAW_COLLECTION_LIMIT, () => (rawTruncated.returnsToday = true));
        }
    });
    yield processSnapshotRows("warehouseTransfers", (row, key) => {
        var _a, _b;
        const timestamp = (typeof row.createdAt === "number" ? toNumber(row.createdAt) : 0) ||
            parseTimestampLoose(row.date);
        if (timestamp <= 0) {
            invalidDateRecords += 1;
            return;
        }
        const dateKey = toDateKey(timestamp, timezone);
        registerDailyOperation(dateKey, "transfer");
        if (dateKey !== todayDateKey) {
            return;
        }
        transfersTodayCount += 1;
        transferCostToday += toNumber((_a = row.cost) !== null && _a !== void 0 ? _a : row.amount);
        const executer = normalizeExecuter(row);
        const referenceId = asString(row.transferId) || asString(row.referenceId) || key || "-";
        const fromWarehouse = asString(row.fromWarehouse);
        const toWarehouse = asString(row.toWarehouse);
        registerTodayOperation("transfer", {
            id: referenceId,
            type: "warehouse_transfer",
            executer,
            date: toOperationDateString(row.createdAt || row.date, timestamp),
            referenceId,
            amount: toNumber((_b = row.cost) !== null && _b !== void 0 ? _b : row.amount),
            currency: asString(row.currency),
            details: `${asString(row.productName)} ${fromWarehouse} -> ${toWarehouse}`.trim(),
        }, timestamp, [fromWarehouse, toWarehouse].filter(Boolean));
        if (rawBuckets && rawTruncated) {
            pushCapped(rawBuckets.transfersToday, row, RAW_COLLECTION_LIMIT, () => (rawTruncated.transfersToday = true));
        }
    });
    yield processSnapshotRows("discountOperations", (row, key) => {
        const timestamp = parseTimestampLoose(row.date);
        if (timestamp <= 0) {
            invalidDateRecords += 1;
            return;
        }
        const dateKey = toDateKey(timestamp, timezone);
        registerDailyOperation(dateKey, "discount");
        if (dateKey !== todayDateKey) {
            return;
        }
        discountsTodayCount += 1;
        totalDiscountAmount += Math.abs(toNumber(row.amount));
        const executer = normalizeExecuter(row);
        const referenceId = asString(row.referenceId) || asString(row.id) || key || "-";
        registerTodayOperation("discount", {
            id: asString(row.id) || referenceId,
            type: "after_sell_discount",
            executer,
            date: toOperationDateString(row.date, timestamp),
            referenceId,
            amount: toNumber(row.amount),
            currency: asString(row.currency),
            details: asString(row.details) ||
                `After-sell discount for sell ${asString(row.referenceId)}`,
        }, timestamp);
        if (rawBuckets && rawTruncated) {
            pushCapped(rawBuckets.discountsToday, row, RAW_COLLECTION_LIMIT, () => (rawTruncated.discountsToday = true));
        }
    });
    yield processSnapshotRows("customer", (row) => {
        const balance = toNumber(row.balance);
        const openAmount = balance < 0 ? Math.abs(balance) : 0;
        if (openAmount <= 0) {
            return;
        }
        openReceivablesTotal += openAmount;
        customersWithOpenBalance += 1;
        pushTopAccount(topCustomers, {
            id: asString(row.id),
            name: asString(row.name) || "Unknown customer",
            balance,
            openAmount,
        });
    });
    yield processSnapshotRows("supplier", (row) => {
        const balance = toNumber(row.balance);
        const openAmount = balance > 0 ? balance : 0;
        if (openAmount <= 0) {
            return;
        }
        openPayablesTotal += openAmount;
        suppliersWithOpenBalance += 1;
        pushTopAccount(topSuppliers, {
            id: asString(row.id),
            name: asString(row.name) || "Unknown supplier",
            balance,
            openAmount,
        });
    });
    const previousDateKeys = Array.from({ length: BASELINE_DAYS }, (_, index) => toDateKey(nowTimestamp - (index + 1) * DAY_MS, timezone));
    const avgPreviousOperations = average(previousDateKeys.map((key) => { var _a; return ((_a = dailyStats.get(key)) === null || _a === void 0 ? void 0 : _a.operations) || 0; }));
    const avgPreviousReturns = average(previousDateKeys.map((key) => { var _a; return ((_a = dailyStats.get(key)) === null || _a === void 0 ? void 0 : _a.returns) || 0; }));
    const avgPreviousPaymentNet = average(previousDateKeys.map((key) => { var _a; return ((_a = dailyStats.get(key)) === null || _a === void 0 ? void 0 : _a.paymentNet) || 0; }));
    const paymentsNet = paymentsInflow - paymentsOutflow;
    const paymentsNetBase = paymentsInflowBase - paymentsOutflowBase;
    const anomalies = [];
    const totalInvoicesToday = sellsTodayCount + purchasesTodayCount;
    const debtInvoicesToday = salesDebtCount + purchasesDebtCount;
    const debtRatio = totalInvoicesToday
        ? debtInvoicesToday / totalInvoicesToday
        : 0;
    if (operationsTodayCount === 0) {
        anomalies.push({
            code: "NO_ACTIVITY",
            severity: "critical",
            title: "No activity recorded today",
            detail: "No purchases, sales, payments, returns, transfers, or discounts were recorded for the current business day.",
        });
    }
    if (avgPreviousOperations >= 5 && operationsTodayCount < avgPreviousOperations * 0.4) {
        anomalies.push({
            code: "ACTIVITY_DROP",
            severity: "warning",
            title: "Operational activity dropped vs baseline",
            detail: "Today activity is significantly lower than the recent 7-day average.",
            metrics: {
                todayOperations: operationsTodayCount,
                baselineAverage: Number(avgPreviousOperations.toFixed(2)),
            },
        });
    }
    if (totalInvoicesToday >= 3 && debtRatio >= 0.6) {
        anomalies.push({
            code: "DEBT_HEAVY_DAY",
            severity: "warning",
            title: "Debt-heavy invoicing pattern",
            detail: "A high share of today invoices ended with debt status and may require follow-up.",
            metrics: {
                debtInvoices: debtInvoicesToday,
                totalInvoices: totalInvoicesToday,
                debtRatio: Number((debtRatio * 100).toFixed(2)),
            },
        });
    }
    if ((avgPreviousReturns > 0 &&
        returnsTodayCount >= Math.max(3, Math.ceil(avgPreviousReturns * 2))) ||
        (avgPreviousReturns === 0 && returnsTodayCount >= 4)) {
        anomalies.push({
            code: "RETURN_SPIKE",
            severity: "warning",
            title: "Returns spiked above normal",
            detail: "Return activity today is significantly above the recent daily average.",
            metrics: {
                todayReturns: returnsTodayCount,
                baselineAverage: Number(avgPreviousReturns.toFixed(2)),
            },
        });
    }
    if (avgPreviousPaymentNet > 0 && paymentsNet < avgPreviousPaymentNet * 0.4) {
        anomalies.push({
            code: "CASHFLOW_DROP",
            severity: "warning",
            title: "Net cashflow dropped vs baseline",
            detail: "Today net payment flow is well below the recent 7-day average trend.",
            metrics: {
                todayNet: Number(paymentsNet.toFixed(2)),
                baselineAverage: Number(avgPreviousPaymentNet.toFixed(2)),
            },
        });
    }
    const topCustomer = topCustomers[0];
    if (topCustomer &&
        openReceivablesTotal > 0 &&
        topCustomer.openAmount / openReceivablesTotal >= 0.5) {
        anomalies.push({
            code: "RECEIVABLE_CONCENTRATION",
            severity: "warning",
            title: "Receivables concentrated on one customer",
            detail: "One customer now represents at least half of all open receivables.",
            metrics: {
                customer: topCustomer.name,
                sharePercent: Number(((topCustomer.openAmount / openReceivablesTotal) * 100).toFixed(2)),
            },
        });
    }
    if (invalidDateRecords > 0) {
        anomalies.push({
            code: "DATA_QUALITY_DATES",
            severity: "info",
            title: "Some records have invalid dates",
            detail: "Some records were excluded from day-based calculations due to missing or unparseable dates.",
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
    const operationSample = sampleOperationBuffer
        .sort((a, b) => b._timestamp - a._timestamp)
        .slice(0, includeRaw ? 100 : 20)
        .map((_a) => {
        var { _timestamp } = _a, row = __rest(_a, ["_timestamp"]);
        return row;
    });
    const highlights = [];
    if (operationsTodayCount > 0) {
        highlights.push(`${operationsTodayCount} operations were recorded today across ${warehouseCounts.size} active warehouses.`);
        highlights.push(`Sales totaled ${salesValueToday.toFixed(2)} while purchases totaled ${purchaseValueToday.toFixed(2)}.`);
        highlights.push(`Net payment flow for today is ${paymentsNet.toFixed(2)} (${paymentsInflow.toFixed(2)} in / ${paymentsOutflow.toFixed(2)} out).`);
        if (topExecutersToday[0]) {
            highlights.push(`Top executer today: ${topExecutersToday[0].executer} with ${topExecutersToday[0].operationsCount} operations.`);
        }
    }
    else {
        highlights.push("No operational activity has been recorded for today yet.");
    }
    const recommendedActions = [];
    if (debtInvoicesToday > 0) {
        recommendedActions.push("Follow up debt-based invoices created today and confirm expected collection/payment dates.");
    }
    if (customersWithOpenBalance > 0) {
        recommendedActions.push("Prioritize receivables follow-up with the top outstanding customers.");
    }
    if (suppliersWithOpenBalance > 0) {
        recommendedActions.push("Review supplier payables and schedule the next payment batch to avoid pressure on supply.");
    }
    if (anomalies.some((anomaly) => anomaly.code === "RETURN_SPIKE")) {
        recommendedActions.push("Audit today return operations by reason and product to identify potential quality or handling issues.");
    }
    if (operationsTodayCount === 0) {
        recommendedActions.push("Verify branch/system data-entry pipelines if business activity happened but no records are visible.");
    }
    if (!recommendedActions.length) {
        recommendedActions.push("No urgent issues detected; continue monitoring debt and cashflow trends.");
    }
    return {
        meta: {
            generatedAt,
            timezone,
            todayDate: todayDateKey,
            includeRaw,
            baselineDays: BASELINE_DAYS,
            dataQuality: {
                invalidDateRecords,
                notes: invalidDateRecords > 0
                    ? [
                        "Records with missing/unparseable dates are excluded from day-based metrics.",
                    ]
                    : [],
            },
        },
        operationalTotals: {
            totalOperationsToday: operationsTodayCount,
            operationsByCategory: categoryCounts,
            activeExecuters: executerCounts.size,
            activeWarehouses: warehouseCounts.size,
            invoicesToday: {
                sells: sellsTodayCount,
                purchases: purchasesTodayCount,
            },
            returnsRecorded: returnsTodayCount,
            paymentsRecorded: paymentsTodayCount,
            transferOperations: transfersTodayCount,
            discountOperations: discountsTodayCount,
        },
        completedToday: {
            sales: {
                totalInvoices: sellsTodayCount,
                cashInvoices: salesCashCount,
                partialInvoices: salesPartCount,
                debtInvoices: salesDebtCount,
                valueTotal: Number(salesValueToday.toFixed(2)),
            },
            purchases: {
                totalInvoices: purchasesTodayCount,
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
                customersWithOpenBalance,
                topCustomers,
            },
            payables: {
                total: Number(openPayablesTotal.toFixed(2)),
                suppliersWithOpenBalance,
                topSuppliers,
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
                invoiceCount: sellsTodayCount,
                total: Number(salesValueToday.toFixed(2)),
                totalBase: Number(salesValueBaseToday.toFixed(2)),
            },
            purchases: {
                invoiceCount: purchasesTodayCount,
                total: Number(purchaseValueToday.toFixed(2)),
                totalBase: Number(purchaseValueBaseToday.toFixed(2)),
            },
            returns: {
                count: returnsTodayCount,
                estimatedValue: Number(returnEstimatedValue.toFixed(2)),
                paymentImpact: Number(returnPaymentsImpact.toFixed(2)),
            },
            transfers: {
                count: transfersTodayCount,
                transferCost: Number(transferCostToday.toFixed(2)),
            },
            discounts: {
                count: discountsTodayCount,
                totalDiscountAmount: Number(totalDiscountAmount.toFixed(2)),
            },
        },
        anomalies,
        highlights,
        recommendedActions,
        supportingData: {
            topExecutersToday,
            topWarehousesToday,
            operationSample,
            raw: rawBuckets
                ? Object.assign(Object.assign({}, rawBuckets), { truncated: rawTruncated }) : undefined,
        },
    };
});
exports.buildTodayOverview = buildTodayOverview;
