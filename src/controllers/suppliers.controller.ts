import { v4 as uuidv4 } from "uuid";
import { Supplier } from "../types/supplier";
import { Request, Response } from "express";
import { purchase } from "../types/purchase";
import { Payment } from "../types/payment";
import { ref, get, set, update, remove } from "firebase/database";
import { database } from "../firebaseConfig";
import { Customer } from "../types/customer";

const toSafeSingleDecimalAmount = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.trunc(value * 10) / 10 : 0;
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();
    if (!trimmedValue) return 0;

    const amountMatch = trimmedValue.match(/^([+-]?\d+)(?:[.,](\d))?/);
    if (!amountMatch) return 0;

    const parsedValue = Number(
      `${amountMatch[1]}${amountMatch[2] ? `.${amountMatch[2]}` : ""}`
    );
    return Number.isFinite(parsedValue) ? parsedValue : 0;
  }

  return 0;
};

// ✅ جلب جميع الموردين
export const getAll = async (_req: Request, res: Response) => {
  try {
    const snapshot = await get(ref(database, "supplier"));
    const suppliers = snapshot.exists() ? Object.values(snapshot.val()) : [];
    res.json(suppliers);
  } catch (error) {
    console.error("❌ خطأ في جلب الموردين:", error);
    res.status(500).json({ message: "حدث خطأ أثناء جلب الموردين" });
  }
};

// ✅ إنشاء أو تحديث مورد
export const create = async (req: Request, res: Response) => {
  try {
    const now = new Date().toLocaleString();
    const newSupplier: Supplier = req.body;
    const id = uuidv4();

    const SupplierToAdd: Supplier = {
      ...newSupplier,
      id,
      createdDate: now,
      updatedDate: now,
    };
    await set(ref(database, `supplier/${id}`), SupplierToAdd);

    res.json({ message: "✅ تم إنشاء المورد", data: SupplierToAdd });
  } catch (error) {
    console.error("❌ خطأ أثناء إنشاء المورد:", error);
    res.status(500).json({ message: "حدث خطأ أثناء إنشاء المورد" });
  }
};

// إنشاء مورد داخلي
export const createSupplierInternal = async (
  newSupplier: Omit<Supplier, "id" | "createdDate" | "updatedDate">
): Promise<Supplier> => {
  const id = uuidv4();
  const now = new Date().toLocaleString();
  const supplier: Supplier = {
    ...newSupplier,
    id,
    createdDate: now,
    updatedDate: now,
  };
  await set(ref(database, `supplier/${id}`), supplier);
  return supplier;
};

export const updateSupplierInfo = async (
  req: Request,
  res: Response
): Promise<Supplier | null> => {
  const { id } = req.params;
  const updates = req.body;

  const dbRef = ref(database, `supplier/${id}`);
  const snapshot = await get(dbRef);
  if (!snapshot.exists()) {
    res.status(404).json({ error: "Supplier not found" });
    return null;
  }

  const supplier = snapshot.val() as Supplier;
  const now = new Date().toLocaleString();

  let updatedSupplier: Supplier = { ...supplier, updatedDate: now, name: updates.name, number: updates.number };
  await update(dbRef, updatedSupplier);
  res.json({ message: "✅ تم تحديث بيانات المورد", data: updatedSupplier });
  return updatedSupplier;
};

// تحديث مورد داخلي (مع شراء أو دفعة)
export const updateSupplierInternal = async (
  id: string,
  sellUpdates?: purchase,
  paymentUpdates?: Payment
): Promise<Supplier | null> => {

  console.log(id, sellUpdates, paymentUpdates);

  const supplierId = typeof id === "string" ? id : (id as any).id;
  if (!supplierId) throw new Error("Invalid supplier id");
  const supplierRef = ref(database, `supplier/${supplierId}`);
  const snapshot = await get(supplierRef);
  if (!snapshot.exists()) return null;

  const supplier = snapshot.val() as Supplier;
  const now = new Date().toLocaleString();

  if (sellUpdates) {
    const currentBalance = toSafeSingleDecimalAmount(supplier.balance);
    const remainingDebt = toSafeSingleDecimalAmount(sellUpdates.remainingDebt);
    const updatedSupplier: Supplier = {
      ...supplier,
      balance: currentBalance + remainingDebt,
      purchases: [...(supplier.purchases || []), sellUpdates.id || ""],
      updatedDate: now,
    };
    await set(supplierRef, updatedSupplier);
    return updatedSupplier;
  }

  if (paymentUpdates) {
    const currentBalance = toSafeSingleDecimalAmount(supplier.balance);
    const paymentAmount = toSafeSingleDecimalAmount(paymentUpdates.amount);
    const updatedSupplier: Supplier = {
      ...supplier,
      balance: currentBalance + paymentAmount,
      updatedDate: now,
    };
    await set(supplierRef, updatedSupplier);
    return updatedSupplier;
  }

  return null;
};

// تحديث الرصيد داخليًا
export const updateSupplierBalanceInternal = async (
  id: string,
  amountChange: number
): Promise<Supplier | null> => {
  const supplierRef = ref(database, `supplier/${id}`);
  const snapshot = await get(supplierRef);
  if (!snapshot.exists()) return null;

  const supplier = snapshot.val() as Supplier;
  const currentBalance = toSafeSingleDecimalAmount(supplier.balance);
  const safeAmountChange = toSafeSingleDecimalAmount(amountChange);
  const updatedSupplier: Supplier = {
    ...supplier,
    balance: currentBalance + safeAmountChange,
    updatedDate: new Date().toLocaleString(),
  };

  await set(supplierRef, updatedSupplier);
  return updatedSupplier;
};

// حذف مورد داخلي
export const deleteSupplierInternal = async (id: string): Promise<boolean> => {
  const supplierRef = ref(database, `supplier/${id}`);
  const snapshot = await get(supplierRef);
  if (!snapshot.exists()) return false;

  await remove(supplierRef);
  return true;
};

// جلب جميع الموردين داخليًا
export const getAllsupplierInternal = async (): Promise<Supplier[]> => {
  const snapshot = await get(ref(database, "supplier"));
  return snapshot.exists() ? Object.values(snapshot.val()) : [];
};

// جلب مورد واحد داخليًا
export const getSupplierByIdInternal = async (
  id: string
): Promise<Supplier | null> => {
  const snapshot = await get(ref(database, `supplier/${id}`));
  return snapshot.exists() ? (snapshot.val() as Supplier) : null;
};

// جلب مورد واحد مع المشتريات والمدفوعات
export const getSupplierById = async (req: Request, res: Response) => {
  try {
    const { id } = req.body;
    const snapshot = await get(ref(database, `supplier/${id}`));
    if (!snapshot.exists()) {
      return res.status(404).json({ error: "Supplier not found" });
    }

    const supplier = snapshot.val() as Supplier;

    const normalizeId = (value: any) =>
      typeof value === "string" ? value : value?.id;

    const findProductId = (purchase: any, productsData: any) => {
      const warehouseProducts = productsData[purchase.warehouse] || {};
      const match = Object.entries(warehouseProducts).find(
        ([productId, product]: [string, any]) =>
          productId === purchase.productId ||
          product?.id === purchase.productId ||
          product?.code === purchase.code
      );

      return match?.[0] || purchase.productId || purchase.code;
    };

    const formatPurchase = (purchase: any, productsData: any) => ({
      ...purchase,
      supplierId: normalizeId(purchase.supplierId),
      productId: findProductId(purchase, productsData),
      transferCost: Number(purchase.transferCost || 0),
    });

    const purchasesSnapshot = await get(ref(database, "purchases"));
    const purchasesData = purchasesSnapshot.exists()
      ? purchasesSnapshot.val()
      : {};
    const productsSnapshot = await get(ref(database, "products"));
    const productsData = productsSnapshot.exists() ? productsSnapshot.val() : {};
    const purchasesById = new Map<string, any>();

    Object.values(purchasesData)
      .filter((purchase: any) => normalizeId(purchase?.supplierId) === id)
      .forEach((purchase: any) => {
        if (purchase?.id) {
          purchasesById.set(purchase.id, formatPurchase(purchase, productsData));
        }
      });

    supplier.purchases
      ?.map((purchaseId: string) => purchasesData[purchaseId])
      .filter(Boolean)
      .forEach((purchase: any) => {
        if (purchase?.id && !purchasesById.has(purchase.id)) {
          purchasesById.set(purchase.id, formatPurchase(purchase, productsData));
        }
      });

    const purchases = Array.from(purchasesById.values());

    // جلب المدفوعات
    const paymentSnapshot = await get(ref(database, "payment"));
    const paymentsData = paymentSnapshot.exists()
      ? Object.values(paymentSnapshot.val())
      : [];
    const payments = paymentsData.filter((p: any) => p.supplierId === id || p?.supplierId?.id === id );

    res.json({ data: { ...supplier, purchases, payments } });
  } catch (error) {
    console.error("❌ خطأ أثناء جلب المورد:", error);
    res.status(500).json({ message: "حدث خطأ أثناء جلب المورد" });
  }
};
