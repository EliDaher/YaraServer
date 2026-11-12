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
exports.updateCustomerBalanceInternal = exports.getCustomerById = exports.getCustomerByIdInternal = exports.getAllcustomerInternal = exports.deleteCustomerInternal = exports.updateCustomerInternal = exports.updateCustomerInfo = exports.createCustomerInternal = exports.create = exports.getCustomerPage = exports.getCustomerSummary = exports.getAll = void 0;
const customerSummary_service_1 = require("../services/customerSummary.service");
const numbers_1 = require("../utils/numbers");
const database_1 = require("../utils/database");
const uuid_1 = require("uuid");
const database_2 = require("firebase/database");
const firebaseConfig_1 = require("../firebaseConfig");
/* =========================================================
   ✅ 1. جلب جميع العملاء
   ========================================================= */
const getAll = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const dbRef = (0, database_2.ref)(firebaseConfig_1.database, "customer");
        const snapshot = yield (0, database_2.get)(dbRef);
        res.json(snapshot.exists() ? Object.values(snapshot.val()) : []);
    }
    catch (error) {
        console.error("Error fetching customers:", error);
        res.status(500).json({ error: error.message });
    }
});
exports.getAll = getAll;
function sendCustomerSummaries(req, res, paged) {
    return __awaiter(this, void 0, void 0, function* () {
        const started = performance.now();
        const rows = yield (0, customerSummary_service_1.readCustomerSummaries)();
        const ready = performance.now();
        if (!rows) {
            res.status(503).json({ error: "Customer summaries are temporarily unavailable" });
            return;
        }
        const result = paged ? (0, customerSummary_service_1.pageCustomerSummaries)(rows, req.query) : rows;
        if (process.env.CUSTOMER_SUMMARY_TIMING !== "1") {
            res.json(result);
            return;
        }
        const body = JSON.stringify(result);
        const wait = (ready - started).toFixed(2);
        const prepare = (performance.now() - ready).toFixed(2);
        res.setHeader("Server-Timing", `cache;dur=${wait}, prepare;dur=${prepare}`);
        console.info("[customer-summary]", {
            waitMs: Number(wait), prepareMs: Number(prepare), bytes: Buffer.byteLength(body),
        });
        res.type("json").send(body);
    });
}
const getCustomerSummary = (req, res) => sendCustomerSummaries(req, res, false);
exports.getCustomerSummary = getCustomerSummary;
const getCustomerPage = (req, res) => sendCustomerSummaries(req, res, true);
exports.getCustomerPage = getCustomerPage;
/* =========================================================
   ✅ 2. إنشاء عميل جديد
   ========================================================= */
const create = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const now = new Date().toLocaleString();
        const id = (0, uuid_1.v4)();
        const newCustomer = Object.assign(Object.assign({}, req.body), { id, createdDate: now, updatedDate: now });
        yield (0, database_1.set)((0, database_2.ref)(firebaseConfig_1.database, `customer/${id}`), newCustomer);
        res.json({ message: "✅ تم إنشاء العميل", data: newCustomer });
    }
    catch (error) {
        console.error("Error creating customer:", error);
        res.status(500).json({ error: error.message });
    }
});
exports.create = create;
/* =========================================================
   ✅ 3. إنشاء عميل داخلي (للاستخدام من وحدات أخرى)
   ========================================================= */
const createCustomerInternal = (newCustomer) => __awaiter(void 0, void 0, void 0, function* () {
    const id = (0, uuid_1.v4)();
    const now = new Date().toLocaleString();
    const customer = Object.assign(Object.assign({}, newCustomer), { id, createdDate: now, updatedDate: now });
    yield (0, database_1.set)((0, database_2.ref)(firebaseConfig_1.database, `customer/${id}`), customer);
    return customer;
});
exports.createCustomerInternal = createCustomerInternal;
const updateCustomerInfo = (
// id: string,
// updates: Partial<Omit<Customer, "id" | "createdDate">>
req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const updates = req.body;
    const dbRef = (0, database_2.ref)(firebaseConfig_1.database, `customer/${id}`);
    const snapshot = yield (0, database_2.get)(dbRef);
    if (!snapshot.exists()) {
        res.status(404).json({ error: "Customer not found" });
        return null;
    }
    const customer = snapshot.val();
    const now = new Date().toLocaleString();
    let updatedCustomer = Object.assign(Object.assign({}, customer), { updatedDate: now, name: updates.name, number: updates.number });
    yield (0, database_1.update)(dbRef, updatedCustomer);
    res.json({ message: "✅ تم تحديث بيانات العميل", data: updatedCustomer });
    return updatedCustomer;
});
exports.updateCustomerInfo = updateCustomerInfo;
/* =========================================================
   ✅ 4. تحديث بيانات العميل داخليًا
   ========================================================= */
const updateCustomerInternal = (id, sellUpdates, payUpdates) => __awaiter(void 0, void 0, void 0, function* () {
    const dbRef = (0, database_2.ref)(firebaseConfig_1.database, `customer/${id}`);
    const snapshot = yield (0, database_2.get)(dbRef);
    if (!snapshot.exists())
        return null;
    const customer = snapshot.val();
    const now = new Date().toLocaleString();
    let updatedCustomer = Object.assign(Object.assign({}, customer), { updatedDate: now });
    if (sellUpdates) {
        updatedCustomer.balance =
            (0, numbers_1.decimal)(customer.balance || 0).minus(sellUpdates.remainingDebt || 0).toNumber();
        updatedCustomer.purchases = [
            ...(customer.purchases || []),
            sellUpdates.id || "",
        ];
    }
    else if (payUpdates) {
        updatedCustomer.balance =
            (0, numbers_1.decimal)(customer.balance || 0).plus(payUpdates.amount || 0).toNumber();
    }
    yield (0, database_1.update)(dbRef, updatedCustomer);
    return updatedCustomer;
});
exports.updateCustomerInternal = updateCustomerInternal;
/* =========================================================
   ✅ 5. حذف عميل داخليًا
   ========================================================= */
const deleteCustomerInternal = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const dbRef = (0, database_2.ref)(firebaseConfig_1.database, `customer/${id}`);
    const snapshot = yield (0, database_2.get)(dbRef);
    if (!snapshot.exists())
        return false;
    yield (0, database_2.remove)(dbRef);
    return true;
});
exports.deleteCustomerInternal = deleteCustomerInternal;
/* =========================================================
   ✅ 6. جلب جميع العملاء داخليًا
   ========================================================= */
const getAllcustomerInternal = () => __awaiter(void 0, void 0, void 0, function* () {
    const dbRef = (0, database_2.ref)(firebaseConfig_1.database, "customer");
    const snapshot = yield (0, database_2.get)(dbRef);
    return snapshot.exists() ? Object.values(snapshot.val()) : [];
});
exports.getAllcustomerInternal = getAllcustomerInternal;
/* =========================================================
   ✅ 7. جلب عميل واحد داخليًا
   ========================================================= */
const getCustomerByIdInternal = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const dbRef = (0, database_2.ref)(firebaseConfig_1.database, `customer/${id}`);
    const snapshot = yield (0, database_2.get)(dbRef);
    return snapshot.exists() ? snapshot.val() : null;
});
exports.getCustomerByIdInternal = getCustomerByIdInternal;
/* =========================================================
   ✅ 8. جلب عميل + المشتريات + المدفوعات
   ✅ تحسين الأداء بعدم جلب كل القاعدة
   ========================================================= */
const getCustomerById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { id } = req.body;
    try {
        // 🔹 جلب العميل فقط
        const [customerSnap, paymentsSnap] = yield Promise.all([
            (0, database_2.get)((0, database_2.ref)(firebaseConfig_1.database, `customer/${id}`)),
            (0, database_2.get)((0, database_2.query)((0, database_2.ref)(firebaseConfig_1.database, "payment"), (0, database_2.orderByChild)("customerId"), (0, database_2.equalTo)(id))),
        ]);
        if (!customerSnap.exists())
            return res.status(404).json({ error: "Customer not found" });
        const customer = customerSnap.val();
        // 🔹 جلب مشترياته فقط
        let purchases = [];
        if ((_a = customer.purchases) === null || _a === void 0 ? void 0 : _a.length) {
            const promises = customer.purchases.map((pid) => __awaiter(void 0, void 0, void 0, function* () {
                const pSnap = yield (0, database_2.get)((0, database_2.ref)(firebaseConfig_1.database, `sells/${pid}`));
                return pSnap.exists() ? pSnap.val() : null;
            }));
            purchases = (yield Promise.all(promises)).filter(Boolean);
        }
        // 🔹 جلب مدفوعاته فقط
        const payments = paymentsSnap.exists() ? Object.values(paymentsSnap.val()) : [];
        res.json({
            data: Object.assign(Object.assign({}, customer), { purchases,
                payments }),
        });
    }
    catch (error) {
        console.error("Error fetching customer details:", error);
        res.status(500).json({ error: error.message });
    }
});
exports.getCustomerById = getCustomerById;
/* =========================================================
   ✅ 9. تعديل الرصيد فقط (دون جلب إضافي)
   ========================================================= */
const updateCustomerBalanceInternal = (id, amountChange) => __awaiter(void 0, void 0, void 0, function* () {
    const dbRef = (0, database_2.ref)(firebaseConfig_1.database, `customer/${id}`);
    const snapshot = yield (0, database_2.get)(dbRef);
    if (!snapshot.exists())
        return null;
    const customer = snapshot.val();
    const updatedCustomer = Object.assign(Object.assign({}, customer), { balance: (0, numbers_1.roundNumber)((0, numbers_1.decimal)(customer.balance || 0).plus((0, numbers_1.roundNumber)(amountChange))), updatedDate: new Date().toLocaleString() });
    yield (0, database_1.update)(dbRef, updatedCustomer);
    return updatedCustomer;
});
exports.updateCustomerBalanceInternal = updateCustomerBalanceInternal;
