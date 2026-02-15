export interface sell {
  id?: string; // معرّف الفاتورة
  customerId: string; // معرف الزبون (يمكن يكون null لو بيع مباشر بدون زبون)
  totalPrice: number; // المجموع الكلي للفاتورة
  paymentStatus: "cash" | "part" | "debt"; // حالة الدفع
  remainingDebt: number; // المبلغ المتبقي على الزبون
  currency: string;
  exchangeRate: number;
  amount_base: number;
  products: {
    category: string;
    code: string;
    id: string;
    name: string;
    payPrice: number;
    quantity: number;
    sellPrice: number;
    unit: string;
    updatedDate: string;
    warehouse: string;
    qty: number;
  }[];
  date?: string; // تاريخ العملية
  partValue?: number;
  discount?: number;
}
