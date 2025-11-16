export interface Customer {
    id: string;
    name: string;
    phone?: string;
    balance: number;
    createdDate: string;
    updatedDate: string;
    purchases: any[]
}
