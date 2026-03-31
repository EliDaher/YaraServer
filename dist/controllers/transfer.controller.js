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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTransferInternal = void 0;
const database_1 = require("firebase/database");
const firebaseConfig_1 = require("../firebaseConfig");
const createTransferInternal = (data) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const transferRef = yield (0, database_1.push)((0, database_1.ref)(firebaseConfig_1.database, "warehouseTransfers"), {
            productId: data.productId,
            productCode: data.code,
            productName: data.name,
            fromWarehouse: data.oldWarehouse,
            toWarehouse: data.newWarehouse,
            quantity: Number(data.quantity),
            cost: Number(data.amount || 0),
            currency: data.currency || "USD",
            stockBefore: Number(data.stockBefore),
            stockAfter: Number(data.stockAfter),
            performedBy: data.performedBy || "system",
            referenceId: data.referenceId || null,
            note: data.note || "",
            createdAt: Date.now(),
        });
        return {
            success: true,
            transferId: transferRef.key,
        };
    }
    catch (error) {
        console.error("❌ createTransferInternal error:", error);
        throw error;
    }
});
exports.createTransferInternal = createTransferInternal;
