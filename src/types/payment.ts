
export interface Payment {
    id?: string;
    type: string,
    supplierId?: string,
    customerId?: string,
    currency: string,
    exchangeRate: number,
    amount_base: number,
    amount: number,
    date?: string,
    note: string
}
