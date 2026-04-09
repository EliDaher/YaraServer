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
exports.createUser = exports.login = void 0;
const database_1 = require("firebase/database");
const firebaseConfig_1 = require("../firebaseConfig");
const login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, password, role } = req.body;
    try {
        const dbRef = (0, database_1.ref)(firebaseConfig_1.database, `users/${username}`);
        const snapshot = yield (0, database_1.get)(dbRef);
        if (!snapshot.exists()) {
            return res.status(401).json({ error: "المستخدم غير موجود" });
        }
        const user = snapshot.val();
        if (user.password !== password) {
            return res.status(401).json({ error: "كلمة المرور غير صحيحة" });
        }
        if (role && user.role !== role) {
            return res.status(403).json({ error: "صلاحيات غير مطابقة" });
        }
        // ✅ تسجيل الدخول ناجح
        return res.json({
            message: "تم تسجيل الدخول بنجاح",
            user: {
                username: user.username || username,
                role: user.role,
                permissions: Array.isArray(user.permissions) ? user.permissions : [],
                // يمكن لاحقًا إضافة token JWT هنا
            },
        });
    }
    catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({ error: "حدث خطأ أثناء تسجيل الدخول" });
    }
});
exports.login = login;
const createUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, password, role, permissions } = req.body;
    try {
        const dbRef = (0, database_1.ref)(firebaseConfig_1.database, `users/${username}`);
        const snapshot = yield (0, database_1.get)(dbRef);
        if (snapshot.exists()) {
            return res.status(400).json({ error: "المستخدم موجود بالفعل" });
        }
        const now = new Date().toLocaleString();
        yield (0, database_1.set)(dbRef, {
            username,
            password,
            role,
            permissions: Array.isArray(permissions) ? permissions : [],
            createdAt: now,
            updatedAt: now,
        });
        return res.json({ message: "تم إنشاء المستخدم بنجاح" });
    }
    catch (error) {
        console.error("Create user error:", error);
        return res.status(500).json({ error: "حدث خطأ أثناء إنشاء المستخدم" });
    }
});
exports.createUser = createUser;
