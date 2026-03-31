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
exports.migrateWarehousesFromExistingData = exports.deactivateWarehouseInternal = exports.getWarehouseByIdInternal = exports.getAllWarehousesInternal = exports.deleteWarehouseInternal = exports.updateWarehouseInternal = exports.createWarehouseInternal = exports.create = exports.getAll = void 0;
const uuid_1 = require("uuid");
const database_1 = require("firebase/database");
const firebaseConfig_1 = require("../firebaseConfig");
/* =========================================================
   ✅ 1. جلب جميع المستودعات
   ========================================================= */
const getAll = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const dbRef = (0, database_1.ref)(firebaseConfig_1.database, "warehouses");
        const snapshot = yield (0, database_1.get)(dbRef);
        res.json(snapshot.exists() ? Object.values(snapshot.val()) : []);
    }
    catch (error) {
        console.error("Error fetching warehouses:", error);
        res.status(500).json({ error: error.message });
    }
});
exports.getAll = getAll;
/* =========================================================
   ✅ 2. إنشاء مستودع جديد
   ========================================================= */
const create = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const now = new Date().toLocaleString();
        const id = (0, uuid_1.v4)();
        const newWarehouse = {
            id,
            name: req.body.name,
            location: req.body.location || "",
            isActive: true,
            createdDate: now,
            updatedDate: now,
        };
        yield (0, database_1.set)((0, database_1.ref)(firebaseConfig_1.database, `warehouses/${id}`), newWarehouse);
        res.json({
            message: "✅ تم إنشاء المستودع بنجاح",
            data: newWarehouse,
        });
    }
    catch (error) {
        console.error("Error creating warehouse:", error);
        res.status(500).json({ error: error.message });
    }
});
exports.create = create;
/* =========================================================
   ✅ 3. إنشاء مستودع داخليًا
   ========================================================= */
const createWarehouseInternal = (data) => __awaiter(void 0, void 0, void 0, function* () {
    const id = (0, uuid_1.v4)();
    const now = new Date().toLocaleString();
    const warehouse = Object.assign(Object.assign({}, data), { id, createdDate: now, updatedDate: now });
    yield (0, database_1.set)((0, database_1.ref)(firebaseConfig_1.database, `warehouses/${id}`), warehouse);
    return warehouse;
});
exports.createWarehouseInternal = createWarehouseInternal;
/* =========================================================
   ✅ 4. تحديث مستودع داخليًا
   ========================================================= */
const updateWarehouseInternal = (id, updates) => __awaiter(void 0, void 0, void 0, function* () {
    const dbRef = (0, database_1.ref)(firebaseConfig_1.database, `warehouses/${id}`);
    const snapshot = yield (0, database_1.get)(dbRef);
    if (!snapshot.exists())
        return null;
    const warehouse = snapshot.val();
    const updatedWarehouse = Object.assign(Object.assign(Object.assign({}, warehouse), updates), { updatedDate: new Date().toLocaleString() });
    yield (0, database_1.update)(dbRef, updatedWarehouse);
    return updatedWarehouse;
});
exports.updateWarehouseInternal = updateWarehouseInternal;
/* =========================================================
   ✅ 5. حذف مستودع داخليًا
   ⚠️ يفضل تعطيله بدل الحذف الحقيقي
   ========================================================= */
const deleteWarehouseInternal = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const dbRef = (0, database_1.ref)(firebaseConfig_1.database, `warehouses/${id}`);
    const snapshot = yield (0, database_1.get)(dbRef);
    if (!snapshot.exists())
        return false;
    yield (0, database_1.remove)(dbRef);
    return true;
});
exports.deleteWarehouseInternal = deleteWarehouseInternal;
/* =========================================================
   ✅ 6. جلب جميع المستودعات داخليًا
   ========================================================= */
const getAllWarehousesInternal = () => __awaiter(void 0, void 0, void 0, function* () {
    const dbRef = (0, database_1.ref)(firebaseConfig_1.database, "warehouses");
    const snapshot = yield (0, database_1.get)(dbRef);
    return snapshot.exists() ? Object.values(snapshot.val()) : [];
});
exports.getAllWarehousesInternal = getAllWarehousesInternal;
/* =========================================================
   ✅ 7. جلب مستودع واحد داخليًا
   ========================================================= */
const getWarehouseByIdInternal = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const dbRef = (0, database_1.ref)(firebaseConfig_1.database, `warehouses/${id}`);
    const snapshot = yield (0, database_1.get)(dbRef);
    return snapshot.exists() ? snapshot.val() : null;
});
exports.getWarehouseByIdInternal = getWarehouseByIdInternal;
/* =========================================================
   ✅ 8. تعطيل مستودع بدل الحذف (Best Practice)
   ========================================================= */
const deactivateWarehouseInternal = (id) => __awaiter(void 0, void 0, void 0, function* () {
    return (0, exports.updateWarehouseInternal)(id, { isActive: false });
});
exports.deactivateWarehouseInternal = deactivateWarehouseInternal;
/* =========================================================
   🚀 إنشاء المستودعات تلقائيًا من البيانات الحالية
   ========================================================= */
const migrateWarehousesFromExistingData = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const warehouseSet = new Set();
        console.log("🔍 Scanning existing warehouses...");
        // 1️⃣ من products
        const productsSnap = yield (0, database_1.get)((0, database_1.ref)(firebaseConfig_1.database, "products"));
        if (productsSnap.exists()) {
            productsSnap.forEach(warehouseNode => {
                if (warehouseNode.key) {
                    warehouseSet.add(warehouseNode.key);
                }
            });
        }
        // 2️⃣ من purchases
        const purchasesSnap = yield (0, database_1.get)((0, database_1.ref)(firebaseConfig_1.database, "purchases"));
        if (purchasesSnap.exists()) {
            purchasesSnap.forEach(p => {
                var _a;
                const w = (_a = p.val()) === null || _a === void 0 ? void 0 : _a.warehouse;
                if (w)
                    warehouseSet.add(w);
            });
        }
        // 3️⃣ من returns
        const returnsSnap = yield (0, database_1.get)((0, database_1.ref)(firebaseConfig_1.database, "returns"));
        if (returnsSnap.exists()) {
            returnsSnap.forEach(r => {
                var _a;
                const w = (_a = r.val()) === null || _a === void 0 ? void 0 : _a.warehouse;
                if (w)
                    warehouseSet.add(w);
            });
        }
        // 4️⃣ من sells → products[]
        const sellsSnap = yield (0, database_1.get)((0, database_1.ref)(firebaseConfig_1.database, "sells"));
        if (sellsSnap.exists()) {
            sellsSnap.forEach(sell => {
                var _a;
                const products = ((_a = sell.val()) === null || _a === void 0 ? void 0 : _a.products) || [];
                products.forEach((p) => {
                    if (p.warehouse)
                        warehouseSet.add(p.warehouse);
                });
            });
        }
        const warehouses = [...warehouseSet].filter(Boolean);
        if (!warehouses.length) {
            return res.json({
                message: "⚠️ لم يتم العثور على أي مستودعات.",
                count: 0,
            });
        }
        const now = new Date().toLocaleString();
        const updates = {};
        const skipped = [];
        warehouses.forEach((rawName) => {
            const cleanName = String(rawName).trim();
            if (!cleanName) {
                skipped.push(rawName);
                return;
            }
            // 🔹 إنشاء id بطريقة آمنة
            let id = cleanName
                .toLowerCase()
                .replace(/\s+/g, "_") // استبدال المسافات بـ _
                .replace(/[^a-z0-9_]/g, ""); // إزالة الرموز غير المسموح بها
            // 🔹 إذا أصبح فارغ بعد التنظيف، نضيف رقم فريد صغير
            if (!id) {
                id = "warehouse_" + Math.floor(Math.random() * 10000);
            }
            // 🔹 إذا هذا الـ id موجود مسبقًا في updates، أضف suffix لتجنب الاستبدال
            let finalId = id;
            let counter = 1;
            while (updates[finalId]) {
                finalId = id + "_" + counter;
                counter++;
            }
            updates[finalId] = {
                id: finalId,
                name: cleanName,
                location: "",
                isActive: true,
                createdDate: now,
                updatedDate: now,
            };
        });
        if (!Object.keys(updates).length) {
            return res.status(400).json({
                message: "❌ لم يتم إنشاء أي مستودع بسبب أسماء غير صالحة",
                skipped,
            });
        }
        yield (0, database_1.update)((0, database_1.ref)(firebaseConfig_1.database, "warehouses"), updates);
        res.json({
            message: "✅ تم إنشاء المستودعات بنجاح",
            count: warehouses.length,
            warehouses,
        });
    }
    catch (error) {
        console.error("❌ Migration error:", error);
        res.status(500).json({ error: error.message });
    }
});
exports.migrateWarehousesFromExistingData = migrateWarehousesFromExistingData;
