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
exports.getByWarehouse = exports.getProductByIdInternal = exports.createOrUpdateProductInternal = exports.deleteProduct = exports.updateProduct = exports.updateQuantityOnSell = exports.create = exports.getProductById = exports.getAll = void 0;
const database_1 = require("firebase/database");
const firebaseConfig_1 = require("../firebaseConfig");
let productsCache = null;
let lastFetch = 0;
let compareTime = 45000;
const fetchReset = () => {
    lastFetch = Date.now() - compareTime;
};
const getAll = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (productsCache && Date.now() - lastFetch < compareTime) {
            return res.json(productsCache);
        }
        const snapshot = yield (0, database_1.get)((0, database_1.ref)(firebaseConfig_1.database, "products"));
        const products = snapshot.exists()
            ? Object.entries(snapshot.val()).flatMap(([categoryName, items]) => Object.entries(items).map(([id, product]) => (Object.assign({ id, category: categoryName }, product))))
            : [];
        // تحديث الكاش
        productsCache = products;
        lastFetch = Date.now();
        res.json(products);
    }
    catch (error) {
        console.error("❌ خطأ في جلب المنتجات:", error);
        res.status(500).json({ message: "حدث خطأ أثناء جلب المنتجات" });
    }
});
exports.getAll = getAll;
// ✅ جلب منتج واحد حسب id + المشتريات والمبيعات
const getProductById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.body;
        if (!id)
            return res.status(400).json({ message: "product id is required" });
        const productsSnapshot = yield (0, database_1.get)((0, database_1.ref)(firebaseConfig_1.database, "products"));
        if (!productsSnapshot.exists())
            return res.status(404).json({ message: "المنتج غير موجود" });
        const warehouses = productsSnapshot.val();
        let foundProduct = null;
        let foundWarehouse = null;
        for (const warehouse in warehouses) {
            for (const productId in warehouses[warehouse]) {
                const p = warehouses[warehouse][productId];
                if (p.id === id) {
                    foundProduct = p;
                    foundWarehouse = warehouse;
                    break;
                }
            }
            if (foundProduct)
                break;
        }
        if (!foundProduct)
            return res.status(404).json({ message: "❌ المنتج غير موجود" });
        const transfersSnapshot = yield (0, database_1.get)((0, database_1.ref)(firebaseConfig_1.database, "warehouseTransfers"));
        const transfersData = transfersSnapshot.exists()
            ? transfersSnapshot.val()
            : {};
        const transfers = Object.values(transfersData)
            .filter((t) => t.productId === foundProduct.id ||
            t.productCode === foundProduct.code)
            .map((t) => (Object.assign(Object.assign({}, t), { executer: t.executer || t.performedBy || "Unknown", performedBy: t.executer || t.performedBy || "Unknown", type: "transfer" })));
        // جلب المشتريات
        const purchasesSnapshot = yield (0, database_1.get)((0, database_1.ref)(firebaseConfig_1.database, "purchases"));
        const purchasesData = purchasesSnapshot.exists()
            ? purchasesSnapshot.val()
            : {};
        const supplierSnapshot = yield (0, database_1.get)((0, database_1.ref)(firebaseConfig_1.database, "supplier"));
        const supplierData = supplierSnapshot.exists()
            ? supplierSnapshot.val()
            : {};
        const purchases = Object.values(purchasesData)
            .filter((p) => p.code === foundProduct.code &&
            p.warehouse === foundProduct.warehouse)
            .map((p) => {
            var _a;
            return (Object.assign(Object.assign({}, p), { transferCost: Number(p.transferCost || 0), supplierName: ((_a = supplierData[p.supplierId]) === null || _a === void 0 ? void 0 : _a.name) || "مورد غير معروف" }));
        });
        // جلب المبيعات
        const sellsSnapshot = yield (0, database_1.get)((0, database_1.ref)(firebaseConfig_1.database, "sells"));
        const sellsData = sellsSnapshot.exists() ? sellsSnapshot.val() : {};
        const customerSnapshot = yield (0, database_1.get)((0, database_1.ref)(firebaseConfig_1.database, "customer"));
        const customerData = customerSnapshot.exists()
            ? customerSnapshot.val()
            : {};
        const sells = Object.values(sellsData)
            .filter((sell) => {
            var _a;
            return (_a = sell.products) === null || _a === void 0 ? void 0 : _a.some((prod) => prod.code === foundProduct.code &&
                prod.warehouse === foundProduct.warehouse);
        })
            .map((sell) => {
            var _a;
            const matchedProduct = sell.products.find((prod) => prod.code === foundProduct.code &&
                prod.warehouse === foundProduct.warehouse);
            return Object.assign(Object.assign({}, sell), { totalPrice: matchedProduct
                    ? matchedProduct.sellPrice * matchedProduct.qty
                    : 0, quantity: matchedProduct ? matchedProduct.qty : 0, customerName: ((_a = customerData[sell.customerId]) === null || _a === void 0 ? void 0 : _a.name) || "زبون غير معروف" });
        });
        res.json({ product: foundProduct, purchases, sells, transfers });
    }
    catch (error) {
        console.error("❌ خطأ في جلب المنتج:", error);
        res.status(500).json({ message: "حدث خطأ أثناء جلب المنتج" });
    }
});
exports.getProductById = getProductById;
const create = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const newProduct = req.body;
        if (!newProduct.warehouse)
            return res.status(400).json({ message: "warehouse is required" });
        const NowDate = new Date().toLocaleString();
        const warehouseRef = (0, database_1.ref)(firebaseConfig_1.database, `products/${newProduct.warehouse}`);
        const newRef = (0, database_1.push)(warehouseRef);
        const productData = Object.assign(Object.assign({}, newProduct), { id: newRef.key, updatedDate: NowDate });
        yield (0, database_1.set)(newRef, productData);
        fetchReset();
        res.json({
            message: "تم إنشاء المنتج بنجاح",
            data: productData,
        });
    }
    catch (error) {
        console.error("❌ خطأ أثناء إنشاء المنتج:", error);
        res.status(500).json({ message: "حدث خطأ أثناء إنشاء المنتج" });
    }
});
exports.create = create;
// ✅ تحديث كمية المنتج بعد بيع داخليًا
const updateQuantityOnSell = (productId, warehouse, soldQuantity) => __awaiter(void 0, void 0, void 0, function* () {
    const productRef = (0, database_1.ref)(firebaseConfig_1.database, `products/${warehouse}/${productId}`);
    console.log(soldQuantity);
    const snapshot = yield (0, database_1.get)(productRef);
    if (!snapshot.exists())
        return null;
    const existingProduct = snapshot.val();
    if (existingProduct.quantity < soldQuantity) {
        console.log(`❌ الكمية غير كافية. المتاح: ${existingProduct.quantity}, المطلوب: ${soldQuantity}`);
        throw new Error(`❌ الكمية غير كافية. المتاح: ${existingProduct.quantity}, المطلوب: ${soldQuantity}`);
    }
    console.log(existingProduct);
    fetchReset();
    const newQuantity = existingProduct.quantity - soldQuantity;
    existingProduct.quantity = newQuantity;
    existingProduct.updatedDate = new Date().toLocaleString();
    console.log(existingProduct);
    yield (0, database_1.set)(productRef, existingProduct);
    return existingProduct;
});
exports.updateQuantityOnSell = updateQuantityOnSell;
const updateProduct = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const updatedFields = req.body;
        const snapshot = yield (0, database_1.get)((0, database_1.ref)(firebaseConfig_1.database, "products"));
        if (!snapshot.exists())
            return res.status(404).json({ message: "المنتج غير موجود" });
        const warehouses = snapshot.val();
        fetchReset();
        for (const warehouse in warehouses) {
            for (const productId in warehouses[warehouse]) {
                if (productId === id) {
                    const newData = Object.assign(Object.assign(Object.assign({}, warehouses[warehouse][productId]), updatedFields), { updatedDate: new Date().toLocaleString() });
                    yield (0, database_1.set)((0, database_1.ref)(firebaseConfig_1.database, `products/${warehouse}/${productId}`), newData);
                    return res.json({ message: "تم تحديث المنتج", data: newData });
                }
            }
        }
        res.status(404).json({ message: "المنتج غير موجود" });
    }
    catch (error) {
        console.error("❌ خطأ أثناء تحديث المنتج:", error);
        res.status(500).json({ message: "حدث خطأ أثناء تحديث المنتج" });
    }
});
exports.updateProduct = updateProduct;
const deleteProduct = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const snapshot = yield (0, database_1.get)((0, database_1.ref)(firebaseConfig_1.database, "products"));
        if (!snapshot.exists())
            return res.status(404).json({ message: "المنتج غير موجود" });
        const warehouses = snapshot.val();
        for (const warehouse in warehouses) {
            for (const productId in warehouses[warehouse]) {
                if (productId === id) {
                    yield (0, database_1.remove)((0, database_1.ref)(firebaseConfig_1.database, `products/${warehouse}/${productId}`));
                    return res.json({ message: "تم حذف المنتج" });
                }
            }
        }
        fetchReset();
        res.status(404).json({ message: "المنتج غير موجود" });
    }
    catch (error) {
        console.error("❌ خطأ أثناء حذف المنتج:", error);
        res.status(500).json({ message: "حدث خطأ أثناء حذف المنتج" });
    }
});
exports.deleteProduct = deleteProduct;
const createOrUpdateProductInternal = (newProduct) => __awaiter(void 0, void 0, void 0, function* () {
    const NowDate = new Date().toLocaleString();
    const warehousePath = `products/${newProduct.warehouse}`;
    const warehouseRef = (0, database_1.ref)(firebaseConfig_1.database, warehousePath);
    // 1) قراءة كل المنتجات داخل نفس المستودع
    const snapshot = yield (0, database_1.get)(warehouseRef);
    if (snapshot.exists()) {
        const products = snapshot.val();
        // 2) البحث عن منتج بنفس code
        for (const productId in products) {
            const existingProduct = products[productId];
            if (existingProduct.code === newProduct.code) {
                // تحديث المنتج
                const updatedProduct = Object.assign(Object.assign(Object.assign({}, existingProduct), newProduct), { quantity: existingProduct.quantity + newProduct.quantity, updatedDate: NowDate, id: productId });
                // حفظ التحديث
                yield (0, database_1.set)((0, database_1.ref)(firebaseConfig_1.database, `${warehousePath}/${productId}`), updatedProduct);
                return updatedProduct;
            }
        }
    }
    // 3) إذا لم يوجد منتج بنفس code → نقوم بالإنشاء
    const newRef = (0, database_1.push)(warehouseRef);
    const productToAdd = Object.assign(Object.assign({}, newProduct), { updatedDate: NowDate, id: newRef.key });
    yield (0, database_1.set)(newRef, productToAdd);
    fetchReset();
    return productToAdd;
});
exports.createOrUpdateProductInternal = createOrUpdateProductInternal;
// ✅ جلب منتج واحد حسب id + المشتريات والمبيعات
const getProductByIdInternal = (id) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!id)
            return { message: "product id is required" };
        const productsSnapshot = yield (0, database_1.get)((0, database_1.ref)(firebaseConfig_1.database, "products"));
        if (!productsSnapshot.exists())
            return { message: "المنتج غير موجود" };
        const warehouses = productsSnapshot.val();
        let foundProduct = null;
        let foundWarehouse = null;
        for (const warehouse in warehouses) {
            for (const productId in warehouses[warehouse]) {
                const p = warehouses[warehouse][productId];
                if (p.id === id) {
                    foundProduct = p;
                    foundWarehouse = warehouse;
                    break;
                }
            }
            if (foundProduct)
                break;
        }
        if (!foundProduct)
            return { message: "❌ المنتج غير موجود" };
        return { product: foundProduct };
    }
    catch (error) {
        console.error("❌ خطأ في جلب المنتج:", error);
        return { message: "حدث خطأ أثناء جلب المنتج" };
    }
});
exports.getProductByIdInternal = getProductByIdInternal;
const getByWarehouse = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { warehouse } = req.body;
        console.log(warehouse);
        const productsSnapshot = yield (0, database_1.get)((0, database_1.ref)(firebaseConfig_1.database, `products/${warehouse}`));
        if (!productsSnapshot.exists()) {
            return res.json({ products: [] });
        }
        const data = productsSnapshot.val();
        const products = Object.values(data);
        res.json({ products });
    }
    catch (error) {
        console.error("❌ خطأ في جلب المنتجات:", error);
        res
            .status(500)
            .json({ products: [], message: "حدث خطأ أثناء جلب المنتجات" });
    }
});
exports.getByWarehouse = getByWarehouse;
