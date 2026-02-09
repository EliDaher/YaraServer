export interface Supplier {
    id: string;
    name: string;
    number?: string;
    balance: number;
    createdDate: string;
    updatedDate: string;
    purchases: any[];
}
