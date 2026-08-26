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
exports.deletePayment = exports.createPaymentInternal = exports.createPayment = exports.getMonthPayments = exports.getAll = void 0;
const uuid_1 = require("uuid");
const database_1 = require("firebase/database");
const firebaseConfig_1 = require("../firebaseConfig");
const customer_controller_1 = require("./customer.controller");
const suppliers_controller_1 = require("./suppliers.controller");
const generatedNotePatterns = [
    "دفعة من ثمن شراء",
    "دفع كامل ثمن شراء",
    "دفع كامل ثمن بيع",
    "دفعه من ثمن بيع",
    "اعادة منتجات للمورد",
    "Customer return",
    "transfer/shipping cost",
    "Transfer:",
    "نقل ",
];
const isGeneratedLegacyPayment = (payment) => {
    if (payment.source === "generated")
        return true;
    if (payment.type === "return" || payment.type === "sell_delete" || payment.type === "sell_edit") {
        return true;
    }
    if (payment.supplierId === "transfer")
        return true;
    const note = payment.note || "";
    return generatedNotePatterns.some((pattern) => note.includes(pattern));
};
const shouldReverseBalance = (payment) => {
    if (payment.balanceApplied === true)
        return true;
    if (payment.balanceApplied === false)
        return false;
    if (payment.source === "cashbox")
        return false;
    return !isGeneratedLegacyPayment(payment) && Boolean(payment.customerId || payment.supplierId);
};
// ✅ get all payments as array
const getAll = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const dbRef = (0, database_1.ref)(firebaseConfig_1.database, "payment");
        const snapshot = yield (0, database_1.get)(dbRef);
        const payments = snapshot.exists() ? Object.values(snapshot.val()) : [];
        res.json(payments);
    }
    catch (error) {
        console.error("Error fetching payments:", error);
        res.status(500).json({ error: error.message });
    }
});
exports.getAll = getAll;
// ✅ get month payments as array
const getMonthPayments = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { month, year } = req.query;
        if (!month || !year) {
            return res.status(400).json({ error: "Month and year are required" });
        }
        const dbRef = (0, database_1.ref)(firebaseConfig_1.database, "payment");
        const snapshot = yield (0, database_1.get)(dbRef);
        const payments = snapshot.exists() ? Object.values(snapshot.val()) : [];
        const filteredPayments = payments.filter((p) => {
            const paymentDate = new Date(p.date);
            return (paymentDate.getMonth() + 1 === Number(month) &&
                paymentDate.getFullYear() === Number(year));
        });
        res.json(filteredPayments);
    }
    catch (error) {
        console.error("Error filtering payments:", error);
        res.status(500).json({ error: error.message });
    }
});
exports.getMonthPayments = getMonthPayments;
// ✅ إنشاء دفعة جديدة
const createPayment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { newPayment } = req.body;
        const id = (0, uuid_1.v4)();
        const now = new Date().toLocaleString();
        const payment = Object.assign(Object.assign({}, newPayment), { id, date: newPayment.date || now, source: newPayment.source || "cashbox", balanceApplied: (_a = newPayment.balanceApplied) !== null && _a !== void 0 ? _a : false });
        yield (0, database_1.set)((0, database_1.ref)(firebaseConfig_1.database, `payment/${id}`), payment);
        res.status(201).json(payment);
    }
    catch (error) {
        console.error("Error creating payment:", error);
        res.status(500).json({ error: "فشل في إنشاء الدفعة" });
    }
});
exports.createPayment = createPayment;
// ✅ إنشاء دفعة جديدة داخليًا (بدون استجابة HTTP)
const createPaymentInternal = (newPayment) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const id = (0, uuid_1.v4)();
    const now = new Date().toLocaleString();
    const payment = Object.assign(Object.assign({}, newPayment), { id, date: newPayment.date || now, source: newPayment.source || "generated", balanceApplied: (_a = newPayment.balanceApplied) !== null && _a !== void 0 ? _a : false });
    yield (0, database_1.set)((0, database_1.ref)(firebaseConfig_1.database, `payment/${id}`), payment);
    return payment;
});
exports.createPaymentInternal = createPaymentInternal;
const deletePayment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const paymentRef = (0, database_1.ref)(firebaseConfig_1.database, `payment/${id}`);
        const snapshot = yield (0, database_1.get)(paymentRef);
        if (!snapshot.exists()) {
            return res.status(404).json({ error: "Payment not found" });
        }
        const payment = snapshot.val();
        if (isGeneratedLegacyPayment(payment)) {
            return res.status(400).json({
                error: "لا يمكن حذف هذه الدفعة لأنها مرتبطة بفاتورة أو عملية أخرى. عدّل العملية الأصلية بدلاً من ذلك.",
            });
        }
        if (shouldReverseBalance(payment)) {
            if (payment.customerId) {
                yield (0, customer_controller_1.updateCustomerBalanceInternal)(payment.customerId, -Number(payment.amount || 0));
            }
            if (payment.supplierId && payment.supplierId !== "elidaher") {
                yield (0, suppliers_controller_1.updateSupplierBalanceInternal)(payment.supplierId, -Number(payment.amount || 0));
            }
        }
        yield (0, database_1.remove)(paymentRef);
        res.json({ message: "Payment deleted successfully", data: payment });
    }
    catch (error) {
        console.error("Error deleting payment:", error);
        res.status(500).json({ error: error.message || "فشل في حذف الدفعة" });
    }
});
exports.deletePayment = deletePayment;
