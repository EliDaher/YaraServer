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
exports.updatePurchaseInternal = exports.updatePurchase = exports.getAllPurchasesInternal = exports.getPurchaseByIdInternal = exports.deletePurchaseInternal = exports.deletePurchase = exports.createPurchaseInternal = exports.createPurchase = exports.getAllPurchases = void 0;
const uuid_1 = require("uuid");
const database_1 = require("firebase/database");
const products_controller_1 = require("./products.controller");
const firebaseConfig_1 = require("../firebaseConfig");
// ✅ الحصول على جميع عمليات الشراء
const getAllPurchases = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const dbRef = (0, database_1.ref)(firebaseConfig_1.database, "purchases");
        const snapshot = yield (0, database_1.get)(dbRef);
        const purchases = snapshot.exists() ? Object.values(snapshot.val()) : [];
        res.json(purchases);
    }
    catch (error) {
        console.error("Error fetching purchases:", error);
        res.status(500).json({ error: error.message });
    }
});
exports.getAllPurchases = getAllPurchases;
// ✅ إنشاء عملية شراء جديدة (API)
const createPurchase = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { supplierId, products, totalPrice, paymentStatus, remainingDebt, code, warehouse, quantity, payPrice, name, currency, exchangeRate, amount_base, transferCost, } = req.body;
        const id = (0, uuid_1.v4)();
        const NowDate = new Date().toLocaleString();
        const purchaseData = {
            id,
            supplierId,
            code,
            warehouse,
            quantity,
            payPrice,
            totalPrice,
            paymentStatus,
            remainingDebt,
            date: NowDate,
            name,
            currency,
            exchangeRate,
            amount_base,
            transferCost: Number(transferCost || 0),
        };
        // ✅ حفظ عملية الشراء في قاعدة البيانات
        yield (0, database_1.set)((0, database_1.ref)(firebaseConfig_1.database, `purchases/${id}`), purchaseData);
        // ✅ تحديث المخزون لكل منتج تمت إضافته
        if (Array.isArray(products)) {
            for (const p of products) {
                yield (0, products_controller_1.createOrUpdateProductInternal)(p);
            }
        }
        res.json({ message: "✅ تم تسجيل عملية الشراء", data: purchaseData });
    }
    catch (error) {
        console.error("Error creating purchase:", error);
        res.status(500).json({ error: error.message });
    }
});
exports.createPurchase = createPurchase;
// ✅ إنشاء عملية شراء داخلية (بدون استجابة HTTP)
const createPurchaseInternal = (newPurchase) => __awaiter(void 0, void 0, void 0, function* () {
    const id = (0, uuid_1.v4)();
    const NowDate = new Date().toLocaleString();
    const purchaseData = Object.assign(Object.assign({}, newPurchase), { transferCost: Number(newPurchase.transferCost || 0), id, date: NowDate });
    yield (0, database_1.set)((0, database_1.ref)(firebaseConfig_1.database, `purchases/${id}`), purchaseData);
    return purchaseData;
});
exports.createPurchaseInternal = createPurchaseInternal;
// ✅ حذف عملية شراء
const deletePurchase = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const dbRef = (0, database_1.ref)(firebaseConfig_1.database, `purchases/${id}`);
        const snapshot = yield (0, database_1.get)(dbRef);
        if (!snapshot.exists()) {
            return res.status(404).json({ message: "❌ عملية الشراء غير موجودة" });
        }
        yield (0, database_1.remove)(dbRef);
        res.json({ message: "✅ تم حذف عملية الشراء" });
    }
    catch (error) {
        console.error("Error deleting purchase:", error);
        res.status(500).json({ error: error.message });
    }
});
exports.deletePurchase = deletePurchase;
// ✅ حذف عملية شراء داخليًا
const deletePurchaseInternal = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const dbRef = (0, database_1.ref)(firebaseConfig_1.database, `purchases/${id}`);
    const snapshot = yield (0, database_1.get)(dbRef);
    if (!snapshot.exists())
        return false;
    yield (0, database_1.remove)(dbRef);
    return true;
});
exports.deletePurchaseInternal = deletePurchaseInternal;
// ✅ جلب عملية شراء واحدة داخليًا
const getPurchaseByIdInternal = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const dbRef = (0, database_1.ref)(firebaseConfig_1.database, `purchases/${id}`);
    const snapshot = yield (0, database_1.get)(dbRef);
    return snapshot.exists() ? snapshot.val() : null;
});
exports.getPurchaseByIdInternal = getPurchaseByIdInternal;
// ✅ جلب جميع عمليات الشراء داخليًا
const getAllPurchasesInternal = () => __awaiter(void 0, void 0, void 0, function* () {
    const dbRef = (0, database_1.ref)(firebaseConfig_1.database, "purchases");
    const snapshot = yield (0, database_1.get)(dbRef);
    return snapshot.exists() ? Object.values(snapshot.val()) : [];
});
exports.getAllPurchasesInternal = getAllPurchasesInternal;
// ✅ تعديل عملية شراء (API خارجي)
const updatePurchase = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const updatedData = req.body;
        const dbRef = (0, database_1.ref)(firebaseConfig_1.database, `purchases/${id}`);
        const snapshot = yield (0, database_1.get)(dbRef);
        if (!snapshot.exists()) {
            return res.status(404).json({ message: "❌ عملية الشراء غير موجودة" });
        }
        const existingPurchase = snapshot.val();
        // تحديث المخزون إذا تم تمرير منتجات جديدة
        if ("products" in updatedData &&
            Array.isArray(updatedData.products)) {
            for (const p of updatedData.products) {
                yield (0, products_controller_1.createOrUpdateProductInternal)(p);
            }
        }
        const newPurchaseData = Object.assign(Object.assign(Object.assign({}, existingPurchase), updatedData), { date: existingPurchase.date });
        yield (0, database_1.set)(dbRef, newPurchaseData);
        res.json({ message: "✅ تم تعديل عملية الشراء", data: newPurchaseData });
    }
    catch (error) {
        console.error("Error updating purchase:", error);
        res.status(500).json({ error: error.message });
    }
});
exports.updatePurchase = updatePurchase;
// ✅ تعديل عملية شراء داخليًا (Internal)
const updatePurchaseInternal = (id, updatedData) => __awaiter(void 0, void 0, void 0, function* () {
    const dbRef = (0, database_1.ref)(firebaseConfig_1.database, `purchases/${id}`);
    const snapshot = yield (0, database_1.get)(dbRef);
    if (!snapshot.exists())
        return null;
    const existingPurchase = snapshot.val();
    const newPurchaseData = Object.assign(Object.assign(Object.assign({}, existingPurchase), updatedData), { date: existingPurchase.date });
    yield (0, database_1.set)(dbRef, newPurchaseData);
    return newPurchaseData;
});
exports.updatePurchaseInternal = updatePurchaseInternal;
