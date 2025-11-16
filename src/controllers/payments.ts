import { v4 as uuidv4 } from "uuid";
import { Request, Response } from "express";
import { Payment } from "../types/payment";
import { ref, get, set, push } from "firebase/database";
import { database } from "../firebaseConfig";

// ✅ get all payments as array
export const getAll = async (_req: Request, res: Response) => {
  try {
    const dbRef = ref(database, "payment");
    const snapshot = await get(dbRef);
    const payments = snapshot.exists() ? Object.values(snapshot.val()) : [];
    res.json(payments);
  } catch (error: any) {
    console.error("Error fetching payments:", error);
    res.status(500).json({ error: error.message });
  }
};

// ✅ get month payments as array
export const getMonthPayments = async (req: Request, res: Response) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ error: "Month and year are required" });
    }

    const dbRef = ref(database, "payment");
    const snapshot = await get(dbRef);
    const payments = snapshot.exists() ? Object.values(snapshot.val()) : [];

    const filteredPayments = payments.filter((p: any) => {
      const paymentDate = new Date(p.date);
      return (
        paymentDate.getMonth() + 1 === Number(month) &&
        paymentDate.getFullYear() === Number(year)
      );
    });

    res.json(filteredPayments);
  } catch (error: any) {
    console.error("Error filtering payments:", error);
    res.status(500).json({ error: error.message });
  }
};

// ✅ إنشاء دفعة جديدة
export const createPayment = async (req: Request, res: Response) => {
  try {
    const { newPayment }: { newPayment: Payment } = req.body;

    const id = uuidv4();
    const now = new Date().toLocaleString();

    const payment: Payment = {
      ...newPayment,
      id,
      date: now,
    };

    await set(ref(database, `payment/${id}`), payment);

    res.status(201).json(payment);
  } catch (error: any) {
    console.error("Error creating payment:", error);
    res.status(500).json({ error: "فشل في إنشاء الدفعة" });
  }
};

// ✅ إنشاء دفعة جديدة داخليًا (بدون استجابة HTTP)
export const createPaymentInternal = async (
  newPayment: Payment
): Promise<Payment> => {
  const id = uuidv4();
  const now = new Date().toLocaleString();

  const payment: Payment = {
    ...newPayment,
    id,
    date: now,
  };

  await set(ref(database, `payment/${id}`), payment);
  return payment;
};
