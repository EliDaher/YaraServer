const { test, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
require("ts-node/register/transpile-only");
mock.method(console, "log", () => {});
const Module = require("node:module");
const load = Module._load;
let store = {},
  nextId = 0;
const clone = (value) =>
  value === undefined ? null : JSON.parse(JSON.stringify(value));
const read = (path) =>
  path
    .split("/")
    .filter(Boolean)
    .reduce((value, key) => value?.[key], store) ?? null;
const write = (path, value) => {
  const keys = path.split("/").filter(Boolean),
    last = keys.pop();
  let parent = store;
  for (const key of keys) parent = parent[key] ||= {};
  if (value === null) delete parent[last];
  else parent[last] = clone(value);
};
const ref = (_database, path) => ({ path, key: path.split("/").pop() });
const firebase = {
  ref,
  getDatabase: () => ({}),
  get: async (reference) => ({
    exists: () => read(reference.path) !== null,
    val: () => clone(read(reference.path)),
  }),
  set: async (reference, value) => write(reference.path, value),
  update: async (reference, value) => {
    for (const [key, item] of Object.entries(value))
      write(reference.path + "/" + key, item);
  },
  remove: async (reference) => write(reference.path, null),
  push: (reference, value) => {
    const child = ref({}, reference.path + "/id-" + ++nextId);
    if (value !== undefined) write(child.path, value);
    return child;
  },
};
Module._load = function (request, parent, isMain) {
  if (request === "firebase/database") return firebase;
  if (request === "uuid") return { v4: () => "id-" + ++nextId };
  if (request.endsWith("/firebaseConfig")) return { database: {} };
  return load.apply(this, arguments);
};
const numbers = require("../src/utils/numbers");
const database = require("../src/utils/database");
const transactions = require("../src/functions/transactions");
const products = require("../src/controllers/products.controller");
const sells = require("../src/controllers/sells.controller");
const payments = require("../src/controllers/payments.controller");
const suppliers = require("../src/controllers/suppliers.controller");
Module._load = load;
const response = () => ({
  statusCode: 200,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(value) {
    this.body = value;
    return this;
  },
});
const product = (overrides = {}) => ({
  id: "p",
  code: "p",
  name: "Cloth",
  warehouse: "main",
  quantity: 10,
  payPrice: 1.23,
  sellPrice: 2.35,
  unit: "m",
  category: "cloth",
  ...overrides,
});
const sale = (overrides = {}) => ({
  customerId: "c",
  totalPrice: 4.7,
  remainingDebt: 3.47,
  paymentStatus: "part",
  partValue: 1.23,
  currency: "USD",
  exchangeRate: 1,
  amount_base: 4.7,
  products: [{ ...product(), qty: 2 }],
  ...overrides,
});
beforeEach(() => {
  store = {
    products: { main: { p: product() } },
    customer: {
      c: { id: "c", name: "Customer", number: "0991234567", balance: 0 },
    },
    supplier: { s: { id: "s", balance: 0, purchases: [] } },
  };
  nextId = 0;
});
test("rounds both signs and rejects invalid values", () => {
  for (const [value, expected] of [
    [1.005, 1.01],
    [-1.005, -1.01],
    [0.1 + 0.2, 0.3],
    [-0.001, 0],
  ])
    assert.equal(numbers.roundNumber(value), expected);
  assert.equal(Object.is(numbers.roundNumber(-0.001), -0), false);
  assert.throws(() => numbers.roundNumber(Infinity));
});
test("legacy reads and unchanged fields are preserved, modified fields and scalar writes are rounded", async () => {
  store.products.main.p.payPrice = 1.23456;
  const value = clone(store.products.main.p);
  assert.equal(numbers.formatNumber(value.payPrice), "1.23");
  assert.equal(store.products.main.p.payPrice, 1.23456);
  value.quantity = 1.005;
  await database.set(ref({}, "products/main/p"), value);
  assert.equal(value.quantity, 1.01);
  assert.equal(store.products.main.p.payPrice, 1.23456);
  await database.set(ref({}, "products/main/p/quantity"), 2.345);
  assert.equal(store.products.main.p.quantity, 2.35);
  assert.equal(store.customer.c.number, "0991234567");
});
test("partial sale saves one consistent invoice, payment, stock and balance", async () => {
  const result = await transactions.handleSell({
    newSell: sale({ partValue: 1.005 }),
  });
  assert.ok(result);
  assert.equal(result.totalPrice, 4.7);
  assert.equal(result.remainingDebt, 3.69);
  assert.equal(store.customer.c.balance, -3.69);
  assert.equal(store.products.main.p.quantity, 8);
  assert.equal(Object.values(store.payment)[0].amount, 1.01);
  assert.deepEqual(store.sells[result.id], result);
});
test("cash and debt sales derive their debt from the rounded total", async () => {
  const cash = await transactions.handleSell({
    newSell: sale({ paymentStatus: "cash", discount: 0.005 }),
  });
  assert.equal(cash.totalPrice, 4.69);
  assert.equal(cash.remainingDebt, 0);
  assert.equal(store.customer.c.balance, 0);
  const debt = await transactions.handleSell({
    newSell: sale({ paymentStatus: "debt" }),
  });
  assert.equal(debt.remainingDebt, debt.totalPrice);
  assert.equal(store.customer.c.balance, -4.7);
});
test("foreign-currency partial payment is converted with decimal rounding", async () => {
  const result = await transactions.handleSell({
    newSell: sale({ currency: "SYP", exchangeRate: 8, partValue: 1 }),
  });
  assert.equal(result.remainingDebt, 4.57);
  assert.equal(Object.values(store.payment)[0].amount, 0.13);
});
test("purchase rounds inputs and derives payment and supplier debt consistently", async () => {
  const result = await transactions.handlePurchase({
    newProduct: product({ quantity: 1.005, payPrice: 1.235 }),
    newPurchase: {
      supplierId: "s",
      name: "Cloth",
      code: "p",
      warehouse: "main",
      quantity: 1.005,
      payPrice: 1.235,
      totalPrice: 1.25,
      remainingDebt: 0.75,
      paymentStatus: "pending",
      currency: "USD",
      exchangeRate: 1,
      amount_base: 1.25,
    },
  });
  assert.equal(result.quantity, 1.01);
  assert.equal(result.payPrice, 1.24);
  assert.equal(result.totalPrice, 1.25);
  assert.equal(result.remainingDebt, 0.75);
  assert.equal(store.supplier.s.balance, 0.75);
  assert.equal(Object.values(store.payment)[0].amount, -0.5);
  assert.equal(store.products.main.p.quantity, 11.01);
});
test("supplier balances retain their second decimal rather than truncating to one", async () => {
  store.supplier.s.balance = 1.23;
  const result = await suppliers.updateSupplierBalanceInternal("s", 0.125);
  assert.equal(result.balance, 1.36);
  assert.equal(store.supplier.s.balance, 1.36);
});
test("manual payment and its deletion reverse the same rounded amount", async () => {
  const result = await transactions.customerPayment({
    customerId: "c",
    amount: 1.005,
    amount_base: 1.005,
    currency: "USD",
    exchangeRate: 1,
    type: "income",
  });
  assert.equal(result.amount, 1.01);
  assert.equal(store.customer.c.balance, 1.01);
  const res = response();
  await payments.deletePayment({ params: { id: result.id } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(store.customer.c.balance, 0);
  assert.equal(read("payment/" + result.id), null);
});
test("warehouse transfer rounds quantities, cost and both stock balances", async () => {
  await transactions.warehouseTransfer({
    productId: "p",
    oldWarehouse: "main",
    newWarehouse: "other",
    quantity: 1.005,
    amount: 0.125,
    currency: "USD",
    exchangeRate: 1,
    amount_base: 0.125,
    note: "",
  });
  assert.equal(store.products.main.p.quantity, 8.99);
  assert.equal(Object.values(store.products.other)[0].quantity, 1.01);
  assert.equal(Object.values(store.warehouseTransfers)[0].cost, 0.13);
  assert.equal(Object.values(store.payment)[0].amount, -0.13);
});
test("customer return rounds the returned stock and refund/balance", async () => {
  const invoice = await transactions.handleSell({
    newSell: sale({ paymentStatus: "debt" }),
  });
  await transactions.handleCustomerReturn({
    customerId: "c",
    referenceId: invoice.id,
    returnType: "debt",
    partValue: 0,
    reason: "",
    items: [
      {
        productCode: "p",
        productId: "p",
        warehouse: "main",
        qty: 0.125,
        returnValue: 0.305,
      },
    ],
  });
  assert.equal(store.products.main.p.quantity, 8.13);
  assert.equal(store.customer.c.balance, -4.39);
  assert.equal(store.sells[invoice.id].remainingDebt, 4.39);
  assert.equal(Object.values(store.returns)[0].qty, 0.13);
});
test("direct create route returns the rounded product that was stored", async () => {
  const res = response();
  await products.create(
    { body: product({ quantity: 1.005, sellPrice: 12.345 }) },
    res,
  );
  assert.equal(res.body.data.quantity, 1.01);
  assert.equal(res.body.data.sellPrice, 12.35);
  assert.deepEqual(store.products.main[res.body.data.id], res.body.data);
});
test("editing a sale uses decimal totals and preserves rounded stock", async () => {
  const invoice = await transactions.handleSell({
    newSell: sale({ paymentStatus: "debt" }),
  });
  const res = response();
  await sells.updateSellById(
    {
      params: { id: invoice.id },
      body: {
        data: { products: [{ ...product(), qty: 1.01, sellPrice: 1.25 }] },
      },
    },
    res,
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.sell.totalPrice, 1.26);
  assert.equal(res.body.sell.remainingDebt, 1.26);
  assert.equal(store.products.main.p.quantity, 8.99);
  assert.equal(store.customer.c.balance, -1.26);
});

test("deleting a partial sale reverses its debt and stock exactly", async () => {
  const invoice = await transactions.handleSell({
    newSell: sale({ partValue: 1.005 }),
  });
  const res = response();
  await sells.deleteSellById({ params: { id: invoice.id } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(store.customer.c.balance, 0);
  assert.equal(store.products.main.p.quantity, 10);
  assert.equal(read("sells/" + invoice.id), null);
});

test("supplier partial return rounds the stock, payment and debt change", async () => {
  store.purchases = {
    purchase: { id: "purchase", supplierId: "s", quantity: 2 },
  };
  store.supplier.s.balance = 3;
  await transactions.handleSupplierReturn({
    productCode: "p",
    productId: "p",
    supplierId: "s",
    warehouse: "main",
    qty: 0.125,
    returnValue: 0.305,
    partValue: 0.105,
    referenceId: "purchase",
    returnType: "part",
    reason: "",
  });
  assert.equal(store.products.main.p.quantity, 9.87);
  assert.equal(store.purchases.purchase.quantity, 1.87);
  assert.equal(store.supplier.s.balance, 2.8);
  assert.equal(Object.values(store.payment)[0].amount, 0.11);
});
