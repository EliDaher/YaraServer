
export interface Payment {
    id?: string;
    type: string,
    source?: "manual" | "cashbox" | "generated",
    balanceApplied?: boolean,
    supplierId?: string,
    customerId?: string,
    currency: string,
    exchangeRate: number,
    amount_base: number,
    amount: number,
    executer?: string,
    date?: string,
    note: string
}
