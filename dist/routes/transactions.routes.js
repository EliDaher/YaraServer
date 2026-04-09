"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = require("firebase/database");
const transactions_1 = require("../functions/transactions");
const sells_controller_1 = require("../controllers/sells.controller");
const customer_controller_1 = require("../controllers/customer.controller");
const firebaseConfig_1 = require("../firebaseConfig");
const router = express_1.default.Router();
const getExecuter = (req) => typeof req.headers["x-executer"] === "string"
    ? req.headers["x-executer"]
    : undefined;
router.post("/purchase", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { newPurchase, newProduct } = req.body;
        if (!newPurchase || !newProduct) {
            throw new Error("Purchase payload is incomplete");
        }
        const result = yield (0, transactions_1.handlePurchase)({
            newPurchase,
            newProduct,
            executer: getExecuter(req),
        });
        res.json({ message: "Purchase completed", data: result });
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
}));
router.post("/sell", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { newSell } = req.body;
        if (!newSell) {
            throw new Error("Sell payload is incomplete");
        }
        const result = yield (0, transactions_1.handleSell)({
            newSell,
            executer: getExecuter(req),
        });
        res.json({ message: "Sell completed", data: result });
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
}));
router.post("/customerPayment", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { paymentData } = req.body;
        if (!paymentData) {
            throw new Error("Customer payment payload is incomplete");
        }
        const result = yield (0, transactions_1.customerPayment)(paymentData, getExecuter(req));
        res.json({ message: "Customer payment completed", data: result });
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
}));
router.post("/supplierPayment", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { paymentData } = req.body;
        if (!paymentData) {
            throw new Error("Supplier payment payload is incomplete");
        }
        const result = yield (0, transactions_1.supplierPayment)(paymentData, getExecuter(req));
        res.json({ message: "Supplier payment completed", data: result });
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
}));
router.post("/SupplierReturn", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { newReturn } = req.body;
        if (!newReturn) {
            throw new Error("Supplier return payload is incomplete");
        }
        const result = yield (0, transactions_1.handleSupplierReturn)(Object.assign(Object.assign({}, newReturn), { executer: getExecuter(req) }));
        res.json({ message: "Supplier return completed", data: result });
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
}));
router.post("/CustomerReturn", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { newReturn } = req.body;
        if (!newReturn) {
            throw new Error("Customer return payload is incomplete");
        }
        const result = yield (0, transactions_1.handleCustomerReturn)(Object.assign(Object.assign({}, newReturn), { executer: getExecuter(req) }));
        res.json({ message: "Customer return completed", data: result });
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
}));
router.post("/warehouseTransfer", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { transferData } = req.body;
        if (!transferData) {
            throw new Error("Warehouse transfer payload is incomplete");
        }
        const result = yield (0, transactions_1.warehouseTransfer)(Object.assign(Object.assign({}, transferData), { executer: getExecuter(req) }));
        res.json({ message: "Warehouse transfer completed", data: result });
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
}));
router.post("/afterSellDiscount", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { discount, sellId, customerId } = req.body;
        if (discount == null || !sellId || !customerId) {
            throw new Error("after-sell-discount payload is incomplete");
        }
        yield (0, sells_controller_1.addAfterSellDiscountInternal)({ sellId, discount });
        yield (0, customer_controller_1.updateCustomerBalanceInternal)(customerId, discount);
        const executer = getExecuter(req) || "Unknown";
        const operationRef = (0, database_1.push)((0, database_1.ref)(firebaseConfig_1.database, "discountOperations"));
        const operationId = operationRef.key || `discount-${Date.now()}`;
        yield (0, database_1.set)(operationRef, {
            id: operationId,
            type: "after_sell_discount",
            executer,
            date: new Date().toLocaleString(),
            referenceId: sellId,
            amount: Number(-discount),
            currency: "USD",
            details: `After-sell discount for sell ${sellId}`,
            customerId,
        });
        res.json({ message: "After-sell discount completed" });
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
}));
exports.default = router;
