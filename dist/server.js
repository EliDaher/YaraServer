"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = __importDefault(require("http"));
const app_1 = __importDefault(require("./app"));
const customerSummary_service_1 = require("./services/customerSummary.service");
dotenv_1.default.config();
(0, customerSummary_service_1.startCustomerSummaries)();
(0, customerSummary_service_1.startSupplierSummaries)();
const PORT = process.env.PORT || 5000;
// أنشئ HTTP server بناءً على app
const server = http_1.default.createServer(app_1.default);
// تشغيل السيرفر على البورت
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
