import { update } from "firebase/database";
import { updateCustomerBalanceInternal, updateCustomerInternal } from "../controllers/customer";
import { createPaymentInternal } from "../controllers/payments";
import { createOrUpdateProductInternal, updateQuantityOnSell,  } from "../controllers/products";
import { createPurchaseInternal, getPurchaseByIdInternal, updatePurchaseInternal } from "../controllers/purchases";
import { createReturnInternal, ReturnData } from "../controllers/returns";
import { createSellInternal, getSellById, returnProductsFromSellInternal, updateSellById } from "../controllers/sells";
import { updateSupplierBalanceInternal, updateSupplierInternal } from "../controllers/suppliers";
import { Payment } from "../types/payment";
import { Product } from "../types/product";
import { purchase } from "../types/purchase";
import { sell } from "../types/sell";

// ✅ عند تنفيذ عملية شراء
export const handlePurchase = async ({newPurchase, newProduct}: {newPurchase: purchase, newProduct: Product}) => {

    // 1- تسجيل عملية الشراء
    const purchaseData = await createPurchaseInternal(newPurchase);

    // 2- تحديث مخزون المنتجات
    createOrUpdateProductInternal(newProduct);

    // 3- تعديل رصيد المورد (إضافة دين جديد)
    updateSupplierInternal(purchaseData.supplierId, purchaseData);

    // 4- اضافة دفعة في حالة ودجودها
    if (purchaseData.remainingDebt > 0 && purchaseData.remainingDebt < purchaseData.totalPrice) {
        createPaymentInternal({
            type: "expense",
            supplierId: purchaseData.supplierId,
            amount: -(purchaseData.totalPrice - purchaseData.remainingDebt),
            note: `${newProduct.name} دفعة من ثمن شراء`,
            currency: newPurchase.currency,
            exchangeRate: newPurchase.exchangeRate,
            amount_base: -(newPurchase.exchangeRate * (purchaseData.totalPrice - purchaseData.remainingDebt))
        });
        
    }else if (purchaseData.remainingDebt == 0) {
        // 5- دين كامل
        createPaymentInternal({
            type: "expense",
            supplierId: purchaseData.supplierId,
            amount: -purchaseData.totalPrice,
            note: `${newProduct.name} دفع كامل ثمن شراء`,
            currency: newPurchase.currency,
            exchangeRate: newPurchase.exchangeRate,
            amount_base: -(newPurchase.exchangeRate * purchaseData.totalPrice)
        });
    }else if(purchaseData.remainingDebt == purchaseData.totalPrice){

    }
    

    return purchaseData;
};

// ✅ عند تنفيذ عملية بيع
export const handleSell = async ({newSell}: {newSell: sell}) => {
    
    try{
    // 1- تسجيل عملية البيع
    const sellData = await createSellInternal(newSell);

    // 2- تحديث مخزون المنتجات
    newSell.products.forEach(p => {
        updateQuantityOnSell(p.code, p.warehouse, p.qty);
    });

    // 3- تعديل رصيد المورد (إضافة دين جديد)
    updateCustomerInternal(sellData.customerId, sellData);

    if (sellData.remainingDebt == 0){
        createPaymentInternal({
            type: "income",
            customerId: sellData.customerId,
            amount: sellData.totalPrice,
            note: `دفع كامل ثمن بيع`,
            currency: sellData.currency,
            exchangeRate: sellData.exchangeRate,
            amount_base: sellData.exchangeRate * sellData.totalPrice
        });


    }else if (sellData.remainingDebt < sellData.totalPrice) {
        // 4- اضافة دفعة في حالة ودجودها
        createPaymentInternal({
            type: "income",
            customerId: sellData.customerId,
            amount: (sellData.totalPrice - sellData.remainingDebt),
            note: `دفعه من ثمن بيع`,
            currency: sellData.currency,
            exchangeRate: sellData.exchangeRate,
            amount_base: sellData.partValue || sellData.exchangeRate * (sellData.totalPrice - sellData.remainingDebt)
        });

    }else if (sellData.remainingDebt == sellData.totalPrice) {
        
    }

    return sellData;
    } catch (err) {
        console.log(err)
    }
};

export const customerPayment = async (paymentData: Payment) => {
    // 1- تسجيل عملية الدفع
    const data = await createPaymentInternal(paymentData);

    // 2- تحديث رصيد العميل
    data.customerId ? updateCustomerInternal(data.customerId, undefined, paymentData) : null;

    return data;
}
export const supplierPayment = async (paymentData: Payment) => {
    // 1- تسجيل عملية الدفع
    const data = await createPaymentInternal(paymentData);
    
    // 2- تحديث رصيد المورد
    data.supplierId ? updateSupplierInternal(data.supplierId, undefined, paymentData) : null;

    return data;
}

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
    reason: string,
}) => {

    //1- انشاء سجل اعادة
    createReturnInternal({...newReturn, type: "purchase-return"})

    //2- انشاء سجل مالي
    createPaymentInternal({
        type: "return",
        supplierId: newReturn.supplierId,
        amount: newReturn.returnType == "cash" ? newReturn.returnValue : newReturn.returnType == "part" ? newReturn.partValue : 0,
        note: `اعادة منتجات للمورد`,
        currency: 'USD',
        exchangeRate: 0,
        amount_base: 0
    });

    //3- تحديث رصيد المورد
    newReturn.returnType == 'debt' ?
        updateSupplierBalanceInternal(newReturn.supplierId, -newReturn.returnValue)
    : newReturn.returnType == 'part' ? 
        updateSupplierBalanceInternal(newReturn.supplierId, -(newReturn.returnValue - newReturn.partValue))
    :
        updateSupplierBalanceInternal(newReturn.supplierId, 0)
        

    //4- تعديل الكمية في الفاتورة
    const purchase = await getPurchaseByIdInternal(newReturn.referenceId);

    updatePurchaseInternal(newReturn.referenceId, {
        quantity: (purchase?.quantity || 0) + newReturn.qty,
    });

    //5- تحديث مخزون المنتجات
    updateQuantityOnSell(newReturn.productCode, newReturn.warehouse, newReturn.qty);
}

export const handleCustomerReturn = (newReturn: {
    productCode: string;
    customerId: string;
    warehouse: string;
    qty: number;
    returnValue: number;
    referenceId: string;
    productId: string;
    returnType: "debt" | "cash" | "part";
    partValue: number;
    reason: string,
}) => {

    //1- انشاء سجل اعادة
    createReturnInternal({...newReturn, type: "sale-return"})

    //2- انشاء سجل مالي
    createPaymentInternal({
        type: "return",
        customerId: newReturn.customerId,
        amount: -(newReturn.returnType == "cash" ? newReturn.returnValue : newReturn.returnType == "part" ? newReturn.partValue : 0),
        note: `اعادة منتجات من الزبون`,
        currency: 'USD',
        exchangeRate: 0,
        amount_base: 0
    });

    //3- تحديث رصيد الزبون
    newReturn.returnType == 'debt' ?
        updateCustomerBalanceInternal(newReturn.customerId, newReturn.returnValue)
    : newReturn.returnType == 'part' ?
        updateCustomerBalanceInternal(newReturn.customerId, (newReturn.returnValue - newReturn.partValue))
    :
        updateSupplierBalanceInternal(newReturn.customerId, 0)

    //4- تعديل الكمية في الفاتورة
    returnProductsFromSellInternal(newReturn.referenceId, [{
        code: newReturn.productCode,
        warehouse: newReturn.warehouse,
        qty: -newReturn.qty
    }]);


    //5- تعديل الكمية في المخزون
    updateQuantityOnSell(newReturn.productCode, newReturn.warehouse, newReturn.qty);    


}
