export interface Supplier {
    id: string;
    name: string;
    phone?: string;
    balance: number;
    createdDate: string;
    updatedDate: string;
    purchases: any[];
}
