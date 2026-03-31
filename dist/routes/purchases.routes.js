"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const purchases_controller_1 = require("../controllers/purchases.controller");
const router = express_1.default.Router();
router.get('/', purchases_controller_1.getAllPurchases);
router.post('/', purchases_controller_1.createPurchase);
exports.default = router;
