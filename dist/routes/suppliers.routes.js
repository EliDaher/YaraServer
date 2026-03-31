"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const suppliers_controller_1 = require("../controllers/suppliers.controller");
const router = express_1.default.Router();
router.get('/', suppliers_controller_1.getAll);
router.post('/', suppliers_controller_1.create);
router.put("/:id", suppliers_controller_1.updateSupplierInfo);
router.post('/byId', suppliers_controller_1.getSupplierById);
exports.default = router;
