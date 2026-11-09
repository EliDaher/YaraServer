import { decimal, roundNumber, normalizeNumbers, normalizeInvoice } from "../utils/numbers";
import { set, update } from "../utils/database";
import { Request, Response } from "express";
import { ref, get, remove } from "firebase/database";
import { v4 as uuidv4 } from "uuid";
import { sell } from "../types/sell";
import { Payment } from "../types/payment";
import { database } from "../firebaseConfig";
import { resolveOperationDate } from "../utils/operationDate";

// 🧩 جلب جميع فواتير البيع
export const getAllSells = async (_req: Request, res: Response) => {
  try {
    const snapshot = await get(ref(database, "sells"));
    const data = snapshot.exists() ? snapshot.val() : {};
    const sells = Object.values(data);
    res.json(sells);
  } catch (error) {
    console.error("❌ خطأ في جلب فواتير البيع:", error);
    res.status(500).json({ message: "حدث خطأ أثناء جلب فواتير البيع" });
  }
};

// 🧾 إنشاء فاتورة بيع جديدة
export const createSell = async (req: Request, res: Response) => {
  try {
    const id = uuidv4();
    const operationDate = resolveOperationDate(req.body?.date);

    const newSell: sell = {
      ...req.body,
      id,
      date: operationDate,
    };

    Object.assign(
      newSell,
      normalizeInvoice(
        newSell,
        newSell.products.reduce(
          (sum, p) => sum.plus(decimal(roundNumber(p.sellPrice)).times(roundNumber(p.qty))),
          decimal(0)
        ).minus(roundNumber(newSell.discount || 0))
      )
    );
    await set(ref(database, `sells/${id}`), newSell);

    res.json({ message: "✅ تم تسجيل فاتورة البيع", data: newSell });
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid operation date") {
      res.status(400).json({ message: error.message });
      return;
    }
    console.error("❌ خطأ أثناء إنشاء فاتورة البيع:", error);
    res.status(500).json({ message: "حدث خطأ أثناء إنشاء فاتورة البيع" });
  }
};

// 🗑️ حذف فاتورة بيع
export const deleteSell = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const sellRef = ref(database, `sells/${id}`);
    const snapshot = await get(sellRef);

    if (!snapshot.exists()) {
      return res.status(404).json({ message: "❌ فاتورة البيع غير موجودة" });
    }

    await remove(sellRef);
    res.json({ message: "✅ تم حذف فاتورة البيع" });
  } catch (error) {
    console.error("❌ خطأ أثناء حذف فاتورة البيع:", error);
    res.status(500).json({ message: "حدث خطأ أثناء حذف فاتورة البيع" });
  }
};

// ✅ internal helper (للاستخدام داخل functions/transactions.ts)
export const createSellInternal = async (newSell: sell): Promise<sell> => {
  try {
    const id = uuidv4();
    const operationDate = resolveOperationDate(newSell.date);

    const sellData: sell = {
      ...newSell,
      id,
      date: operationDate,
    };

    Object.assign(
      sellData,
      normalizeInvoice(
        sellData,
        sellData.products.reduce(
          (sum, p) => sum.plus(decimal(roundNumber(p.sellPrice)).times(roundNumber(p.qty))),
          decimal(0)
        ).minus(roundNumber(sellData.discount || 0))
      )
    );
    await set(ref(database, `sells/${id}`), sellData);
    return sellData;
  } catch (error) {
    console.error("❌ خطأ أثناء إنشاء فاتورة بيع داخلية:", error);
    throw error;
  }
};

// 🧾 جلب فاتورة بيع حسب ID
export const getSellById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const snapshot = await get(ref(database, `sells/${id}`));

    if (!snapshot.exists()) {
      return res.status(404).json({ message: "❌ فاتورة البيع غير موجودة" });
    }

    const sellData = snapshot.val();

    // جلب بيانات الزبون
    const customerSnap = await get(
      ref(database, `customer/${sellData.customerId}`)
    );
    const customerData = customerSnap.exists() ? customerSnap.val() : {};

    res.json({ ...sellData, customerName: customerData.name || "" });
  } catch (error) {
    console.error("❌ خطأ أثناء جلب الفاتورة:", error);
    res.status(500).json({ message: "حدث خطأ أثناء جلب الفاتورة" });
  }
};

// 🧩 تحديث فاتورة بيع
export const updateSellById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body?.data;

    // ✅ Validation أساسي
    if (!id) {
      return res.status(400).json({ message: "معرف الفاتورة غير صالح" });
    }

    if (!updateData || !Array.isArray(updateData.products)) {
      return res.status(400).json({ message: "بيانات التحديث غير صالحة" });
    }

    const sellRef = ref(database, `sells/${id}`);
    const snapshot = await get(sellRef);

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
      if (!oldP?.warehouse || !oldP?.code || !oldP?.qty) continue;

      const qtyPath = `products/${oldP.warehouse}/${oldP.id}/quantity`;
      const qtyRef = ref(database, qtyPath);
      const qtySnap = await get(qtyRef);

      if (!qtySnap.exists()) {
        return res.status(400).json({
          message: `المنتج غير موجود في المخزون: ${oldP.code}`,
        });
      }

      const currentQty = Number(qtySnap.val());
      const restoredQty = roundNumber(decimal(currentQty).plus(oldP.qty));

      await set(qtyRef, restoredQty);
    }

    // 2️⃣ خصم الكميات الجديدة
    for (const newP of updateData.products) {
      if (!newP?.warehouse || !newP?.code || !newP?.qty) {
        return res.status(400).json({
          message: "بيانات منتج غير صالحة",
        });
      }

      const qtyPath = `products/${newP.warehouse}/${newP.id}/quantity`;
      const qtyRef = ref(database, qtyPath);
      const qtySnap = await get(qtyRef);
        
      if (!qtySnap.exists()) {
        return res.status(400).json({
          message: `المنتج غير موجود في المخزون: ${newP.code}`,
        });
      }

      const currentQty = Number(qtySnap.val());
      const newQty = roundNumber(decimal(currentQty).minus(newP.qty));

      if (newQty < 0) {
        return res.status(400).json({
          message: `❌ الكمية غير كافية للمنتج ${newP.code}`,
        });
      }

      await set(qtyRef, newQty);
    }

    // =========================
    // 🔢 تحديث الفاتورة
    // =========================

    sellData.products = updateData.products;

    const newTotalPrice = roundNumber(sellData.products.reduce(
      (sum: ReturnType<typeof decimal>, p: any) =>
        sum.plus(decimal(p.sellPrice || 0).times(p.qty || 0)),
      decimal(0)
    ).minus(sellData.discount || 0));

    const paidAmount = decimal(oldTotalPrice).minus(sellData.remainingDebt || 0);
    sellData.remainingDebt = roundNumber(decimal(newTotalPrice).minus(paidAmount));
    sellData.totalPrice = newTotalPrice;
    sellData.updatedAt = new Date().toISOString();

    // =========================
    // 💰 تحديث رصيد العميل
    // =========================

    const customerRef = ref(database, `customer/${sellData.customerId}`);
    const customerSnap = await get(customerRef);

    if (!customerSnap.exists()) {
      return res.status(400).json({
        message: "العميل غير موجود",
      });
    }

    const customer = customerSnap.val();
    const currentBalance = Number(customer.balance || 0);
    console.log(currentBalance, oldTotalPrice, newTotalPrice);
    const newBalance = roundNumber(decimal(currentBalance).plus(oldTotalPrice).minus(newTotalPrice));

    await update(customerRef, {
      balance: newBalance,
    });

    // =========================
    // 🧾 تسجيل حركة مالية
    // =========================

    const paymentId = uuidv4();

    const payment: Payment = {
      id: paymentId,
      type: "sell_edit",
      source: "generated",
      balanceApplied: false,
      customerId: sellData.customerId,
      currency: sellData.currency || "",
      exchangeRate: 1,
      amount_base: newTotalPrice,
      amount: newTotalPrice,
      note: `تعديل على فاتورة بيع - ${id}`,
      date: new Date().toISOString(),
    };

    await set(ref(database, `payment/${paymentId}`), payment);

    // =========================
    // 💾 حفظ الفاتورة
    // =========================

    await update(sellRef, sellData);

    return res.json({
      message: "✅ تم تحديث الفاتورة بنجاح",
      sell: sellData,
    });
  } catch (error: any) {
    console.error("❌ خطأ أثناء تحديث فاتورة البيع:", error);

    return res.status(500).json({
      message: "حدث خطأ أثناء تحديث الفاتورة",
      error: error?.message,
    });
  }
};

// 🗑️ حذف فاتورة بيع بالكامل مع إرجاع المخزون وتعديل الرصيد
export const deleteSellById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const sellRef = ref(database, `sells/${id}`);
    const snapshot = await get(sellRef);

    if (!snapshot.exists()) {
      return res.status(404).json({ message: "❌ فاتورة البيع غير موجودة" });
    }

    const sellData = snapshot.val();

    // 🧩 استرجاع الكميات في المخزون
    const productsSnap = await get(ref(database, "products"));
    const products = productsSnap.exists() ? productsSnap.val() : {};

    for (const p of sellData.products) {
      const warehouse = p.warehouse;
      const code = p.id || p.code;
      if (products[warehouse] && products[warehouse][code]) {
        products[warehouse][code].quantity = roundNumber(decimal(products[warehouse][code].quantity).plus(p.qty));
      }
    }

    await update(ref(database, "products"), products);

    // 💰 تعديل رصيد الزبون
    const customerRef = ref(database, `customer/${sellData.customerId}`);
    const customerSnap = await get(customerRef);
    if (customerSnap.exists()) {
      const customer = customerSnap.val();
      customer.balance = roundNumber(decimal(customer.balance || 0).plus(sellData.remainingDebt || 0));
      await update(customerRef, customer);
    }

    // 🧾 تسجيل العملية كدفعة حذف
    const paymentId = uuidv4();
    const payment: Payment = {
      type: "sell_delete",
      source: "generated",
      balanceApplied: false,
      customerId: sellData.customerId,
      currency: sellData.currency || "",
      exchangeRate: 1,
      amount_base: 0,
      amount: 0,
      note: `حذف فاتورة بيع - ${sellData.id}`,
      id: paymentId,
      date: new Date().toLocaleString(),
    };
    await set(ref(database, `payment/${paymentId}`), payment);

    // حذف الفاتورة
    await remove(sellRef);

    res.json({
      message: `✅ تم حذف الفاتورة ${id} وإرجاع المخزون وتحديث رصيد الزبون.`,
    });
  } catch (error) {
    console.error("❌ خطأ أثناء حذف فاتورة البيع:", error);
    res.status(500).json({ message: "حدث خطأ أثناء حذف فاتورة البيع" });
  }
};

export const returnProductsFromSellInternal = async (
  sellId: string,
  returnedProducts: { code: string; warehouse: string; qty: number }[]
): Promise<{ updatedSell: sell; totalRefund: number } | null> => {
  returnedProducts = normalizeNumbers(returnedProducts);
  const sellRef = ref(database, `sells/${sellId}`);
  const sellSnap = await get(sellRef);
  if (!sellSnap.exists()) return null;

  const sellData: sell = sellSnap.val();
  const originalTotal = sellData.totalPrice;
  let totalRefund = decimal(0);

  for (const { code, warehouse, qty } of returnedProducts) {
    const product = sellData.products.find(
      (p) => p.code === code && p.warehouse === warehouse
    );
    if (!product) continue;

    const returnedQty = Math.min(product.qty, qty);
    product.qty = roundNumber(decimal(product.qty).minus(returnedQty));
    totalRefund = totalRefund.plus(decimal(returnedQty).times(product.sellPrice));
  }

  sellData.products = sellData.products.filter((p) => p.qty > 0);
  sellData.totalPrice = roundNumber(decimal(originalTotal).minus(totalRefund));

  await update(sellRef, sellData);

  return { updatedSell: sellData, totalRefund: roundNumber(totalRefund) };
};


// جلب المبيعات حسب المستودع والتاريخ
export const getSalesByWarehouseAndDate = async (
  req: Request,
  res: Response,
) => {
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

    const snapshot = await get(ref(database, "sells"));

    if (!snapshot.exists()) {
      return res.json({ sales: [] });
    }

    const salesArray = Object.values(snapshot.val());

    const filteredSales = salesArray.filter((sale: any) => {
      if (!sale.date || !sale.products) return false;

      const saleDate = new Date(sale.date).toLocaleDateString("en-CA", {
        timeZone: "Asia/Damascus",
      });

      const sameDate = saleDate === date;

      const hasWarehouseProduct = sale.products.some(
        (product: any) => product.warehouse === warehouse,
      );

      return sameDate && hasWarehouseProduct;
    });

    res.json({ sales: filteredSales });
  } catch (error) {
    console.error("❌ خطأ في جلب المبيعات:", error);
    res.status(500).json({ sales: [], message: "خطأ في السيرفر" });
  }
};

export const addAfterSellDiscountInternal = async ({sellId, discount}: {sellId: string, discount: number}) => {
  try {
    if (!sellId || discount == null) {
      return { message: "sellId و discount مطلوبان" };
    }
    
    const sellRef = ref(database, `sells/${sellId}`);
    const sellSnap = await get(sellRef);
    if (!sellSnap.exists()) {
      return { message: "فاتورة البيع غير موجودة" };
    }

    const sellData: sell = sellSnap.val();
    discount = roundNumber(discount);
    sellData.discount = discount;
    sellData.totalPrice = roundNumber(decimal(sellData.totalPrice || 0).minus(discount));
    sellData.remainingDebt = roundNumber(decimal(sellData.remainingDebt || 0).minus(discount));

    await update(sellRef, sellData);

    return { message: "✅ تم إضافة الخصم بعد البيع", data: sellData };
  } catch (error) {
    console.error("❌ خطأ في إضافة الخصم بعد البيع:", error);
    return { message: "حدث خطأ أثناء إضافة الخصم" };
  }

}
