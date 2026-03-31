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
const transactions_1 = require("../functions/transactions");
const sells_controller_1 = require("../controllers/sells.controller");
const customer_controller_1 = require("../controllers/customer.controller");
const router = express_1.default.Router();
router.post("/purchase", (req, res) => {
    try {
        const { newPurchase, newProduct } = req.body;
        if (!newPurchase || !newProduct) {
            throw new Error("❌ بيانات الشراء أو المنتج غير مكتملة");
        }
        const result = (0, transactions_1.handlePurchase)({ newPurchase, newProduct });
        res.json({ message: "✅ تمت عملية الشراء", data: result });
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
});
router.post("/sell", (req, res) => {
    try {
        const { newSell } = req.body;
        if (!newSell) {
            throw new Error("❌ بيانات البيع غير مكتملة");
        }
        const result = (0, transactions_1.handleSell)({ newSell });
        res.json({ message: "✅ تمت عملية البيع", data: result });
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
});
router.post("/customerPayment", (req, res) => {
    try {
        const { paymentData } = req.body;
        if (!paymentData) {
            throw new Error("❌ بيانات الدفع غير مكتملة");
        }
        const result = (0, transactions_1.customerPayment)(paymentData);
        res.json({ message: "✅ تمت عملية الدفع", data: result });
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
});
router.post("/supplierPayment", (req, res) => {
    try {
        const { paymentData } = req.body;
        if (!paymentData) {
            throw new Error("❌ بيانات الدفع غير مكتملة");
        }
        const result = (0, transactions_1.supplierPayment)(paymentData);
        res.json({ message: "✅ تمت عملية الدفع", data: result });
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
});
router.post("/SupplierReturn", (req, res) => {
    try {
        const { newReturn } = req.body;
        if (!newReturn) {
            throw new Error("❌ بيانات الدفع غير مكتملة");
        }
        const result = (0, transactions_1.handleSupplierReturn)(newReturn);
        res.json({ message: "✅ تمت عملية الدفع", data: result });
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
});
router.post("/CustomerReturn", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { newReturn } = req.body;
        if (!newReturn) {
            throw new Error("❌ بيانات الدفع غير مكتملة");
        }
        const result = yield (0, transactions_1.handleCustomerReturn)(newReturn);
        res.json({ message: "✅ تمت عملية الدفع", data: result });
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
}));
router.post("/warehouseTransfer", (req, res) => {
    try {
        const { transferData } = req.body;
        if (!transferData) {
            throw new Error("❌ بيانات الدفع غير مكتملة");
        }
        const result = (0, transactions_1.warehouseTransfer)(transferData);
        res.json({ message: "✅ تمت عملية النقل بين المستودعات", data: result });
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
});
router.post("/afterSellDiscount", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { discount, sellId, customerId } = req.body;
        if (!discount || !sellId || !customerId) {
            throw new Error("❌ بيانات الخصم أو معرف الفاتورة أو معرف العميل غير مكتملة");
        }
        yield (0, sells_controller_1.addAfterSellDiscountInternal)({ sellId, discount });
        yield (0, customer_controller_1.updateCustomerBalanceInternal)(customerId, discount);
        res.json({ message: "✅ تمت عملية الخصم بعد البيع" });
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
}));
exports.default = router;
