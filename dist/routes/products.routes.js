"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const products_controller_1 = require("../controllers/products.controller");
const router = express_1.default.Router();
router.get('/', products_controller_1.getAll);
router.post('/', products_controller_1.create);
router.put("/:id", products_controller_1.updateProduct);
router.delete("/:id", products_controller_1.deleteProduct);
router.post("/byId", products_controller_1.getProductById);
router.post('/getByWarehouse', products_controller_1.getByWarehouse);
exports.default = router;
