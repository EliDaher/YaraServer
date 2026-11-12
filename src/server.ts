import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import app from "./app";
import { startCustomerSummaries, startSupplierSummaries } from "./services/customerSummary.service";

dotenv.config();
startCustomerSummaries();
startSupplierSummaries();

const PORT = process.env.PORT || 5000;

// أنشئ HTTP server بناءً على app
const server = http.createServer(app);

// تشغيل السيرفر على البورت
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
