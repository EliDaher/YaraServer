"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const users_controller_1 = require("../controllers/users.controller");
const router = express_1.default.Router();
router.use(users_controller_1.requireAdminUser);
router.get("/operations", users_controller_1.getOperations);
router.get("/:username/operations", users_controller_1.getUserOperations);
router.get("/", users_controller_1.listUsers);
router.post("/", users_controller_1.createUser);
router.put("/:username", users_controller_1.updateUser);
router.delete("/:username", users_controller_1.deleteUser);
exports.default = router;
