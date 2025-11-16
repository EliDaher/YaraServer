import { Request, Response } from "express";
import { ref, get } from "firebase/database";
import { database } from "../firebaseConfig";

export const login = async (req: Request, res: Response) => {
  const { username, password, role } = req.body;

  console.log(username + "//" + password);

  try {
    const dbRef = ref(database, `users/${username}`);
    const snapshot = await get(dbRef);

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
        // يمكن لاحقًا إضافة token JWT هنا
      },
    });
  } catch (error: any) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "حدث خطأ أثناء تسجيل الدخول" });
  }
};
