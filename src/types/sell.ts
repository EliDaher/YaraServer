export interface sell {
  id?: string; // معرّف الفاتورة
  customerId: string; // معرف الزبون (يمكن يكون null لو بيع مباشر بدون زبون)
  totalPrice: number; // المجموع الكلي للفاتورة
  paymentStatus: "cash" | "part" | "debt"; // حالة الدفع
  remainingDebt: number; // المبلغ المتبقي على الزبون
  currency: string,
  exchangeRate: number,
  amount_base: number,
  products: {
    productId: string; // معرف المنتج
    code: string; // كود المنتج
    name: string; // اسم المنتج
    warehouse: string; // المستودع
    quantity: number; // الكمية المباعة
    sellPrice: number; // سعر الوحدة عند البيع
    unit?: string; // وحدة القياس (اختياري)
    qty: number; // الكمية المباعة (اختياري)
    totalPrice: number; // السعر الإجمالي (quantity * sellPrice)
  }[];
  date?: string; // تاريخ العملية
  partValue?: number
}
