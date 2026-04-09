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
exports.getUserOperations = exports.getOperations = exports.deleteUser = exports.updateUser = exports.createUser = exports.listUsers = exports.requireAdminUser = void 0;
const database_1 = require("firebase/database");
const firebaseConfig_1 = require("../firebaseConfig");
const MODULE_PERMISSIONS = [
    "dashboard",
    "products",
    "sell_product",
    "suppliers",
    "customers",
    "financial_statement",
    "warehouses",
    "categories",
    "users",
];
const asRecord = (value) => value && typeof value === "object" ? value : {};
const toArray = (value) => Object.values(asRecord(value));
const asString = (value) => typeof value === "string" ? value.trim() : "";
const toNumber = (value) => {
    const parsed = Number(value !== null && value !== void 0 ? value : 0);
    return Number.isFinite(parsed) ? parsed : 0;
};
const normalizePermissions = (permissions) => {
    if (!Array.isArray(permissions)) {
        return [];
    }
    const filtered = permissions.filter((permission) => typeof permission === "string" &&
        MODULE_PERMISSIONS.includes(permission));
    return Array.from(new Set(filtered));
};
const normalizeRole = (role) => {
    if (role === "admin" || role === "staff") {
        return role;
    }
    return null;
};
const normalizeExecuter = (row) => asString(row.executer) || asString(row.performedBy) || "Unknown";
const normalizeDateString = (value) => {
    if (typeof value === "number") {
        const numericDate = new Date(value);
        return Number.isNaN(numericDate.getTime())
            ? new Date(0).toISOString()
            : numericDate.toISOString();
    }
    const stringDate = asString(value);
    if (!stringDate) {
        return new Date(0).toISOString();
    }
    const parsed = Date.parse(stringDate);
    return Number.isNaN(parsed) ? new Date(0).toISOString() : stringDate;
};
const toTimestamp = (value) => {
    if (typeof value === "number") {
        return value;
    }
    const parsed = Date.parse(asString(value));
    return Number.isNaN(parsed) ? 0 : parsed;
};
const requireAdminUser = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const executer = asString(req.header("x-executer"));
        if (!executer) {
            return res.status(401).json({ error: "x-executer header is required" });
        }
        const snapshot = yield (0, database_1.get)((0, database_1.ref)(firebaseConfig_1.database, `users/${executer}`));
        if (!snapshot.exists()) {
            return res.status(403).json({ error: "Forbidden" });
        }
        const user = asRecord(snapshot.val());
        if (user.role !== "admin") {
            return res.status(403).json({ error: "Forbidden" });
        }
        res.locals.executer = executer;
        next();
    }
    catch (error) {
        console.error("Admin guard error:", error);
        return res.status(500).json({ error: "Failed to authorize request" });
    }
});
exports.requireAdminUser = requireAdminUser;
const listUsers = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const snapshot = yield (0, database_1.get)((0, database_1.ref)(firebaseConfig_1.database, "users"));
        if (!snapshot.exists()) {
            return res.json([]);
        }
        const usersObject = asRecord(snapshot.val());
        const users = Object.entries(usersObject).map(([key, value]) => {
            const user = asRecord(value);
            return {
                username: asString(user.username) || key,
                role: asString(user.role) || "staff",
                permissions: normalizePermissions(user.permissions),
                createdAt: asString(user.createdAt) || "",
                updatedAt: asString(user.updatedAt) || "",
            };
        });
        users.sort((a, b) => a.username.localeCompare(b.username));
        return res.json(users);
    }
    catch (error) {
        console.error("List users error:", error);
        return res.status(500).json({ error: "Failed to list users" });
    }
});
exports.listUsers = listUsers;
const createUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    try {
        const username = asString((_a = req.body) === null || _a === void 0 ? void 0 : _a.username);
        const password = asString((_b = req.body) === null || _b === void 0 ? void 0 : _b.password);
        const role = normalizeRole((_c = req.body) === null || _c === void 0 ? void 0 : _c.role);
        if (!username || !password || !role) {
            return res
                .status(400)
                .json({ error: "username, password and valid role are required" });
        }
        const userRef = (0, database_1.ref)(firebaseConfig_1.database, `users/${username}`);
        const existingUser = yield (0, database_1.get)(userRef);
        if (existingUser.exists()) {
            return res.status(400).json({ error: "User already exists" });
        }
        const permissions = role === "admin"
            ? [...MODULE_PERMISSIONS]
            : normalizePermissions((_d = req.body) === null || _d === void 0 ? void 0 : _d.permissions);
        const now = new Date().toLocaleString();
        const userToSave = {
            username,
            password,
            role,
            permissions,
            createdAt: now,
            updatedAt: now,
        };
        yield (0, database_1.set)(userRef, userToSave);
        return res.status(201).json({
            message: "User created successfully",
            user: {
                username: userToSave.username,
                role: userToSave.role,
                permissions: userToSave.permissions,
                createdAt: userToSave.createdAt,
                updatedAt: userToSave.updatedAt,
            },
        });
    }
    catch (error) {
        console.error("Create user error:", error);
        return res.status(500).json({ error: "Failed to create user" });
    }
});
exports.createUser = createUser;
const updateUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        const username = asString(req.params.username);
        if (!username) {
            return res.status(400).json({ error: "username is required" });
        }
        const userRef = (0, database_1.ref)(firebaseConfig_1.database, `users/${username}`);
        const snapshot = yield (0, database_1.get)(userRef);
        if (!snapshot.exists()) {
            return res.status(404).json({ error: "User not found" });
        }
        const existing = asRecord(snapshot.val());
        let role = existing.role;
        if (((_a = req.body) === null || _a === void 0 ? void 0 : _a.role) != null) {
            const normalizedRole = normalizeRole(req.body.role);
            if (!normalizedRole) {
                return res.status(400).json({ error: "Invalid role value" });
            }
            role = normalizedRole;
        }
        const password = ((_b = req.body) === null || _b === void 0 ? void 0 : _b.password) != null
            ? asString(req.body.password)
            : asString(existing.password);
        if (!password) {
            return res
                .status(400)
                .json({ error: "password cannot be empty when updating user" });
        }
        const permissions = role === "admin"
            ? [...MODULE_PERMISSIONS]
            : ((_c = req.body) === null || _c === void 0 ? void 0 : _c.permissions) != null
                ? normalizePermissions(req.body.permissions)
                : normalizePermissions(existing.permissions);
        const updated = {
            username,
            password,
            role,
            permissions,
            createdAt: asString(existing.createdAt) || new Date().toLocaleString(),
            updatedAt: new Date().toLocaleString(),
        };
        yield (0, database_1.set)(userRef, updated);
        return res.json({
            message: "User updated successfully",
            user: {
                username: updated.username,
                role: updated.role,
                permissions: updated.permissions,
                createdAt: updated.createdAt,
                updatedAt: updated.updatedAt,
            },
        });
    }
    catch (error) {
        console.error("Update user error:", error);
        return res.status(500).json({ error: "Failed to update user" });
    }
});
exports.updateUser = updateUser;
const deleteUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const username = asString(req.params.username);
        if (!username) {
            return res.status(400).json({ error: "username is required" });
        }
        const currentExecuter = asString(res.locals.executer);
        if (currentExecuter === username) {
            return res.status(400).json({ error: "You cannot delete your own user" });
        }
        const userRef = (0, database_1.ref)(firebaseConfig_1.database, `users/${username}`);
        const snapshot = yield (0, database_1.get)(userRef);
        if (!snapshot.exists()) {
            return res.status(404).json({ error: "User not found" });
        }
        yield (0, database_1.remove)(userRef);
        return res.json({ message: "User deleted successfully" });
    }
    catch (error) {
        console.error("Delete user error:", error);
        return res.status(500).json({ error: "Failed to delete user" });
    }
});
exports.deleteUser = deleteUser;
const normalizeOperations = (purchases, sells, payments, returns, transfers, discounts) => {
    const purchaseOps = purchases.map((purchase) => {
        const row = asRecord(purchase);
        const id = asString(row.id) || asString(row.referenceId);
        return {
            id: id || `purchase-${Math.random()}`,
            type: "purchase",
            executer: normalizeExecuter(row),
            date: normalizeDateString(row.date),
            referenceId: id || "-",
            amount: toNumber(row.totalPrice),
            currency: asString(row.currency),
            details: asString(row.name) ||
                asString(row.code) ||
                `Purchase supplier:${asString(row.supplierId)}`,
        };
    });
    const sellOps = sells.map((sell) => {
        const row = asRecord(sell);
        const id = asString(row.id) || asString(row.referenceId);
        return {
            id: id || `sell-${Math.random()}`,
            type: "sell",
            executer: normalizeExecuter(row),
            date: normalizeDateString(row.date),
            referenceId: id || "-",
            amount: toNumber(row.totalPrice),
            currency: asString(row.currency),
            details: `Sell customer:${asString(row.customerId)}`,
        };
    });
    const paymentOps = payments.map((payment) => {
        const row = asRecord(payment);
        const id = asString(row.id) || asString(row.referenceId);
        return {
            id: id || `payment-${Math.random()}`,
            type: `payment:${asString(row.type) || "entry"}`,
            executer: normalizeExecuter(row),
            date: normalizeDateString(row.date),
            referenceId: id || "-",
            amount: toNumber(row.amount),
            currency: asString(row.currency),
            details: asString(row.note) || "Payment operation",
        };
    });
    const returnOps = returns.map((returnRow) => {
        const row = asRecord(returnRow);
        const id = asString(row.id) || asString(row.referenceId);
        return {
            id: id || `return-${Math.random()}`,
            type: asString(row.type) || "return",
            executer: normalizeExecuter(row),
            date: normalizeDateString(row.createdDate || row.date),
            referenceId: asString(row.referenceId) || id || "-",
            amount: toNumber(row.returnValue),
            currency: asString(row.currency),
            details: `${asString(row.productCode) || "item"} qty:${toNumber(row.qty)}`,
        };
    });
    const transferOps = transfers.map((transfer) => {
        const row = asRecord(transfer);
        const id = asString(row.transferId) || asString(row.referenceId);
        return {
            id: id || `transfer-${Math.random()}`,
            type: "warehouse_transfer",
            executer: normalizeExecuter(row),
            date: normalizeDateString(row.createdAt || row.date),
            referenceId: asString(row.referenceId) || id || "-",
            amount: toNumber(row.cost || row.amount),
            currency: asString(row.currency),
            details: `${asString(row.productName)} ${asString(row.fromWarehouse)} -> ${asString(row.toWarehouse)}`.trim(),
        };
    });
    const discountOps = discounts.map((discount) => {
        const row = asRecord(discount);
        const id = asString(row.id) || asString(row.referenceId);
        return {
            id: id || `discount-${Math.random()}`,
            type: "after_sell_discount",
            executer: normalizeExecuter(row),
            date: normalizeDateString(row.date),
            referenceId: asString(row.referenceId) || "-",
            amount: toNumber(row.amount),
            currency: asString(row.currency),
            details: asString(row.details) ||
                `After-sell discount for sell ${asString(row.referenceId)}`,
        };
    });
    return [
        ...purchaseOps,
        ...sellOps,
        ...paymentOps,
        ...returnOps,
        ...transferOps,
        ...discountOps,
    ]
        .map((operation) => (Object.assign(Object.assign({}, operation), { executer: operation.executer || "Unknown" })))
        .sort((a, b) => toTimestamp(b.date) - toTimestamp(a.date));
};
const getAllOperationsInternal = () => __awaiter(void 0, void 0, void 0, function* () {
    const [purchasesSnapshot, sellsSnapshot, paymentsSnapshot, returnsSnapshot, transfersSnapshot, discountsSnapshot,] = yield Promise.all([
        (0, database_1.get)((0, database_1.ref)(firebaseConfig_1.database, "purchases")),
        (0, database_1.get)((0, database_1.ref)(firebaseConfig_1.database, "sells")),
        (0, database_1.get)((0, database_1.ref)(firebaseConfig_1.database, "payment")),
        (0, database_1.get)((0, database_1.ref)(firebaseConfig_1.database, "returns")),
        (0, database_1.get)((0, database_1.ref)(firebaseConfig_1.database, "warehouseTransfers")),
        (0, database_1.get)((0, database_1.ref)(firebaseConfig_1.database, "discountOperations")),
    ]);
    return normalizeOperations(toArray(purchasesSnapshot.val()), toArray(sellsSnapshot.val()), toArray(paymentsSnapshot.val()), toArray(returnsSnapshot.val()), toArray(transfersSnapshot.val()), toArray(discountsSnapshot.val()));
});
const getOperations = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const operations = yield getAllOperationsInternal();
        const limit = Number(req.query.limit);
        const normalizedLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : operations.length;
        return res.json(operations.slice(0, normalizedLimit));
    }
    catch (error) {
        console.error("Get operations error:", error);
        return res.status(500).json({ error: "Failed to load operations" });
    }
});
exports.getOperations = getOperations;
const getUserOperations = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const username = asString(req.params.username);
        if (!username) {
            return res.status(400).json({ error: "username is required" });
        }
        const operations = yield getAllOperationsInternal();
        const userOperations = operations.filter((operation) => operation.executer === username);
        return res.json(userOperations);
    }
    catch (error) {
        console.error("Get user operations error:", error);
        return res.status(500).json({ error: "Failed to load user operations" });
    }
});
exports.getUserOperations = getUserOperations;
