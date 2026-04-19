import { get, ref } from "firebase/database";
import { database } from "../firebaseConfig";

export type OperationRow = {
  id: string;
  type: string;
  executer: string;
  date: string;
  referenceId: string;
  amount: number;
  currency: string;
  details: string;
};

export type OperationCollections = {
  purchases: any[];
  sells: any[];
  payments: any[];
  returns: any[];
  transfers: any[];
  discounts: any[];
};

const asRecord = (value: unknown): Record<string, any> =>
  value && typeof value === "object" ? (value as Record<string, any>) : {};

const toArray = (value: unknown): any[] => Object.values(asRecord(value));

const asString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const toNumber = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeExecuter = (row: Record<string, any>) =>
  asString(row.executer) || asString(row.performedBy) || "Unknown";

const normalizeDateString = (value: unknown): string => {
  if (typeof value === "number") {
    const numericDate = new Date(value);
    return Number.isNaN(numericDate.getTime())
      ? new Date(0).toISOString()
      : numericDate.toISOString();
  }

  const stringDate = asString(value);
  if (!stringDate) {
    return new Date(0).toISOString();
  }

  const parsed = Date.parse(stringDate);
  return Number.isNaN(parsed) ? new Date(0).toISOString() : stringDate;
};

export const toTimestamp = (value: unknown): number => {
  if (typeof value === "number") {
    return value;
  }

  const parsed = Date.parse(asString(value));
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const normalizeOperations = (
  purchases: any[],
  sells: any[],
  payments: any[],
  returns: any[],
  transfers: any[],
  discounts: any[]
): OperationRow[] => {
  const purchaseOps: OperationRow[] = purchases.map((purchase: any) => {
    const row = asRecord(purchase);
    const id = asString(row.id) || asString(row.referenceId);
    return {
      id: id || `purchase-${Math.random()}`,
      type: "purchase",
      executer: normalizeExecuter(row),
      date: normalizeDateString(row.date),
      referenceId: id || "-",
      amount: toNumber(row.totalPrice),
      currency: asString(row.currency),
      details:
        asString(row.name) ||
        asString(row.code) ||
        `Purchase supplier:${asString(row.supplierId)}`,
    };
  });

  const sellOps: OperationRow[] = sells.map((sell: any) => {
    const row = asRecord(sell);
    const id = asString(row.id) || asString(row.referenceId);
    return {
      id: id || `sell-${Math.random()}`,
      type: "sell",
      executer: normalizeExecuter(row),
      date: normalizeDateString(row.date),
      referenceId: id || "-",
      amount: toNumber(row.totalPrice),
      currency: asString(row.currency),
      details: `Sell customer:${asString(row.customerId)}`,
    };
  });

  const paymentOps: OperationRow[] = payments.map((payment: any) => {
    const row = asRecord(payment);
    const id = asString(row.id) || asString(row.referenceId);
    return {
      id: id || `payment-${Math.random()}`,
      type: `payment:${asString(row.type) || "entry"}`,
      executer: normalizeExecuter(row),
      date: normalizeDateString(row.date),
      referenceId: id || "-",
      amount: toNumber(row.amount),
      currency: asString(row.currency),
      details: asString(row.note) || "Payment operation",
    };
  });

  const returnOps: OperationRow[] = returns.map((returnRow: any) => {
    const row = asRecord(returnRow);
    const id = asString(row.id) || asString(row.referenceId);
    return {
      id: id || `return-${Math.random()}`,
      type: asString(row.type) || "return",
      executer: normalizeExecuter(row),
      date: normalizeDateString(row.createdDate || row.date),
      referenceId: asString(row.referenceId) || id || "-",
      amount: toNumber(row.returnValue),
      currency: asString(row.currency),
      details: `${asString(row.productCode) || "item"} qty:${toNumber(row.qty)}`,
    };
  });

  const transferOps: OperationRow[] = transfers.map((transfer: any) => {
    const row = asRecord(transfer);
    const id = asString(row.transferId) || asString(row.referenceId);
    return {
      id: id || `transfer-${Math.random()}`,
      type: "warehouse_transfer",
      executer: normalizeExecuter(row),
      date: normalizeDateString(row.createdAt || row.date),
      referenceId: asString(row.referenceId) || id || "-",
      amount: toNumber(row.cost || row.amount),
      currency: asString(row.currency),
      details: `${asString(row.productName)} ${asString(
        row.fromWarehouse
      )} -> ${asString(row.toWarehouse)}`.trim(),
    };
  });

  const discountOps: OperationRow[] = discounts.map((discount: any) => {
    const row = asRecord(discount);
    const id = asString(row.id) || asString(row.referenceId);
    return {
      id: id || `discount-${Math.random()}`,
      type: "after_sell_discount",
      executer: normalizeExecuter(row),
      date: normalizeDateString(row.date),
      referenceId: asString(row.referenceId) || "-",
      amount: toNumber(row.amount),
      currency: asString(row.currency),
      details:
        asString(row.details) ||
        `After-sell discount for sell ${asString(row.referenceId)}`,
    };
  });

  return [
    ...purchaseOps,
    ...sellOps,
    ...paymentOps,
    ...returnOps,
    ...transferOps,
    ...discountOps,
  ]
    .map((operation) => ({
      ...operation,
      executer: operation.executer || "Unknown",
    }))
    .sort((a, b) => toTimestamp(b.date) - toTimestamp(a.date));
};

export const getOperationCollections = async (): Promise<OperationCollections> => {
  const [
    purchasesSnapshot,
    sellsSnapshot,
    paymentsSnapshot,
    returnsSnapshot,
    transfersSnapshot,
    discountsSnapshot,
  ] = await Promise.all([
    get(ref(database, "purchases")),
    get(ref(database, "sells")),
    get(ref(database, "payment")),
    get(ref(database, "returns")),
    get(ref(database, "warehouseTransfers")),
    get(ref(database, "discountOperations")),
  ]);

  return {
    purchases: toArray(purchasesSnapshot.val()),
    sells: toArray(sellsSnapshot.val()),
    payments: toArray(paymentsSnapshot.val()),
    returns: toArray(returnsSnapshot.val()),
    transfers: toArray(transfersSnapshot.val()),
    discounts: toArray(discountsSnapshot.val()),
  };
};

export const getAllOperations = async (): Promise<OperationRow[]> => {
  const collections = await getOperationCollections();
  return normalizeOperations(
    collections.purchases,
    collections.sells,
    collections.payments,
    collections.returns,
    collections.transfers,
    collections.discounts
  );
};
