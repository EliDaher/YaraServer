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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllOperations = exports.getOperationCollections = exports.normalizeOperations = exports.toTimestamp = void 0;
const database_1 = require("firebase/database");
const firebaseConfig_1 = require("../firebaseConfig");
const asRecord = (value) => value && typeof value === "object" ? value : {};
const toArray = (value) => Object.values(asRecord(value));
const asString = (value) => typeof value === "string" ? value.trim() : "";
const toNumber = (value) => {
    const parsed = Number(value !== null && value !== void 0 ? value : 0);
    return Number.isFinite(parsed) ? parsed : 0;
};
const normalizeExecuter = (row) => asString(row.executer) || asString(row.performedBy) || "Unknown";
const normalizeDateString = (value) => {
    if (typeof value === "number") {
        const numericDate = new Date(value);
        return Number.isNaN(numericDate.getTime())
            ? new Date(0).toISOString()
            : numericDate.toISOString();
    }
    const stringDate = asString(value);
    if (!stringDate) {
        return new Date(0).toISOString();
    }
    const parsed = Date.parse(stringDate);
    return Number.isNaN(parsed) ? new Date(0).toISOString() : stringDate;
};
const toTimestamp = (value) => {
    if (typeof value === "number") {
        return value;
    }
    const parsed = Date.parse(asString(value));
    return Number.isNaN(parsed) ? 0 : parsed;
};
exports.toTimestamp = toTimestamp;
const normalizeOperations = (purchases, sells, payments, returns, transfers, discounts) => {
    const purchaseOps = purchases.map((purchase) => {
        const row = asRecord(purchase);
        const id = asString(row.id) || asString(row.referenceId);
        return {
            id: id || `purchase-${Math.random()}`,
            type: "purchase",
            executer: normalizeExecuter(row),
            date: normalizeDateString(row.date),
            referenceId: id || "-",
            amount: toNumber(row.totalPrice),
            currency: asString(row.currency),
            details: asString(row.name) ||
                asString(row.code) ||
                `Purchase supplier:${asString(row.supplierId)}`,
        };
    });
    const sellOps = sells.map((sell) => {
        const row = asRecord(sell);
        const id = asString(row.id) || asString(row.referenceId);
        return {
            id: id || `sell-${Math.random()}`,
            type: "sell",
            executer: normalizeExecuter(row),
            date: normalizeDateString(row.date),
            referenceId: id || "-",
            amount: toNumber(row.totalPrice),
            currency: asString(row.currency),
            details: `Sell customer:${asString(row.customerId)}`,
        };
    });
    const paymentOps = payments.map((payment) => {
        const row = asRecord(payment);
        const id = asString(row.id) || asString(row.referenceId);
        return {
            id: id || `payment-${Math.random()}`,
            type: `payment:${asString(row.type) || "entry"}`,
            executer: normalizeExecuter(row),
            date: normalizeDateString(row.date),
            referenceId: id || "-",
            amount: toNumber(row.amount),
            currency: asString(row.currency),
            details: asString(row.note) || "Payment operation",
        };
    });
    const returnOps = returns.map((returnRow) => {
        const row = asRecord(returnRow);
        const id = asString(row.id) || asString(row.referenceId);
        return {
            id: id || `return-${Math.random()}`,
            type: asString(row.type) || "return",
            executer: normalizeExecuter(row),
            date: normalizeDateString(row.createdDate || row.date),
            referenceId: asString(row.referenceId) || id || "-",
            amount: toNumber(row.returnValue),
            currency: asString(row.currency),
            details: `${asString(row.productCode) || "item"} qty:${toNumber(row.qty)}`,
        };
    });
    const transferOps = transfers.map((transfer) => {
        const row = asRecord(transfer);
        const id = asString(row.transferId) || asString(row.referenceId);
        return {
            id: id || `transfer-${Math.random()}`,
            type: "warehouse_transfer",
            executer: normalizeExecuter(row),
            date: normalizeDateString(row.createdAt || row.date),
            referenceId: asString(row.referenceId) || id || "-",
            amount: toNumber(row.cost || row.amount),
            currency: asString(row.currency),
            details: `${asString(row.productName)} ${asString(row.fromWarehouse)} -> ${asString(row.toWarehouse)}`.trim(),
        };
    });
    const discountOps = discounts.map((discount) => {
        const row = asRecord(discount);
        const id = asString(row.id) || asString(row.referenceId);
        return {
            id: id || `discount-${Math.random()}`,
            type: "after_sell_discount",
            executer: normalizeExecuter(row),
            date: normalizeDateString(row.date),
            referenceId: asString(row.referenceId) || "-",
            amount: toNumber(row.amount),
            currency: asString(row.currency),
            details: asString(row.details) ||
                `After-sell discount for sell ${asString(row.referenceId)}`,
        };
    });
    return [
        ...purchaseOps,
        ...sellOps,
        ...paymentOps,
        ...returnOps,
        ...transferOps,
        ...discountOps,
    ]
        .map((operation) => (Object.assign(Object.assign({}, operation), { executer: operation.executer || "Unknown" })))
        .sort((a, b) => (0, exports.toTimestamp)(b.date) - (0, exports.toTimestamp)(a.date));
};
exports.normalizeOperations = normalizeOperations;
const getOperationCollections = () => __awaiter(void 0, void 0, void 0, function* () {
    const [purchasesSnapshot, sellsSnapshot, paymentsSnapshot, returnsSnapshot, transfersSnapshot, discountsSnapshot,] = yield Promise.all([
        (0, database_1.get)((0, database_1.ref)(firebaseConfig_1.database, "purchases")),
        (0, database_1.get)((0, database_1.ref)(firebaseConfig_1.database, "sells")),
        (0, database_1.get)((0, database_1.ref)(firebaseConfig_1.database, "payment")),
        (0, database_1.get)((0, database_1.ref)(firebaseConfig_1.database, "returns")),
        (0, database_1.get)((0, database_1.ref)(firebaseConfig_1.database, "warehouseTransfers")),
        (0, database_1.get)((0, database_1.ref)(firebaseConfig_1.database, "discountOperations")),
    ]);
    return {
        purchases: toArray(purchasesSnapshot.val()),
        sells: toArray(sellsSnapshot.val()),
        payments: toArray(paymentsSnapshot.val()),
        returns: toArray(returnsSnapshot.val()),
        transfers: toArray(transfersSnapshot.val()),
        discounts: toArray(discountsSnapshot.val()),
    };
});
exports.getOperationCollections = getOperationCollections;
const getAllOperations = () => __awaiter(void 0, void 0, void 0, function* () {
    const collections = yield (0, exports.getOperationCollections)();
    return (0, exports.normalizeOperations)(collections.purchases, collections.sells, collections.payments, collections.returns, collections.transfers, collections.discounts);
});
exports.getAllOperations = getAllOperations;
