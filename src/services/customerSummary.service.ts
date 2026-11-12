import { onValue, ref } from "firebase/database";
import { database } from "../firebaseConfig";
import { Customer } from "../types/customer";

function numericBalance(value: unknown): number {
  if (typeof value !== "number" && typeof value !== "string") return 0;
  const balance = Number(value);
  return Number.isFinite(balance) ? balance : 0;
}

export function summarizeCustomer({ id, name, number, balance, updatedDate, purchases }: Customer) {
  return { id, name, number, balance: numericBalance(balance), updatedDate, purchasesCount: purchases?.length ?? 0 };
}

type Summary = ReturnType<typeof summarizeCustomer>;
function createSummaryCache(collection: "customer" | "supplier", timingFlag: string) {
  let rows: Summary[] | undefined;
  let started = false;
  let unsubscribe: (() => void) | undefined;
  const waiters = new Set<(value: Summary[]) => void>();

  function start() {
    if (started) return;
    started = true;
    onValue(ref(database, ".info/connected"), (connection) => {
      rows = undefined;
      unsubscribe?.();
      unsubscribe = undefined;
      if (!connection.val()) return;

      const startedAt = performance.now();
      unsubscribe = onValue(ref(database, collection), (snapshot) => {
        const first = rows === undefined;
        rows = (Object.values(snapshot.val() ?? {}) as Customer[]).map(summarizeCustomer);
        if (first && process.env[timingFlag] === "1") {
          console.info(`[${collection}-summary] synchronized`, {
            elapsedMs: Math.round(performance.now() - startedAt),
            records: rows.length,
          });
        }
        for (const resolve of waiters) resolve(rows);
      }, (error) => {
        rows = undefined;
        console.error(`[${collection}-summary] subscription failed`, error.message);
      });
    });
  }

  function read(): Promise<Summary[] | undefined> {
    if (rows) return Promise.resolve(rows);
    return new Promise((resolve) => {
      const ready = (value: Summary[]) => {
        clearTimeout(timeout);
        waiters.delete(ready);
        resolve(value);
      };
      const timeout = setTimeout(() => {
        waiters.delete(ready);
        resolve(undefined);
      }, 15000);
      waiters.add(ready);
    });
  }
  return { start, read };
}

export const { start: startCustomerSummaries, read: readCustomerSummaries } =
  createSummaryCache("customer", "CUSTOMER_SUMMARY_TIMING");
export const { start: startSupplierSummaries, read: readSupplierSummaries } =
  createSummaryCache("supplier", "SUPPLIER_SUMMARY_TIMING");

const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase()
  .replace(/[\u0660-\u0669\u06f0-\u06f9]/g, digit => String(digit.charCodeAt(0) & 15));

const compareText = new Intl.Collator("ar", { numeric: true, sensitivity: "base" }).compare;

const comparators: Record<string, (a: Summary, b: Summary) => number> = {
  name: (a, b) => compareText(normalize(a.name), normalize(b.name)),
  number: (a, b) => compareText(normalize(a.number), normalize(b.number)),
  balance: (a, b) => a.balance - b.balance,
  purchasesCount: (a, b) => a.purchasesCount - b.purchasesCount,
  updatedDate: (a, b) => (Date.parse(a.updatedDate) || 0) - (Date.parse(b.updatedDate) || 0),
};

export function pageCustomerSummaries(rows: Summary[], query: Record<string, unknown>, collection: "customer" | "supplier" = "customer") {
  const sizes = collection === "supplier" ? [3, 5, 10, 20] : [5, 10, 20];
  const pageSize = sizes.find(size => String(size) === query.pageSize) ?? 10;
  const requestedPage = typeof query.page === "string" ? Number(query.page) : 1;
  const search = typeof query.search === "string" ? normalize(query.search) : "";
  const matches = rows.filter(row => normalize(row.name).includes(search) || normalize(row.number).includes(search));
  const sortBy = typeof query.sortBy === "string" ? query.sortBy : "";
  const compare = Object.prototype.hasOwnProperty.call(comparators, sortBy) ? comparators[sortBy] : undefined;
  if (compare) {
    const direction = query.sortDirection === "desc" ? -1 : 1;
    matches.sort((a, b) => direction * compare(a, b) || String(a.id).localeCompare(String(b.id)));
  }
  const page = Math.min(
    Number.isSafeInteger(requestedPage) ? Math.max(1, requestedPage) : 1,
    Math.max(1, Math.ceil(matches.length / pageSize)),
  );
  const totalDebt = rows.reduce((sum, row) => sum + (collection === "supplier" ? Math.max(0, row.balance) : -Math.min(0, row.balance)), 0);
  const totalBalance = rows.reduce((sum, row) => sum + row.balance, 0);
  return {
    items: matches.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    totalItems: matches.length,
    totalDebt,
    totalBalance,
  };
}
