"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const sells_controller_1 = require("../controllers/sells.controller");
const router = express_1.default.Router();
router.get('/', sells_controller_1.getAllSells);
router.get("/:id", sells_controller_1.getSellById);
router.put("/:id", sells_controller_1.updateSellById);
router.delete("/:id", sells_controller_1.deleteSellById);
router.post("/byWarehouseDate", sells_controller_1.getSalesByWarehouseAndDate);
exports.default = router;
