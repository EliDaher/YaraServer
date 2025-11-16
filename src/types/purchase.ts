
export interface purchase {
    id: string,
    supplierId: string,
    name: string,
    code: string,
    warehouse: string,
    quantity: number,
    payPrice: number,
    totalPrice: number,
    currency: string,
    exchangeRate: number,
    amount_base: number,
    paymentStatus: string,
    remainingDebt: number,
    date: string
}
