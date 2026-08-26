import { v4 as uuidv4 } from "uuid";
import { Request, Response } from "express";
import { Payment } from "../types/payment";
import { ref, get, remove, set } from "firebase/database";
import { database } from "../firebaseConfig";
import { updateCustomerBalanceInternal } from "./customer.controller";
import { updateSupplierBalanceInternal } from "./suppliers.controller";

const generatedNotePatterns = [
  "دفعة من ثمن شراء",
  "دفع كامل ثمن شراء",
  "دفع كامل ثمن بيع",
  "دفعه من ثمن بيع",
  "اعادة منتجات للمورد",
  "Customer return",
  "transfer/shipping cost",
  "Transfer:",
  "نقل ",
];

const isGeneratedLegacyPayment = (payment: Payment) => {
  if (payment.source === "generated") return true;
  if (payment.type === "return" || payment.type === "sell_delete" || payment.type === "sell_edit") {
    return true;
  }
  if (payment.supplierId === "transfer") return true;

  const note = payment.note || "";
  return generatedNotePatterns.some((pattern) => note.includes(pattern));
};

const shouldReverseBalance = (payment: Payment) => {
  if (payment.balanceApplied === true) return true;
  if (payment.balanceApplied === false) return false;
  if (payment.source === "cashbox") return false;

  return !isGeneratedLegacyPayment(payment) && Boolean(payment.customerId || payment.supplierId);
};

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
      date: newPayment.date || now,
      source: newPayment.source || "cashbox",
      balanceApplied: newPayment.balanceApplied ?? false,
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
    date: newPayment.date || now,
    source: newPayment.source || "generated",
    balanceApplied: newPayment.balanceApplied ?? false,
  };

  await set(ref(database, `payment/${id}`), payment);
  return payment;
};

export const deletePayment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const paymentRef = ref(database, `payment/${id}`);
    const snapshot = await get(paymentRef);

    if (!snapshot.exists()) {
      return res.status(404).json({ error: "Payment not found" });
    }

    const payment = snapshot.val() as Payment;

    if (isGeneratedLegacyPayment(payment)) {
      return res.status(400).json({
        error:
          "لا يمكن حذف هذه الدفعة لأنها مرتبطة بفاتورة أو عملية أخرى. عدّل العملية الأصلية بدلاً من ذلك.",
      });
    }

    if (shouldReverseBalance(payment)) {
      if (payment.customerId) {
        await updateCustomerBalanceInternal(payment.customerId, -Number(payment.amount || 0));
      }

      if (payment.supplierId && payment.supplierId !== "elidaher") {
        await updateSupplierBalanceInternal(payment.supplierId, -Number(payment.amount || 0));
      }
    }

    await remove(paymentRef);
    res.json({ message: "Payment deleted successfully", data: payment });
  } catch (error: any) {
    console.error("Error deleting payment:", error);
    res.status(500).json({ error: error.message || "فشل في حذف الدفعة" });
  }
};
