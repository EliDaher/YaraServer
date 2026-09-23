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
exports.getSupplierById = exports.getSupplierByIdInternal = exports.getAllsupplierInternal = exports.deleteSupplierInternal = exports.updateSupplierBalanceInternal = exports.updateSupplierInternal = exports.updateSupplierInfo = exports.createSupplierInternal = exports.create = exports.getAll = void 0;
const uuid_1 = require("uuid");
const database_1 = require("firebase/database");
const firebaseConfig_1 = require("../firebaseConfig");
const toSafeSingleDecimalAmount = (value) => {
    if (typeof value === "number") {
        return Number.isFinite(value) ? Math.trunc(value * 10) / 10 : 0;
    }
    if (typeof value === "string") {
        const trimmedValue = value.trim();
        if (!trimmedValue)
            return 0;
        const amountMatch = trimmedValue.match(/^([+-]?\d+)(?:[.,](\d))?/);
        if (!amountMatch)
            return 0;
        const parsedValue = Number(`${amountMatch[1]}${amountMatch[2] ? `.${amountMatch[2]}` : ""}`);
        return Number.isFinite(parsedValue) ? parsedValue : 0;
    }
    return 0;
};
// ✅ جلب جميع الموردين
const getAll = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const snapshot = yield (0, database_1.get)((0, database_1.ref)(firebaseConfig_1.database, "supplier"));
        const suppliers = snapshot.exists() ? Object.values(snapshot.val()) : [];
        res.json(suppliers);
    }
    catch (error) {
        console.error("❌ خطأ في جلب الموردين:", error);
        res.status(500).json({ message: "حدث خطأ أثناء جلب الموردين" });
    }
});
exports.getAll = getAll;
// ✅ إنشاء أو تحديث مورد
const create = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const now = new Date().toLocaleString();
        const newSupplier = req.body;
        const id = (0, uuid_1.v4)();
        const SupplierToAdd = Object.assign(Object.assign({}, newSupplier), { id, createdDate: now, updatedDate: now });
        yield (0, database_1.set)((0, database_1.ref)(firebaseConfig_1.database, `supplier/${id}`), SupplierToAdd);
        res.json({ message: "✅ تم إنشاء المورد", data: SupplierToAdd });
    }
    catch (error) {
        console.error("❌ خطأ أثناء إنشاء المورد:", error);
        res.status(500).json({ message: "حدث خطأ أثناء إنشاء المورد" });
    }
});
exports.create = create;
// إنشاء مورد داخلي
const createSupplierInternal = (newSupplier) => __awaiter(void 0, void 0, void 0, function* () {
    const id = (0, uuid_1.v4)();
    const now = new Date().toLocaleString();
    const supplier = Object.assign(Object.assign({}, newSupplier), { id, createdDate: now, updatedDate: now });
    yield (0, database_1.set)((0, database_1.ref)(firebaseConfig_1.database, `supplier/${id}`), supplier);
    return supplier;
});
exports.createSupplierInternal = createSupplierInternal;
const updateSupplierInfo = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const updates = req.body;
    const dbRef = (0, database_1.ref)(firebaseConfig_1.database, `supplier/${id}`);
    const snapshot = yield (0, database_1.get)(dbRef);
    if (!snapshot.exists()) {
        res.status(404).json({ error: "Supplier not found" });
        return null;
    }
    const supplier = snapshot.val();
    const now = new Date().toLocaleString();
    let updatedSupplier = Object.assign(Object.assign({}, supplier), { updatedDate: now, name: updates.name, number: updates.number });
    yield (0, database_1.update)(dbRef, updatedSupplier);
    res.json({ message: "✅ تم تحديث بيانات المورد", data: updatedSupplier });
    return updatedSupplier;
});
exports.updateSupplierInfo = updateSupplierInfo;
// تحديث مورد داخلي (مع شراء أو دفعة)
const updateSupplierInternal = (id, sellUpdates, paymentUpdates) => __awaiter(void 0, void 0, void 0, function* () {
    console.log(id, sellUpdates, paymentUpdates);
    const supplierId = typeof id === "string" ? id : id.id;
    if (!supplierId)
        throw new Error("Invalid supplier id");
    const supplierRef = (0, database_1.ref)(firebaseConfig_1.database, `supplier/${supplierId}`);
    const snapshot = yield (0, database_1.get)(supplierRef);
    if (!snapshot.exists())
        return null;
    const supplier = snapshot.val();
    const now = new Date().toLocaleString();
    if (sellUpdates) {
        const currentBalance = toSafeSingleDecimalAmount(supplier.balance);
        const remainingDebt = toSafeSingleDecimalAmount(sellUpdates.remainingDebt);
        const updatedSupplier = Object.assign(Object.assign({}, supplier), { balance: currentBalance + remainingDebt, purchases: [...(supplier.purchases || []), sellUpdates.id || ""], updatedDate: now });
        yield (0, database_1.set)(supplierRef, updatedSupplier);
        return updatedSupplier;
    }
    if (paymentUpdates) {
        const currentBalance = toSafeSingleDecimalAmount(supplier.balance);
        const paymentAmount = toSafeSingleDecimalAmount(paymentUpdates.amount);
        const updatedSupplier = Object.assign(Object.assign({}, supplier), { balance: currentBalance + paymentAmount, updatedDate: now });
        yield (0, database_1.set)(supplierRef, updatedSupplier);
        return updatedSupplier;
    }
    return null;
});
exports.updateSupplierInternal = updateSupplierInternal;
// تحديث الرصيد داخليًا
const updateSupplierBalanceInternal = (id, amountChange) => __awaiter(void 0, void 0, void 0, function* () {
    const supplierRef = (0, database_1.ref)(firebaseConfig_1.database, `supplier/${id}`);
    const snapshot = yield (0, database_1.get)(supplierRef);
    if (!snapshot.exists())
        return null;
    const supplier = snapshot.val();
    const currentBalance = toSafeSingleDecimalAmount(supplier.balance);
    const safeAmountChange = toSafeSingleDecimalAmount(amountChange);
    const updatedSupplier = Object.assign(Object.assign({}, supplier), { balance: currentBalance + safeAmountChange, updatedDate: new Date().toLocaleString() });
    yield (0, database_1.set)(supplierRef, updatedSupplier);
    return updatedSupplier;
});
exports.updateSupplierBalanceInternal = updateSupplierBalanceInternal;
// حذف مورد داخلي
const deleteSupplierInternal = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const supplierRef = (0, database_1.ref)(firebaseConfig_1.database, `supplier/${id}`);
    const snapshot = yield (0, database_1.get)(supplierRef);
    if (!snapshot.exists())
        return false;
    yield (0, database_1.remove)(supplierRef);
    return true;
});
exports.deleteSupplierInternal = deleteSupplierInternal;
// جلب جميع الموردين داخليًا
const getAllsupplierInternal = () => __awaiter(void 0, void 0, void 0, function* () {
    const snapshot = yield (0, database_1.get)((0, database_1.ref)(firebaseConfig_1.database, "supplier"));
    return snapshot.exists() ? Object.values(snapshot.val()) : [];
});
exports.getAllsupplierInternal = getAllsupplierInternal;
// جلب مورد واحد داخليًا
const getSupplierByIdInternal = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const snapshot = yield (0, database_1.get)((0, database_1.ref)(firebaseConfig_1.database, `supplier/${id}`));
    return snapshot.exists() ? snapshot.val() : null;
});
exports.getSupplierByIdInternal = getSupplierByIdInternal;
// جلب مورد واحد مع المشتريات والمدفوعات
const getSupplierById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = req.body;
        const snapshot = yield (0, database_1.get)((0, database_1.ref)(firebaseConfig_1.database, `supplier/${id}`));
        if (!snapshot.exists()) {
            return res.status(404).json({ error: "Supplier not found" });
        }
        const supplier = snapshot.val();
        const normalizeId = (value) => typeof value === "string" ? value : value === null || value === void 0 ? void 0 : value.id;
        const findProductId = (purchase, productsData) => {
            const warehouseProducts = productsData[purchase.warehouse] || {};
            const match = Object.entries(warehouseProducts).find(([productId, product]) => productId === purchase.productId ||
                (product === null || product === void 0 ? void 0 : product.id) === purchase.productId ||
                (product === null || product === void 0 ? void 0 : product.code) === purchase.code);
            return (match === null || match === void 0 ? void 0 : match[0]) || purchase.productId || purchase.code;
        };
        const formatPurchase = (purchase, productsData) => (Object.assign(Object.assign({}, purchase), { supplierId: normalizeId(purchase.supplierId), productId: findProductId(purchase, productsData), transferCost: Number(purchase.transferCost || 0) }));
        const purchasesSnapshot = yield (0, database_1.get)((0, database_1.ref)(firebaseConfig_1.database, "purchases"));
        const purchasesData = purchasesSnapshot.exists()
            ? purchasesSnapshot.val()
            : {};
        const productsSnapshot = yield (0, database_1.get)((0, database_1.ref)(firebaseConfig_1.database, "products"));
        const productsData = productsSnapshot.exists() ? productsSnapshot.val() : {};
        const purchasesById = new Map();
        Object.values(purchasesData)
            .filter((purchase) => normalizeId(purchase === null || purchase === void 0 ? void 0 : purchase.supplierId) === id)
            .forEach((purchase) => {
            if (purchase === null || purchase === void 0 ? void 0 : purchase.id) {
                purchasesById.set(purchase.id, formatPurchase(purchase, productsData));
            }
        });
        (_a = supplier.purchases) === null || _a === void 0 ? void 0 : _a.map((purchaseId) => purchasesData[purchaseId]).filter(Boolean).forEach((purchase) => {
            if ((purchase === null || purchase === void 0 ? void 0 : purchase.id) && !purchasesById.has(purchase.id)) {
                purchasesById.set(purchase.id, formatPurchase(purchase, productsData));
            }
        });
        const purchases = Array.from(purchasesById.values());
        // جلب المدفوعات
        const paymentSnapshot = yield (0, database_1.get)((0, database_1.ref)(firebaseConfig_1.database, "payment"));
        const paymentsData = paymentSnapshot.exists()
            ? Object.values(paymentSnapshot.val())
            : [];
        const payments = paymentsData.filter((p) => { var _a; return p.supplierId === id || ((_a = p === null || p === void 0 ? void 0 : p.supplierId) === null || _a === void 0 ? void 0 : _a.id) === id; });
        res.json({ data: Object.assign(Object.assign({}, supplier), { purchases, payments }) });
    }
    catch (error) {
        console.error("❌ خطأ أثناء جلب المورد:", error);
        res.status(500).json({ message: "حدث خطأ أثناء جلب المورد" });
    }
});
exports.getSupplierById = getSupplierById;
