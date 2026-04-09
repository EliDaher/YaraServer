
export interface purchase {
    id: string,
    supplierId: string,
    name: string,
    code: string,
    warehouse: string,
    quantity: number,
    payPrice: number,
    transferCost?: number,
    totalPrice: number,
    currency: string,
    exchangeRate: number,
    amount_base: number,
    executer?: string,
    paymentStatus: string,
    remainingDebt: number,
    date: string
}
