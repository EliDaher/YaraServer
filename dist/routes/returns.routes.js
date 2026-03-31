"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const returns_controller_1 = require("../controllers/returns.controller");
const router = express_1.default.Router();
router.get('/', returns_controller_1.getAllReturns);
router.post('/', returns_controller_1.createReturn);
router.post("/byId", returns_controller_1.getReturnById);
exports.default = router;
