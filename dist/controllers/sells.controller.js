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
exports.addAfterSellDiscountInternal = exports.getSalesByWarehouseAndDate = exports.returnProductsFromSellInternal = exports.deleteSellById = exports.updateSellById = exports.getSellById = exports.createSellInternal = exports.deleteSell = exports.createSell = exports.getAllSells = void 0;
const database_1 = require("firebase/database");
const uuid_1 = require("uuid");
const firebaseConfig_1 = require("../firebaseConfig");
// 🧩 جلب جميع فواتير البيع
const getAllSells = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const snapshot = yield (0, database_1.get)((0, database_1.ref)(firebaseConfig_1.database, "sells"));
        const data = snapshot.exists() ? snapshot.val() : {};
        const sells = Object.values(data);
        res.json(sells);
    }
    catch (error) {
        console.error("❌ خطأ في جلب فواتير البيع:", error);
        res.status(500).json({ message: "حدث خطأ أثناء جلب فواتير البيع" });
    }
});
exports.getAllSells = getAllSells;
// 🧾 إنشاء فاتورة بيع جديدة
const createSell = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = (0, uuid_1.v4)();
        const NowDate = new Date().toLocaleString();
        const newSell = Object.assign(Object.assign({}, req.body), { id, date: NowDate });
        yield (0, database_1.set)((0, database_1.ref)(firebaseConfig_1.database, `sells/${id}`), newSell);
        res.json({ message: "✅ تم تسجيل فاتورة البيع", data: newSell });
    }
    catch (error) {
        console.error("❌ خطأ أثناء إنشاء فاتورة البيع:", error);
        res.status(500).json({ message: "حدث خطأ أثناء إنشاء فاتورة البيع" });
    }
});
exports.createSell = createSell;
// 🗑️ حذف فاتورة بيع
const deleteSell = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const sellRef = (0, database_1.ref)(firebaseConfig_1.database, `sells/${id}`);
        const snapshot = yield (0, database_1.get)(sellRef);
        if (!snapshot.exists()) {
            return res.status(404).json({ message: "❌ فاتورة البيع غير موجودة" });
        }
        yield (0, database_1.remove)(sellRef);
        res.json({ message: "✅ تم حذف فاتورة البيع" });
    }
    catch (error) {
        console.error("❌ خطأ أثناء حذف فاتورة البيع:", error);
        res.status(500).json({ message: "حدث خطأ أثناء حذف فاتورة البيع" });
    }
});
exports.deleteSell = deleteSell;
// ✅ internal helper (للاستخدام داخل functions/transactions.ts)
const createSellInternal = (newSell) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = (0, uuid_1.v4)();
        const NowDate = new Date().toLocaleString();
        const sellData = Object.assign(Object.assign({}, newSell), { id, date: NowDate });
        yield (0, database_1.set)((0, database_1.ref)(firebaseConfig_1.database, `sells/${id}`), sellData);
        return sellData;
    }
    catch (error) {
        console.error("❌ خطأ أثناء إنشاء فاتورة بيع داخلية:", error);
        throw error;
    }
});
exports.createSellInternal = createSellInternal;
// 🧾 جلب فاتورة بيع حسب ID
const getSellById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const snapshot = yield (0, database_1.get)((0, database_1.ref)(firebaseConfig_1.database, `sells/${id}`));
        if (!snapshot.exists()) {
            return res.status(404).json({ message: "❌ فاتورة البيع غير موجودة" });
        }
        const sellData = snapshot.val();
        // جلب بيانات الزبون
        const customerSnap = yield (0, database_1.get)((0, database_1.ref)(firebaseConfig_1.database, `customer/${sellData.customerId}`));
        const customerData = customerSnap.exists() ? customerSnap.val() : {};
        res.json(Object.assign(Object.assign({}, sellData), { customerName: customerData.name || "" }));
    }
    catch (error) {
        console.error("❌ خطأ أثناء جلب الفاتورة:", error);
        res.status(500).json({ message: "حدث خطأ أثناء جلب الفاتورة" });
    }
});
exports.getSellById = getSellById;
// 🧩 تحديث فاتورة بيع
const updateSellById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = req.params;
        const updateData = (_a = req.body) === null || _a === void 0 ? void 0 : _a.data;
        // ✅ Validation أساسي
        if (!id) {
            return res.status(400).json({ message: "معرف الفاتورة غير صالح" });
        }
        if (!updateData || !Array.isArray(updateData.products)) {
            return res.status(400).json({ message: "بيانات التحديث غير صالحة" });
        }
        const sellRef = (0, database_1.ref)(firebaseConfig_1.database, `sells/${id}`);
        const snapshot = yield (0, database_1.get)(sellRef);
        if (!snapshot.exists()) {
            return res.status(404).json({ message: "❌ فاتورة البيع غير موجودة" });
        }
        const sellData = snapshot.val();
        const oldTotalPrice = Number(sellData.totalPrice || 0);
        // =========================
        // 🧾 تعديل المخزون
        // =========================
        // 1️⃣ استرجاع الكميات القديمة
        for (const oldP of sellData.products || []) {
            if (!(oldP === null || oldP === void 0 ? void 0 : oldP.warehouse) || !(oldP === null || oldP === void 0 ? void 0 : oldP.code) || !(oldP === null || oldP === void 0 ? void 0 : oldP.qty))
                continue;
            const qtyPath = `products/${oldP.warehouse}/${oldP.id}/quantity`;
            const qtyRef = (0, database_1.ref)(firebaseConfig_1.database, qtyPath);
            const qtySnap = yield (0, database_1.get)(qtyRef);
            if (!qtySnap.exists()) {
                return res.status(400).json({
                    message: `المنتج غير موجود في المخزون: ${oldP.code}`,
                });
            }
            const currentQty = Number(qtySnap.val());
            const restoredQty = currentQty + Number(oldP.qty);
            yield (0, database_1.set)(qtyRef, restoredQty);
        }
        // 2️⃣ خصم الكميات الجديدة
        for (const newP of updateData.products) {
            if (!(newP === null || newP === void 0 ? void 0 : newP.warehouse) || !(newP === null || newP === void 0 ? void 0 : newP.code) || !(newP === null || newP === void 0 ? void 0 : newP.qty)) {
                return res.status(400).json({
                    message: "بيانات منتج غير صالحة",
                });
            }
            const qtyPath = `products/${newP.warehouse}/${newP.id}/quantity`;
            const qtyRef = (0, database_1.ref)(firebaseConfig_1.database, qtyPath);
            const qtySnap = yield (0, database_1.get)(qtyRef);
            if (!qtySnap.exists()) {
                return res.status(400).json({
                    message: `المنتج غير موجود في المخزون: ${newP.code}`,
                });
            }
            const currentQty = Number(qtySnap.val());
            const newQty = currentQty - Number(newP.qty);
            if (newQty < 0) {
                return res.status(400).json({
                    message: `❌ الكمية غير كافية للمنتج ${newP.code}`,
                });
            }
            yield (0, database_1.set)(qtyRef, newQty);
        }
        // =========================
        // 🔢 تحديث الفاتورة
        // =========================
        sellData.products = updateData.products;
        const newTotalPrice = sellData.products.reduce((sum, p) => sum + Number(p.sellPrice || 0) * Number(p.qty || 0), 0);
        sellData.totalPrice = newTotalPrice;
        sellData.updatedAt = new Date().toISOString();
        // =========================
        // 💰 تحديث رصيد العميل
        // =========================
        const customerRef = (0, database_1.ref)(firebaseConfig_1.database, `customer/${sellData.customerId}`);
        const customerSnap = yield (0, database_1.get)(customerRef);
        if (!customerSnap.exists()) {
            return res.status(400).json({
                message: "العميل غير موجود",
            });
        }
        const customer = customerSnap.val();
        const currentBalance = Number(customer.balance || 0);
        console.log(currentBalance, oldTotalPrice, newTotalPrice);
        const newBalance = currentBalance + (oldTotalPrice - newTotalPrice);
        yield (0, database_1.update)(customerRef, {
            balance: newBalance,
        });
        // =========================
        // 🧾 تسجيل حركة مالية
        // =========================
        const paymentId = (0, uuid_1.v4)();
        const payment = {
            id: paymentId,
            type: "sell_edit",
            customerId: sellData.customerId,
            currency: sellData.currency || "",
            exchangeRate: 1,
            amount_base: newTotalPrice,
            amount: newTotalPrice,
            note: `تعديل على فاتورة بيع - ${id}`,
            date: new Date().toISOString(),
        };
        yield (0, database_1.set)((0, database_1.ref)(firebaseConfig_1.database, `payment/${paymentId}`), payment);
        // =========================
        // 💾 حفظ الفاتورة
        // =========================
        yield (0, database_1.update)(sellRef, sellData);
        return res.json({
            message: "✅ تم تحديث الفاتورة بنجاح",
            sell: sellData,
        });
    }
    catch (error) {
        console.error("❌ خطأ أثناء تحديث فاتورة البيع:", error);
        return res.status(500).json({
            message: "حدث خطأ أثناء تحديث الفاتورة",
            error: error === null || error === void 0 ? void 0 : error.message,
        });
    }
});
exports.updateSellById = updateSellById;
// 🗑️ حذف فاتورة بيع بالكامل مع إرجاع المخزون وتعديل الرصيد
const deleteSellById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const sellRef = (0, database_1.ref)(firebaseConfig_1.database, `sells/${id}`);
        const snapshot = yield (0, database_1.get)(sellRef);
        if (!snapshot.exists()) {
            return res.status(404).json({ message: "❌ فاتورة البيع غير موجودة" });
        }
        const sellData = snapshot.val();
        // 🧩 استرجاع الكميات في المخزون
        const productsSnap = yield (0, database_1.get)((0, database_1.ref)(firebaseConfig_1.database, "products"));
        const products = productsSnap.exists() ? productsSnap.val() : {};
        for (const p of sellData.products) {
            const warehouse = p.warehouse;
            const code = p.code;
            if (products[warehouse] && products[warehouse][code]) {
                products[warehouse][code].quantity += parseFloat(p.qty);
            }
        }
        yield (0, database_1.update)((0, database_1.ref)(firebaseConfig_1.database, "products"), products);
        // 💰 تعديل رصيد الزبون
        const customerRef = (0, database_1.ref)(firebaseConfig_1.database, `customer/${sellData.customerId}`);
        const customerSnap = yield (0, database_1.get)(customerRef);
        if (customerSnap.exists()) {
            const customer = customerSnap.val();
            customer.balance = (customer.balance || 0) + sellData.totalPrice;
            yield (0, database_1.update)(customerRef, customer);
        }
        // 🧾 تسجيل العملية كدفعة حذف
        const paymentId = (0, uuid_1.v4)();
        const payment = {
            type: "sell_delete",
            customerId: sellData.customerId,
            currency: sellData.currency || "",
            exchangeRate: 1,
            amount_base: 0,
            amount: 0,
            note: `حذف فاتورة بيع - ${sellData.id}`,
            id: paymentId,
            date: new Date().toLocaleString(),
        };
        yield (0, database_1.set)((0, database_1.ref)(firebaseConfig_1.database, `payment/${paymentId}`), payment);
        // حذف الفاتورة
        yield (0, database_1.remove)(sellRef);
        res.json({
            message: `✅ تم حذف الفاتورة ${id} وإرجاع المخزون وتحديث رصيد الزبون.`,
        });
    }
    catch (error) {
        console.error("❌ خطأ أثناء حذف فاتورة البيع:", error);
        res.status(500).json({ message: "حدث خطأ أثناء حذف فاتورة البيع" });
    }
});
exports.deleteSellById = deleteSellById;
const returnProductsFromSellInternal = (sellId, returnedProducts) => __awaiter(void 0, void 0, void 0, function* () {
    const sellRef = (0, database_1.ref)(firebaseConfig_1.database, `sells/${sellId}`);
    const sellSnap = yield (0, database_1.get)(sellRef);
    if (!sellSnap.exists())
        return null;
    const sellData = sellSnap.val();
    let totalRefund = 0;
    for (const { code, warehouse, qty } of returnedProducts) {
        const product = sellData.products.find((p) => p.code === code && p.warehouse === warehouse);
        if (!product)
            continue;
        const returnedQty = Math.min(product.qty, qty);
        product.qty -= returnedQty;
        totalRefund += returnedQty * Number(product.sellPrice);
    }
    sellData.products = sellData.products.filter((p) => p.qty > 0);
    sellData.totalPrice = sellData.products.reduce((sum, p) => sum + Number(p.sellPrice) * Number(p.qty), 0);
    yield (0, database_1.update)(sellRef, sellData);
    return { updatedSell: sellData, totalRefund };
});
exports.returnProductsFromSellInternal = returnProductsFromSellInternal;
// جلب المبيعات حسب المستودع والتاريخ
const getSalesByWarehouseAndDate = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let { warehouse, date } = req.body;
        if (!warehouse) {
            return res.status(400).json({ message: "warehouse مطلوب" });
        }
        if (!date) {
            date = new Date().toLocaleDateString("en-CA", {
                timeZone: "Asia/Damascus",
            });
        }
        const snapshot = yield (0, database_1.get)((0, database_1.ref)(firebaseConfig_1.database, "sells"));
        if (!snapshot.exists()) {
            return res.json({ sales: [] });
        }
        const salesArray = Object.values(snapshot.val());
        const filteredSales = salesArray.filter((sale) => {
            if (!sale.date || !sale.products)
                return false;
            const saleDate = new Date(sale.date).toLocaleDateString("en-CA", {
                timeZone: "Asia/Damascus",
            });
            const sameDate = saleDate === date;
            const hasWarehouseProduct = sale.products.some((product) => product.warehouse === warehouse);
            return sameDate && hasWarehouseProduct;
        });
        res.json({ sales: filteredSales });
    }
    catch (error) {
        console.error("❌ خطأ في جلب المبيعات:", error);
        res.status(500).json({ sales: [], message: "خطأ في السيرفر" });
    }
});
exports.getSalesByWarehouseAndDate = getSalesByWarehouseAndDate;
const addAfterSellDiscountInternal = (_a) => __awaiter(void 0, [_a], void 0, function* ({ sellId, discount }) {
    try {
        if (!sellId || discount == null) {
            return { message: "sellId و discount مطلوبان" };
        }
        const sellRef = (0, database_1.ref)(firebaseConfig_1.database, `sells/${sellId}`);
        const sellSnap = yield (0, database_1.get)(sellRef);
        if (!sellSnap.exists()) {
            return { message: "فاتورة البيع غير موجودة" };
        }
        const sellData = sellSnap.val();
        sellData.discount = discount;
        sellData.totalPrice = (sellData.totalPrice || 0) - discount;
        yield (0, database_1.update)(sellRef, sellData);
        return { message: "✅ تم إضافة الخصم بعد البيع", data: sellData };
    }
    catch (error) {
        console.error("❌ خطأ في إضافة الخصم بعد البيع:", error);
        return { message: "حدث خطأ أثناء إضافة الخصم" };
    }
});
exports.addAfterSellDiscountInternal = addAfterSellDiscountInternal;
