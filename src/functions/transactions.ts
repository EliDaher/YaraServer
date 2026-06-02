import { get, ref } from "firebase/database";
import {
  updateCustomerBalanceInternal,
  updateCustomerInternal,
} from "../controllers/customer.controller";
import { createPaymentInternal } from "../controllers/payments.controller";
import {
  createOrUpdateProductInternal,
  getProductById,
  getProductByIdInternal,
  updateQuantityOnSell,
} from "../controllers/products.controller";
import {
  createPurchaseInternal,
  getPurchaseByIdInternal,
  updatePurchaseInternal,
} from "../controllers/purchases.controller";
import { createReturnInternal, ReturnData } from "../controllers/returns.controller";
import {
  createSellInternal,
  getSellById,
  returnProductsFromSellInternal,
  updateSellById,
} from "../controllers/sells.controller";
import {
  updateSupplierBalanceInternal,
  updateSupplierInternal,
} from "../controllers/suppliers.controller";
import { Payment } from "../types/payment";
import { Product } from "../types/product";
import { purchase } from "../types/purchase";
import { sell } from "../types/sell";
import { createTransferInternal } from "../controllers/transfer.controller";
import { database } from "../firebaseConfig";

// ✅ عند تنفيذ عملية شراء
export const handlePurchase = async ({
  newPurchase,
  newProduct,
  executer,
}: {
  newPurchase: purchase;
  newProduct: Product;
  executer?: string;
}) => {
  // 1- تسجيل عملية الشراء
  const normalizedExecuter = executer || "Unknown";
  const purchaseWithExecuter: purchase = {
    ...newPurchase,
    executer: normalizedExecuter,
  };
  const transferCost = Number(newPurchase.transferCost || 0);
  const purchaseData = await createPurchaseInternal(purchaseWithExecuter);

  // 2- تحديث مخزون المنتجات
  await createOrUpdateProductInternal(newProduct);

  // 3- تعديل رصيد المورد (إضافة دين جديد)
  await updateSupplierInternal(purchaseData.supplierId, purchaseData);

  // 4- اضافة دفعة في حالة ودجودها
  if (
    purchaseData.remainingDebt > 0 &&
    purchaseData.remainingDebt < purchaseData.totalPrice
  ) {
    await createPaymentInternal({
      type: "expense",
      supplierId: purchaseData.supplierId,
      amount: -(purchaseData.totalPrice - purchaseData.remainingDebt),
      note: `${newProduct.name} دفعة من ثمن شراء`,
      currency: newPurchase.currency,
      exchangeRate: newPurchase.exchangeRate,
      amount_base: -(
        newPurchase.exchangeRate *
        (purchaseData.totalPrice - purchaseData.remainingDebt)
      ),
      date: purchaseData.date,
      executer: normalizedExecuter,
    });
  } else if (purchaseData.remainingDebt == 0) {
    // 5- دين كامل
    await createPaymentInternal({
      type: "expense",
      supplierId: purchaseData.supplierId,
      amount: -purchaseData.totalPrice,
      note: `${newProduct.name} دفع كامل ثمن شراء`,
      currency: newPurchase.currency,
      exchangeRate: newPurchase.exchangeRate,
      amount_base: -(newPurchase.exchangeRate * purchaseData.totalPrice),
      date: purchaseData.date,
      executer: normalizedExecuter,
    });
  } else if (purchaseData.remainingDebt == purchaseData.totalPrice) {
  }

  if (transferCost > 0) {
    await createPaymentInternal({
      type: "expense",
      supplierId: purchaseData.supplierId,
      amount: -transferCost,
      note: `${newProduct.name} transfer/shipping cost`,
      currency: newPurchase.currency,
      exchangeRate: newPurchase.exchangeRate,
      amount_base: -(newPurchase.exchangeRate * transferCost),
      date: purchaseData.date,
      executer: normalizedExecuter,
    });
  }

  return purchaseData;
};

// ✅ عند تنفيذ عملية بيع
export const handleSell = async ({
  newSell,
  executer,
}: {
  newSell: sell;
  executer?: string;
}) => {
  try {
    // 1- تسجيل عملية البيع
    const normalizedExecuter = executer || "Unknown";
    const sellWithExecuter: sell = {
      ...newSell,
      executer: normalizedExecuter,
    };
    const sellData = await createSellInternal(sellWithExecuter);

    // 2- تحديث مخزون المنتجات
    console.log(newSell)
    newSell.products.forEach(async (p) => {
      await updateQuantityOnSell(p.id, p.warehouse, p.qty);
    });

    // 3- تعديل رصيد المورد (إضافة دين جديد)
    await updateCustomerInternal(sellData.customerId, sellData);

    if (sellData.remainingDebt == 0) {
      await createPaymentInternal({
        type: "income",
        customerId: sellData.customerId,
        amount: sellData.totalPrice,
        note: `دفع كامل ثمن بيع`,
        currency: sellData.currency,
        exchangeRate: sellData.exchangeRate,
        amount_base: sellData.exchangeRate * sellData.totalPrice,
        date: sellData.date,
        executer: normalizedExecuter,
      });
    } else if (sellData.remainingDebt < sellData.totalPrice) {
      // 4- اضافة دفعة في حالة ودجودها
      await createPaymentInternal({
        type: "income",
        customerId: sellData.customerId,
        amount: sellData.totalPrice - sellData.remainingDebt,
        note: `دفعه من ثمن بيع`,
        currency: sellData.currency,
        exchangeRate: sellData.exchangeRate,
        amount_base:
          sellData.partValue ||
          sellData.exchangeRate *
            (sellData.totalPrice - sellData.remainingDebt),
        date: sellData.date,
        executer: normalizedExecuter,
      });
    } else if (sellData.remainingDebt == sellData.totalPrice) {
    }

    return sellData;
  } catch (err) {
    console.log(err);
  }
};

export const customerPayment = async (
  paymentData: Payment,
  executer?: string
) => {
  // 1- تسجيل عملية الدفع
  const data = await createPaymentInternal({
    ...paymentData,
    executer: executer || "Unknown",
  });

  // 2- تحديث رصيد العميل
  data.customerId
    ? updateCustomerInternal(data.customerId, undefined, paymentData)
    : null;

  return data;
};

export const supplierPayment = async (
  paymentData: Payment,
  executer?: string
) => {
  // 1- تسجيل عملية الدفع
  const data = await createPaymentInternal({
    ...paymentData,
    executer: executer || "Unknown",
  });

  // 2- تحديث رصيد المورد
  data.supplierId
    ? updateSupplierInternal(data.supplierId, undefined, paymentData)
    : null;

  return data;
};

export const handleSupplierReturn = async (newReturn: {
  productCode: string;
  supplierId: string;
  warehouse: string;
  qty: number;
  returnValue: number;
  referenceId: string;
  partValue: number;
  productId: string;
  returnType: "debt" | "cash" | "part";
  reason: string;
  executer?: string;
}) => {
  try {
    // 1️⃣ إنشاء سجل الإرجاع
    await createReturnInternal({
      ...newReturn,
      type: "purchase-return",
      executer: newReturn.executer || "Unknown",
    });

    // 2️⃣ إنشاء سجل مالي
    const paymentAmount =
      newReturn.returnType === "cash"
        ? newReturn.returnValue
        : newReturn.returnType === "part"
        ? newReturn.partValue
        : 0;

    await createPaymentInternal({
      type: "return",
      supplierId: newReturn.supplierId,
      amount: paymentAmount,
      note: `اعادة منتجات للمورد (${newReturn.productCode})`,
      currency: "USD",
      exchangeRate: 0,
      amount_base: 0,
      executer: newReturn.executer || "Unknown",
    });

    // 3️⃣ تحديث رصيد المورد
    let balanceChange = 0;
    if (newReturn.returnType === "debt") {
      balanceChange = -newReturn.returnValue;
    } else if (newReturn.returnType === "part") {
      balanceChange = -(newReturn.returnValue - newReturn.partValue);
    }
    await updateSupplierBalanceInternal(newReturn.supplierId, balanceChange);

    // 4️⃣ تعديل الكمية في الفاتورة
    const purchase = await getPurchaseByIdInternal(newReturn.referenceId);
    const updatedQuantity = (purchase?.quantity || 0) + newReturn.qty;

    await updatePurchaseInternal(newReturn.referenceId, {
      quantity: updatedQuantity,
    });

    // 5️⃣ تحديث مخزون المنتجات
    await updateQuantityOnSell(
      newReturn.productId,
      newReturn.warehouse,
      newReturn.qty
    );

    return { success: true, message: "تمت عملية الإرجاع بنجاح" };
  } catch (error) {
    console.error("خطأ في عملية إرجاع المورد:", error);
    return { success: false, message: "فشلت عملية الإرجاع", error };
  }
};

type CustomerReturnType = "debt" | "cash" | "part";

type CustomerReturnItem = {
  productCode: string;
  productId: string;
  warehouse: string;
  qty: number;
  returnValue: number;
};

type CustomerReturnPayload = {
  customerId: string;
  referenceId: string;
  returnType: CustomerReturnType;
  partValue: number;
  reason: string;
  executer?: string;
  items?: CustomerReturnItem[];
  // Legacy single-item shape (kept for backward compatibility)
  productCode?: string;
  productId?: string;
  warehouse?: string;
  qty?: number;
  returnValue?: number;
};

const normalizeCustomerReturnItems = (
  newReturn: CustomerReturnPayload
): CustomerReturnItem[] => {
  const rawItems =
    Array.isArray(newReturn.items) && newReturn.items.length
      ? newReturn.items
      : newReturn.productCode &&
          newReturn.productId &&
          newReturn.warehouse &&
          newReturn.qty
        ? [
            {
              productCode: newReturn.productCode,
              productId: newReturn.productId,
              warehouse: newReturn.warehouse,
              qty: newReturn.qty,
              returnValue: Number(newReturn.returnValue || 0),
            },
          ]
        : [];

  if (!rawItems.length) {
    throw new Error("No return items were provided");
  }

  return rawItems.map((item, idx) => {
    const qty = Math.abs(Number(item.qty || 0));
    const returnValue = Number(item.returnValue || 0);

    if (!item.productCode || !item.productId || !item.warehouse) {
      throw new Error(`Invalid return item at index ${idx}`);
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error(`Invalid qty for return item at index ${idx}`);
    }
    if (!Number.isFinite(returnValue) || returnValue < 0) {
      throw new Error(`Invalid return value for item at index ${idx}`);
    }

    return {
      productCode: item.productCode,
      productId: item.productId,
      warehouse: item.warehouse,
      qty,
      returnValue,
    };
  });
};

export const handleCustomerReturn = async (newReturn: CustomerReturnPayload) => {
  if (!newReturn.customerId || !newReturn.referenceId || !newReturn.returnType) {
    throw new Error("customerId, referenceId, and returnType are required");
  }

  const items = normalizeCustomerReturnItems(newReturn);
  const totalReturnValue = items.reduce(
    (sum, item) => sum + Number(item.returnValue || 0),
    0
  );
  const partValue = Number(newReturn.partValue || 0);

  if (newReturn.returnType === "part") {
    if (partValue <= 0) {
      throw new Error("partValue must be greater than 0 for partial return");
    }
    if (partValue > totalReturnValue) {
      throw new Error("partValue cannot exceed total return value");
    }
  }

  // 1) Pre-validate everything first (all-or-none at validation stage)
  const sellRef = ref(database, `sells/${newReturn.referenceId}`);
  const sellSnap = await get(sellRef);
  if (!sellSnap.exists()) {
    throw new Error("Sale invoice not found");
  }

  const sellData = sellSnap.val() as sell;
  if (sellData.customerId !== newReturn.customerId) {
    throw new Error("Return customer does not match invoice customer");
  }

  const requestedBySellLine = new Map<
    string,
    { code: string; warehouse: string; qty: number }
  >();

  for (const item of items) {
    const key = `${item.productCode}::${item.warehouse}`;
    const current = requestedBySellLine.get(key);
    if (current) {
      current.qty += item.qty;
    } else {
      requestedBySellLine.set(key, {
        code: item.productCode,
        warehouse: item.warehouse,
        qty: item.qty,
      });
    }
  }

  for (const requestLine of requestedBySellLine.values()) {
    const soldLine = sellData.products.find(
      (p) =>
        p.code === requestLine.code && p.warehouse === requestLine.warehouse
    );
    if (!soldLine) {
      throw new Error(
        `Item ${requestLine.code} not found in invoice ${newReturn.referenceId}`
      );
    }
    if (requestLine.qty > Number(soldLine.qty || 0)) {
      throw new Error(
        `Return qty for ${requestLine.code} exceeds sold qty (${soldLine.qty})`
      );
    }
  }

  for (const item of items) {
    const productSnap = await get(
      ref(database, `products/${item.warehouse}/${item.productId}`)
    );
    if (!productSnap.exists()) {
      throw new Error(
        `Product ${item.productCode} not found in warehouse ${item.warehouse}`
      );
    }
  }

  // 2) Apply stock + return records for each item
  for (const item of items) {
    await createReturnInternal({
      productCode: item.productCode,
      productId: item.productId,
      warehouse: item.warehouse,
      qty: item.qty,
      type: "sale-return",
      referenceId: newReturn.referenceId,
      reason: newReturn.reason || "",
      executer: newReturn.executer || "Unknown",
    });
  }

  // 3) Update invoice one time for all returned items
  const updatedSell = await returnProductsFromSellInternal(
    newReturn.referenceId,
    Array.from(requestedBySellLine.values()).map((line) => ({
      code: line.code,
      warehouse: line.warehouse,
      qty: line.qty,
    }))
  );

  if (!updatedSell) {
    throw new Error("Failed to update sale invoice after return");
  }

  // 4) Financial record once per return operation
  if (newReturn.returnType === "cash" || newReturn.returnType === "part") {
    const paymentAmount =
      newReturn.returnType === "cash" ? -totalReturnValue : -partValue;

    await createPaymentInternal({
      type: "return",
      customerId: newReturn.customerId,
      amount: paymentAmount,
      note: `Customer return (${items.length} item(s))`,
      currency: "USD",
      exchangeRate: 0,
      amount_base: 0,
      executer: newReturn.executer || "Unknown",
    });
  }

  // 5) Customer balance change once per operation
  let balanceChange = 0;
  if (newReturn.returnType === "debt") {
    balanceChange = totalReturnValue;
  } else if (newReturn.returnType === "part") {
    balanceChange = totalReturnValue - partValue;
  }

  if (balanceChange !== 0) {
    await updateCustomerBalanceInternal(newReturn.customerId, balanceChange);
  }

  return {
    success: true,
    message: "Customer return completed successfully",
    data: {
      referenceId: newReturn.referenceId,
      itemsCount: items.length,
      totalReturnValue,
      partValue: newReturn.returnType === "part" ? partValue : 0,
    },
  };
};

export const warehouseTransfer = async (transferData: {
  productId: string;
  oldWarehouse: string;
  newWarehouse: string;
  exchangeRate: number;
  amount_base: number;
  amount: number;
  currency: string;
  quantity: number;
  note: string;
  newSellPrice?: number;
  executer?: string;
}) => {

  try{

    const product = await getProductByIdInternal(transferData.productId);

    if (product?.message) {
      return product?.message;
    }

    const currentStock = Number(product.product.quantity || 0);
    const stockAfter = currentStock - transferData.quantity;

    if (stockAfter < 0) {
      throw new Error("❌ الكمية غير كافية في المستودع");
    }


    await createTransferInternal({
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

      executer: transferData.executer || "Unknown",
      referenceId: `TR-${Date.now()}`,

      note: transferData.note,
    });



    //انقاص الكمية من المخزون القديم
    await updateQuantityOnSell(
      transferData.productId,
      transferData.oldWarehouse,
      transferData.quantity
    );

    //انشاء او تعديل كمية في المستودع الجديد
    await createOrUpdateProductInternal({
      ...product?.product,
      warehouse: transferData.newWarehouse,
      quantity: transferData.quantity,
      sellPrice: transferData.newSellPrice || product?.product.sellPrice,
    });

    //انشاء فاتورة في حالة وجود تكلفة نقل
    if (transferData.amount > 0) {
      await createPaymentInternal({
        type: "expense",
        supplierId: "transfer",
        currency: transferData.currency,
        exchangeRate: transferData.exchangeRate,
        amount_base: transferData.amount_base,
        amount: Number(-transferData.amount),
        executer: transferData.executer || "Unknown",
        note:
          `نقل ${product.product.name} // ${transferData.note}` ||
          `Transfer: ${product.product.name || transferData.productId}`,
      });
    }
  
  } catch (err) {
    console.log(err)
    return (err)
  }
};
