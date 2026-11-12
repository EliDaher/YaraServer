"use strict";
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.readSupplierSummaries = exports.startSupplierSummaries = exports.readCustomerSummaries = exports.startCustomerSummaries = void 0;
exports.summarizeCustomer = summarizeCustomer;
exports.pageCustomerSummaries = pageCustomerSummaries;
const database_1 = require("firebase/database");
const firebaseConfig_1 = require("../firebaseConfig");
function numericBalance(value) {
    if (typeof value !== "number" && typeof value !== "string")
        return 0;
    const balance = Number(value);
    return Number.isFinite(balance) ? balance : 0;
}
function summarizeCustomer({ id, name, number, balance, updatedDate, purchases }) {
    var _a;
    return { id, name, number, balance: numericBalance(balance), updatedDate, purchasesCount: (_a = purchases === null || purchases === void 0 ? void 0 : purchases.length) !== null && _a !== void 0 ? _a : 0 };
}
function createSummaryCache(collection, timingFlag) {
    let rows;
    let started = false;
    let unsubscribe;
    const waiters = new Set();
    function start() {
        if (started)
            return;
        started = true;
        (0, database_1.onValue)((0, database_1.ref)(firebaseConfig_1.database, ".info/connected"), (connection) => {
            rows = undefined;
            unsubscribe === null || unsubscribe === void 0 ? void 0 : unsubscribe();
            unsubscribe = undefined;
            if (!connection.val())
                return;
            const startedAt = performance.now();
            unsubscribe = (0, database_1.onValue)((0, database_1.ref)(firebaseConfig_1.database, collection), (snapshot) => {
                var _a;
                const first = rows === undefined;
                rows = Object.values((_a = snapshot.val()) !== null && _a !== void 0 ? _a : {}).map(summarizeCustomer);
                if (first && process.env[timingFlag] === "1") {
                    console.info(`[${collection}-summary] synchronized`, {
                        elapsedMs: Math.round(performance.now() - startedAt),
                        records: rows.length,
                    });
                }
                for (const resolve of waiters)
                    resolve(rows);
            }, (error) => {
                rows = undefined;
                console.error(`[${collection}-summary] subscription failed`, error.message);
            });
        });
    }
    function read() {
        if (rows)
            return Promise.resolve(rows);
        return new Promise((resolve) => {
            const ready = (value) => {
                clearTimeout(timeout);
                waiters.delete(ready);
                resolve(value);
            };
            const timeout = setTimeout(() => {
                waiters.delete(ready);
                resolve(undefined);
            }, 15000);
            waiters.add(ready);
        });
    }
    return { start, read };
}
_a = createSummaryCache("customer", "CUSTOMER_SUMMARY_TIMING"), exports.startCustomerSummaries = _a.start, exports.readCustomerSummaries = _a.read;
_b = createSummaryCache("supplier", "SUPPLIER_SUMMARY_TIMING"), exports.startSupplierSummaries = _b.start, exports.readSupplierSummaries = _b.read;
const normalize = (value) => String(value !== null && value !== void 0 ? value : "").trim().toLowerCase()
    .replace(/[\u0660-\u0669\u06f0-\u06f9]/g, digit => String(digit.charCodeAt(0) & 15));
const compareText = new Intl.Collator("ar", { numeric: true, sensitivity: "base" }).compare;
const comparators = {
    name: (a, b) => compareText(normalize(a.name), normalize(b.name)),
    number: (a, b) => compareText(normalize(a.number), normalize(b.number)),
    balance: (a, b) => a.balance - b.balance,
    purchasesCount: (a, b) => a.purchasesCount - b.purchasesCount,
    updatedDate: (a, b) => (Date.parse(a.updatedDate) || 0) - (Date.parse(b.updatedDate) || 0),
};
function pageCustomerSummaries(rows, query, collection = "customer") {
    var _a;
    const sizes = collection === "supplier" ? [3, 5, 10, 20] : [5, 10, 20];
    const pageSize = (_a = sizes.find(size => String(size) === query.pageSize)) !== null && _a !== void 0 ? _a : 10;
    const requestedPage = typeof query.page === "string" ? Number(query.page) : 1;
    const search = typeof query.search === "string" ? normalize(query.search) : "";
    const matches = rows.filter(row => normalize(row.name).includes(search) || normalize(row.number).includes(search));
    const sortBy = typeof query.sortBy === "string" ? query.sortBy : "";
    const compare = Object.prototype.hasOwnProperty.call(comparators, sortBy) ? comparators[sortBy] : undefined;
    if (compare) {
        const direction = query.sortDirection === "desc" ? -1 : 1;
        matches.sort((a, b) => direction * compare(a, b) || String(a.id).localeCompare(String(b.id)));
    }
    const page = Math.min(Number.isSafeInteger(requestedPage) ? Math.max(1, requestedPage) : 1, Math.max(1, Math.ceil(matches.length / pageSize)));
    const totalDebt = rows.reduce((sum, row) => sum + (collection === "supplier" ? Math.max(0, row.balance) : -Math.min(0, row.balance)), 0);
    const totalBalance = rows.reduce((sum, row) => sum + row.balance, 0);
    return {
        items: matches.slice((page - 1) * pageSize, page * pageSize),
        page,
        pageSize,
        totalItems: matches.length,
        totalDebt,
        totalBalance,
    };
}
