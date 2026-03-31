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
const customer_controller_1 = require("../controllers/customer.controller");
const payments_controller_1 = require("../controllers/payments.controller");
const products_controller_1 = require("../controllers/products.controller");
const purchases_controller_1 = require("../controllers/purchases.controller");
const returns_controller_1 = require("../controllers/returns.controller");
const sells_controller_1 = require("../controllers/sells.controller");
const suppliers_controller_1 = require("../controllers/suppliers.controller");
const transfer_controller_1 = require("../controllers/transfer.controller");
// ✅ عند تنفيذ عملية شراء
const handlePurchase = (_a) => __awaiter(void 0, [_a], void 0, function* ({ newPurchase, newProduct, }) {
    // 1- تسجيل عملية الشراء
    const transferCost = Number(newPurchase.transferCost || 0);
    const purchaseData = yield (0, purchases_controller_1.createPurchaseInternal)(newPurchase);
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
        });
    }
    return purchaseData;
});
exports.handlePurchase = handlePurchase;
// ✅ عند تنفيذ عملية بيع
const handleSell = (_a) => __awaiter(void 0, [_a], void 0, function* ({ newSell }) {
    try {
        // 1- تسجيل عملية البيع
        const sellData = yield (0, sells_controller_1.createSellInternal)(newSell);
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
const customerPayment = (paymentData) => __awaiter(void 0, void 0, void 0, function* () {
    // 1- تسجيل عملية الدفع
    const data = yield (0, payments_controller_1.createPaymentInternal)(paymentData);
    // 2- تحديث رصيد العميل
    data.customerId
        ? (0, customer_controller_1.updateCustomerInternal)(data.customerId, undefined, paymentData)
        : null;
    return data;
});
exports.customerPayment = customerPayment;
const supplierPayment = (paymentData) => __awaiter(void 0, void 0, void 0, function* () {
    // 1- تسجيل عملية الدفع
    const data = yield (0, payments_controller_1.createPaymentInternal)(paymentData);
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
        yield (0, returns_controller_1.createReturnInternal)(Object.assign(Object.assign({}, newReturn), { type: "purchase-return" }));
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
const handleCustomerReturn = (newReturn) => __awaiter(void 0, void 0, void 0, function* () {
    //1- انشاء سجل اعادة
    yield (0, returns_controller_1.createReturnInternal)(Object.assign(Object.assign({}, newReturn), { qty: -newReturn.qty, type: "sale-return" }));
    //2- انشاء سجل مالي
    yield (0, payments_controller_1.createPaymentInternal)({
        type: "return",
        customerId: newReturn.customerId,
        amount: -(newReturn.returnType == "cash"
            ? newReturn.returnValue
            : newReturn.returnType == "part"
                ? newReturn.partValue
                : 0),
        note: `اعادة منتجات من الزبون (${newReturn.productCode} عدد ${newReturn.qty})`,
        currency: "USD",
        exchangeRate: 0,
        amount_base: 0,
    });
    //3- تحديث رصيد الزبون
    newReturn.returnType == "debt"
        ? yield (0, customer_controller_1.updateCustomerBalanceInternal)(newReturn.customerId, newReturn.returnValue)
        : (yield newReturn.returnType) == "part"
            ? (0, customer_controller_1.updateCustomerBalanceInternal)(newReturn.customerId, newReturn.returnValue - newReturn.partValue)
            : yield (0, customer_controller_1.updateCustomerBalanceInternal)(newReturn.customerId, 0);
    //4- تعديل الكمية في الفاتورة
    yield (0, sells_controller_1.returnProductsFromSellInternal)(newReturn.referenceId, [
        {
            code: newReturn.productCode,
            warehouse: newReturn.warehouse,
            qty: -newReturn.qty,
        },
    ]);
    // //5- تعديل الكمية في المخزون
    // await updateQuantityOnSell(
    //   newReturn.productId,
    //   newReturn.warehouse,
    //   newReturn.qty
    // );
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
            performedBy: "admin", // لاحقًا اربطها بالجلسة
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
