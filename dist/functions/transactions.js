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
exports.warehouseTransfer = exports.handleCustomerReturn = exports.handleSupplierReturn = exports.supplierPayment = exports.customerPayment = exports.handleSell = exports.handlePurchase = void 0;
const database_1 = require("firebase/database");
const customer_controller_1 = require("../controllers/customer.controller");
const payments_controller_1 = require("../controllers/payments.controller");
const products_controller_1 = require("../controllers/products.controller");
const purchases_controller_1 = require("../controllers/purchases.controller");
const returns_controller_1 = require("../controllers/returns.controller");
const sells_controller_1 = require("../controllers/sells.controller");
const suppliers_controller_1 = require("../controllers/suppliers.controller");
const transfer_controller_1 = require("../controllers/transfer.controller");
const firebaseConfig_1 = require("../firebaseConfig");
// ✅ عند تنفيذ عملية شراء
const handlePurchase = (_a) => __awaiter(void 0, [_a], void 0, function* ({ newPurchase, newProduct, executer, }) {
    // 1- تسجيل عملية الشراء
    const normalizedExecuter = executer || "Unknown";
    const purchaseWithExecuter = Object.assign(Object.assign({}, newPurchase), { executer: normalizedExecuter });
    const transferCost = Number(newPurchase.transferCost || 0);
    const purchaseData = yield (0, purchases_controller_1.createPurchaseInternal)(purchaseWithExecuter);
    // 2- تحديث مخزون المنتجات
    yield (0, products_controller_1.createOrUpdateProductInternal)(newProduct);
    // 3- تعديل رصيد المورد (إضافة دين جديد)
    yield (0, suppliers_controller_1.updateSupplierInternal)(purchaseData.supplierId, purchaseData);
    // 4- اضافة دفعة في حالة ودجودها
    if (purchaseData.remainingDebt > 0 &&
        purchaseData.remainingDebt < purchaseData.totalPrice) {
        yield (0, payments_controller_1.createPaymentInternal)({
            type: "expense",
            supplierId: purchaseData.supplierId,
            amount: -(purchaseData.totalPrice - purchaseData.remainingDebt),
            note: `${newProduct.name} دفعة من ثمن شراء`,
            currency: newPurchase.currency,
            exchangeRate: newPurchase.exchangeRate,
            amount_base: -(newPurchase.exchangeRate *
                (purchaseData.totalPrice - purchaseData.remainingDebt)),
            executer: normalizedExecuter,
        });
    }
    else if (purchaseData.remainingDebt == 0) {
        // 5- دين كامل
        yield (0, payments_controller_1.createPaymentInternal)({
            type: "expense",
            supplierId: purchaseData.supplierId,
            amount: -purchaseData.totalPrice,
            note: `${newProduct.name} دفع كامل ثمن شراء`,
            currency: newPurchase.currency,
            exchangeRate: newPurchase.exchangeRate,
            amount_base: -(newPurchase.exchangeRate * purchaseData.totalPrice),
            executer: normalizedExecuter,
        });
    }
    else if (purchaseData.remainingDebt == purchaseData.totalPrice) {
    }
    if (transferCost > 0) {
        yield (0, payments_controller_1.createPaymentInternal)({
            type: "expense",
            supplierId: purchaseData.supplierId,
            amount: -transferCost,
            note: `${newProduct.name} transfer/shipping cost`,
            currency: newPurchase.currency,
            exchangeRate: newPurchase.exchangeRate,
            amount_base: -(newPurchase.exchangeRate * transferCost),
            executer: normalizedExecuter,
        });
    }
    return purchaseData;
});
exports.handlePurchase = handlePurchase;
// ✅ عند تنفيذ عملية بيع
const handleSell = (_a) => __awaiter(void 0, [_a], void 0, function* ({ newSell, executer, }) {
    try {
        // 1- تسجيل عملية البيع
        const normalizedExecuter = executer || "Unknown";
        const sellWithExecuter = Object.assign(Object.assign({}, newSell), { executer: normalizedExecuter });
        const sellData = yield (0, sells_controller_1.createSellInternal)(sellWithExecuter);
        // 2- تحديث مخزون المنتجات
        console.log(newSell);
        newSell.products.forEach((p) => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, products_controller_1.updateQuantityOnSell)(p.id, p.warehouse, p.qty);
        }));
        // 3- تعديل رصيد المورد (إضافة دين جديد)
        yield (0, customer_controller_1.updateCustomerInternal)(sellData.customerId, sellData);
        if (sellData.remainingDebt == 0) {
            yield (0, payments_controller_1.createPaymentInternal)({
                type: "income",
                customerId: sellData.customerId,
                amount: sellData.totalPrice,
                note: `دفع كامل ثمن بيع`,
                currency: sellData.currency,
                exchangeRate: sellData.exchangeRate,
                amount_base: sellData.exchangeRate * sellData.totalPrice,
                executer: normalizedExecuter,
            });
        }
        else if (sellData.remainingDebt < sellData.totalPrice) {
            // 4- اضافة دفعة في حالة ودجودها
            yield (0, payments_controller_1.createPaymentInternal)({
                type: "income",
                customerId: sellData.customerId,
                amount: sellData.totalPrice - sellData.remainingDebt,
                note: `دفعه من ثمن بيع`,
                currency: sellData.currency,
                exchangeRate: sellData.exchangeRate,
                amount_base: sellData.partValue ||
                    sellData.exchangeRate *
                        (sellData.totalPrice - sellData.remainingDebt),
                executer: normalizedExecuter,
            });
        }
        else if (sellData.remainingDebt == sellData.totalPrice) {
        }
        return sellData;
    }
    catch (err) {
        console.log(err);
    }
});
exports.handleSell = handleSell;
const customerPayment = (paymentData, executer) => __awaiter(void 0, void 0, void 0, function* () {
    // 1- تسجيل عملية الدفع
    const data = yield (0, payments_controller_1.createPaymentInternal)(Object.assign(Object.assign({}, paymentData), { executer: executer || "Unknown" }));
    // 2- تحديث رصيد العميل
    data.customerId
        ? (0, customer_controller_1.updateCustomerInternal)(data.customerId, undefined, paymentData)
        : null;
    return data;
});
exports.customerPayment = customerPayment;
const supplierPayment = (paymentData, executer) => __awaiter(void 0, void 0, void 0, function* () {
    // 1- تسجيل عملية الدفع
    const data = yield (0, payments_controller_1.createPaymentInternal)(Object.assign(Object.assign({}, paymentData), { executer: executer || "Unknown" }));
    // 2- تحديث رصيد المورد
    data.supplierId
        ? (0, suppliers_controller_1.updateSupplierInternal)(data.supplierId, undefined, paymentData)
        : null;
    return data;
});
exports.supplierPayment = supplierPayment;
const handleSupplierReturn = (newReturn) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // 1️⃣ إنشاء سجل الإرجاع
        yield (0, returns_controller_1.createReturnInternal)(Object.assign(Object.assign({}, newReturn), { type: "purchase-return", executer: newReturn.executer || "Unknown" }));
        // 2️⃣ إنشاء سجل مالي
        const paymentAmount = newReturn.returnType === "cash"
            ? newReturn.returnValue
            : newReturn.returnType === "part"
                ? newReturn.partValue
                : 0;
        yield (0, payments_controller_1.createPaymentInternal)({
            type: "return",
            supplierId: newReturn.supplierId,
            amount: paymentAmount,
            note: `اعادة منتجات للمورد (${newReturn.productCode})`,
            currency: "USD",
            exchangeRate: 0,
            amount_base: 0,
            executer: newReturn.executer || "Unknown",
        });
        // 3️⃣ تحديث رصيد المورد
        let balanceChange = 0;
        if (newReturn.returnType === "debt") {
            balanceChange = -newReturn.returnValue;
        }
        else if (newReturn.returnType === "part") {
            balanceChange = -(newReturn.returnValue - newReturn.partValue);
        }
        yield (0, suppliers_controller_1.updateSupplierBalanceInternal)(newReturn.supplierId, balanceChange);
        // 4️⃣ تعديل الكمية في الفاتورة
        const purchase = yield (0, purchases_controller_1.getPurchaseByIdInternal)(newReturn.referenceId);
        const updatedQuantity = ((purchase === null || purchase === void 0 ? void 0 : purchase.quantity) || 0) + newReturn.qty;
        yield (0, purchases_controller_1.updatePurchaseInternal)(newReturn.referenceId, {
            quantity: updatedQuantity,
        });
        // 5️⃣ تحديث مخزون المنتجات
        yield (0, products_controller_1.updateQuantityOnSell)(newReturn.productId, newReturn.warehouse, newReturn.qty);
        return { success: true, message: "تمت عملية الإرجاع بنجاح" };
    }
    catch (error) {
        console.error("خطأ في عملية إرجاع المورد:", error);
        return { success: false, message: "فشلت عملية الإرجاع", error };
    }
});
exports.handleSupplierReturn = handleSupplierReturn;
const normalizeCustomerReturnItems = (newReturn) => {
    const rawItems = Array.isArray(newReturn.items) && newReturn.items.length
        ? newReturn.items
        : newReturn.productCode &&
            newReturn.productId &&
            newReturn.warehouse &&
            newReturn.qty
            ? [
                {
                    productCode: newReturn.productCode,
                    productId: newReturn.productId,
                    warehouse: newReturn.warehouse,
                    qty: newReturn.qty,
                    returnValue: Number(newReturn.returnValue || 0),
                },
            ]
            : [];
    if (!rawItems.length) {
        throw new Error("No return items were provided");
    }
    return rawItems.map((item, idx) => {
        const qty = Math.abs(Number(item.qty || 0));
        const returnValue = Number(item.returnValue || 0);
        if (!item.productCode || !item.productId || !item.warehouse) {
            throw new Error(`Invalid return item at index ${idx}`);
        }
        if (!Number.isFinite(qty) || qty <= 0) {
            throw new Error(`Invalid qty for return item at index ${idx}`);
        }
        if (!Number.isFinite(returnValue) || returnValue < 0) {
            throw new Error(`Invalid return value for item at index ${idx}`);
        }
        return {
            productCode: item.productCode,
            productId: item.productId,
            warehouse: item.warehouse,
            qty,
            returnValue,
        };
    });
};
const handleCustomerReturn = (newReturn) => __awaiter(void 0, void 0, void 0, function* () {
    if (!newReturn.customerId || !newReturn.referenceId || !newReturn.returnType) {
        throw new Error("customerId, referenceId, and returnType are required");
    }
    const items = normalizeCustomerReturnItems(newReturn);
    const totalReturnValue = items.reduce((sum, item) => sum + Number(item.returnValue || 0), 0);
    const partValue = Number(newReturn.partValue || 0);
    if (newReturn.returnType === "part") {
        if (partValue <= 0) {
            throw new Error("partValue must be greater than 0 for partial return");
        }
        if (partValue > totalReturnValue) {
            throw new Error("partValue cannot exceed total return value");
        }
    }
    // 1) Pre-validate everything first (all-or-none at validation stage)
    const sellRef = (0, database_1.ref)(firebaseConfig_1.database, `sells/${newReturn.referenceId}`);
    const sellSnap = yield (0, database_1.get)(sellRef);
    if (!sellSnap.exists()) {
        throw new Error("Sale invoice not found");
    }
    const sellData = sellSnap.val();
    if (sellData.customerId !== newReturn.customerId) {
        throw new Error("Return customer does not match invoice customer");
    }
    const requestedBySellLine = new Map();
    for (const item of items) {
        const key = `${item.productCode}::${item.warehouse}`;
        const current = requestedBySellLine.get(key);
        if (current) {
            current.qty += item.qty;
        }
        else {
            requestedBySellLine.set(key, {
                code: item.productCode,
                warehouse: item.warehouse,
                qty: item.qty,
            });
        }
    }
    for (const requestLine of requestedBySellLine.values()) {
        const soldLine = sellData.products.find((p) => p.code === requestLine.code && p.warehouse === requestLine.warehouse);
        if (!soldLine) {
            throw new Error(`Item ${requestLine.code} not found in invoice ${newReturn.referenceId}`);
        }
        if (requestLine.qty > Number(soldLine.qty || 0)) {
            throw new Error(`Return qty for ${requestLine.code} exceeds sold qty (${soldLine.qty})`);
        }
    }
    for (const item of items) {
        const productSnap = yield (0, database_1.get)((0, database_1.ref)(firebaseConfig_1.database, `products/${item.warehouse}/${item.productId}`));
        if (!productSnap.exists()) {
            throw new Error(`Product ${item.productCode} not found in warehouse ${item.warehouse}`);
        }
    }
    // 2) Apply stock + return records for each item
    for (const item of items) {
        yield (0, returns_controller_1.createReturnInternal)({
            productCode: item.productCode,
            productId: item.productId,
            warehouse: item.warehouse,
            qty: item.qty,
            type: "sale-return",
            referenceId: newReturn.referenceId,
            reason: newReturn.reason || "",
            executer: newReturn.executer || "Unknown",
        });
    }
    // 3) Update invoice one time for all returned items
    const updatedSell = yield (0, sells_controller_1.returnProductsFromSellInternal)(newReturn.referenceId, Array.from(requestedBySellLine.values()).map((line) => ({
        code: line.code,
        warehouse: line.warehouse,
        qty: line.qty,
    })));
    if (!updatedSell) {
        throw new Error("Failed to update sale invoice after return");
    }
    // 4) Financial record once per return operation
    if (newReturn.returnType === "cash" || newReturn.returnType === "part") {
        const paymentAmount = newReturn.returnType === "cash" ? -totalReturnValue : -partValue;
        yield (0, payments_controller_1.createPaymentInternal)({
            type: "return",
            customerId: newReturn.customerId,
            amount: paymentAmount,
            note: `Customer return (${items.length} item(s))`,
            currency: "USD",
            exchangeRate: 0,
            amount_base: 0,
            executer: newReturn.executer || "Unknown",
        });
    }
    // 5) Customer balance change once per operation
    let balanceChange = 0;
    if (newReturn.returnType === "debt") {
        balanceChange = totalReturnValue;
    }
    else if (newReturn.returnType === "part") {
        balanceChange = totalReturnValue - partValue;
    }
    if (balanceChange !== 0) {
        yield (0, customer_controller_1.updateCustomerBalanceInternal)(newReturn.customerId, balanceChange);
    }
    return {
        success: true,
        message: "Customer return completed successfully",
        data: {
            referenceId: newReturn.referenceId,
            itemsCount: items.length,
            totalReturnValue,
            partValue: newReturn.returnType === "part" ? partValue : 0,
        },
    };
});
exports.handleCustomerReturn = handleCustomerReturn;
const warehouseTransfer = (transferData) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const product = yield (0, products_controller_1.getProductByIdInternal)(transferData.productId);
        if (product === null || product === void 0 ? void 0 : product.message) {
            return product === null || product === void 0 ? void 0 : product.message;
        }
        const currentStock = Number(product.product.quantity || 0);
        const stockAfter = currentStock - transferData.quantity;
        if (stockAfter < 0) {
            throw new Error("❌ الكمية غير كافية في المستودع");
        }
        yield (0, transfer_controller_1.createTransferInternal)({
            productId: transferData.productId,
            code: product.product.code,
            name: product.product.name,
            oldWarehouse: transferData.oldWarehouse,
            newWarehouse: transferData.newWarehouse,
            quantity: transferData.quantity,
            amount: transferData.amount,
            currency: transferData.currency,
            stockBefore: currentStock,
            stockAfter: stockAfter,
            executer: transferData.executer || "Unknown",
            referenceId: `TR-${Date.now()}`,
            note: transferData.note,
        });
        //انقاص الكمية من المخزون القديم
        yield (0, products_controller_1.updateQuantityOnSell)(transferData.productId, transferData.oldWarehouse, transferData.quantity);
        //انشاء او تعديل كمية في المستودع الجديد
        yield (0, products_controller_1.createOrUpdateProductInternal)(Object.assign(Object.assign({}, product === null || product === void 0 ? void 0 : product.product), { warehouse: transferData.newWarehouse, quantity: transferData.quantity, sellPrice: transferData.newSellPrice || (product === null || product === void 0 ? void 0 : product.product.sellPrice) }));
        //انشاء فاتورة في حالة وجود تكلفة نقل
        if (transferData.amount > 0) {
            yield (0, payments_controller_1.createPaymentInternal)({
                type: "expense",
                supplierId: "transfer",
                currency: transferData.currency,
                exchangeRate: transferData.exchangeRate,
                amount_base: transferData.amount_base,
                amount: Number(-transferData.amount),
                executer: transferData.executer || "Unknown",
                note: `نقل ${product.product.name} // ${transferData.note}` ||
                    `Transfer: ${product.product.name || transferData.productId}`,
            });
        }
    }
    catch (err) {
        console.log(err);
        return (err);
    }
});
exports.warehouseTransfer = warehouseTransfer;
