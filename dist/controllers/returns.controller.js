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
exports.createReturnInternal = exports.createReturn = exports.getReturnById = exports.getAllReturns = void 0;
const database_1 = require("firebase/database");
const uuid_1 = require("uuid");
// ✅ helper لتطبيق التعديل على الكمية
function applyReturnToProduct(product, type, qty) {
    if (type === "sale-return") {
        product.quantity += qty;
    }
    else if (type === "purchase-return") {
        if (product.quantity < qty) {
            throw new Error("❌ الكمية غير كافية في المخزون للإرجاع");
        }
        product.quantity -= qty;
    }
    else {
        throw new Error("❌ نوع الإرجاع غير صحيح (sale-return | purchase-return)");
    }
}
// ✅ get all returns
const getAllReturns = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const db = (0, database_1.getDatabase)();
        const returnsRef = (0, database_1.ref)(db, "returns");
        const snapshot = yield (0, database_1.get)(returnsRef);
        const returns = snapshot.exists() ? Object.values(snapshot.val()) : [];
        res.json(returns);
    }
    catch (error) {
        res.status(500).json({
            message: "❌ خطأ في جلب بيانات الإرجاعات",
            error: error.message,
        });
    }
});
exports.getAllReturns = getAllReturns;
// ✅ get return by id
const getReturnById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    if (!id)
        return res.status(400).json({ message: "❌ return id is required" });
    try {
        const db = (0, database_1.getDatabase)();
        const returnRef = (0, database_1.ref)(db, `returns/${id}`);
        const snapshot = yield (0, database_1.get)(returnRef);
        if (!snapshot.exists()) {
            return res.status(404).json({ message: "❌ عملية الإرجاع غير موجودة" });
        }
        res.json(snapshot.val());
    }
    catch (error) {
        res
            .status(500)
            .json({ message: "❌ خطأ في جلب عملية الإرجاع", error: error.message });
    }
});
exports.getReturnById = getReturnById;
// ✅ create return (customer return or purchase return)
const createReturn = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { productCode, warehouse, qty, type, referenceId, reason, executer } = req.body;
    if (!productCode || !warehouse || !qty || !type) {
        return res
            .status(400)
            .json({ message: "❌ productCode, warehouse, qty, type مطلوبة" });
    }
    try {
        const db = (0, database_1.getDatabase)();
        const productRef = (0, database_1.ref)(db, `products/${warehouse}/${productCode}`);
        const productSnap = yield (0, database_1.get)(productRef);
        if (!productSnap.exists()) {
            return res
                .status(404)
                .json({ message: "❌ المنتج غير موجود في المستودع" });
        }
        const product = productSnap.val();
        applyReturnToProduct(product, type, qty);
        product.updatedDate = new Date().toLocaleString();
        // ✅ تحديث المنتج بعد التعديل
        yield (0, database_1.update)(productRef, product);
        // ✅ إنشاء سجل الإرجاع
        const returnId = (0, uuid_1.v4)();
        const now = new Date().toLocaleString();
        const returnRecord = {
            id: returnId,
            productCode,
            productId: product.productID,
            warehouse,
            qty,
            type,
            referenceId: referenceId || null,
            reason: reason || "",
            executer: executer || "Unknown",
            createdDate: now,
        };
        yield (0, database_1.set)((0, database_1.ref)(db, `returns/${returnId}`), returnRecord);
        res.json({
            message: "✅ تم تسجيل عملية الإرجاع",
            data: { returnRecord, product },
        });
    }
    catch (error) {
        res
            .status(500)
            .json({ message: "❌ خطأ أثناء إنشاء الإرجاع", error: error.message });
    }
});
exports.createReturn = createReturn;
// ✅ create return internal (للاستخدام داخل النظام)
const createReturnInternal = (newReturn) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const db = (0, database_1.getDatabase)();
        const { applyStock = true } = newReturn, returnData = __rest(newReturn, ["applyStock"]);
        const productRef = (0, database_1.ref)(db, `products/${returnData.warehouse}/${returnData.productId}`);
        const productSnap = yield (0, database_1.get)(productRef);
        if (!productSnap.exists()) {
            throw new Error("❌ المنتج غير موجود في المستودع");
        }
        const product = productSnap.val();
        const now = new Date().toLocaleString();
        if (applyStock) {
            applyReturnToProduct(product, returnData.type, returnData.qty);
            product.updatedDate = now;
            yield (0, database_1.update)(productRef, product);
        }
        const id = (0, uuid_1.v4)();
        const returnRecord = Object.assign(Object.assign({}, returnData), { id, createdDate: now });
        yield (0, database_1.set)((0, database_1.ref)(db, `returns/${id}`), returnRecord);
        return { returnRecord, product };
    }
    catch (error) {
        throw new Error(`❌ خطأ أثناء تنفيذ createReturnInternal: ${error.message}`);
    }
});
exports.createReturnInternal = createReturnInternal;
