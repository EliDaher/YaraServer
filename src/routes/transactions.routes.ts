import express, { Request, Response } from "express";
import { push, ref, set } from "firebase/database";
import {
  customerPayment,
  handleCustomerReturn,
  handlePurchase,
  handleSell,
  handleSupplierReturn,
  supplierPayment,
  warehouseTransfer,
} from "../functions/transactions";
import { addAfterSellDiscountInternal } from "../controllers/sells.controller";
import { updateCustomerBalanceInternal } from "../controllers/customer.controller";
import { database } from "../firebaseConfig";

const router = express.Router();

const getExecuter = (req: Request) =>
  typeof req.headers["x-executer"] === "string"
    ? req.headers["x-executer"]
    : undefined;

router.post("/purchase", async (req: Request, res: Response) => {
  try {
    const { newPurchase, newProduct } = req.body;
    if (!newPurchase || !newProduct) {
      throw new Error("Purchase payload is incomplete");
    }

    const result = await handlePurchase({
      newPurchase,
      newProduct,
      executer: getExecuter(req),
    });
    res.json({ message: "Purchase completed", data: result });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.post("/sell", async (req: Request, res: Response) => {
  try {
    const { newSell } = req.body;
    if (!newSell) {
      throw new Error("Sell payload is incomplete");
    }
    const result = await handleSell({
      newSell,
      executer: getExecuter(req),
    });
    res.json({ message: "Sell completed", data: result });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.post("/customerPayment", async (req: Request, res: Response) => {
  try {
    const { paymentData } = req.body;
    if (!paymentData) {
      throw new Error("Customer payment payload is incomplete");
    }
    const result = await customerPayment(paymentData, getExecuter(req));
    res.json({ message: "Customer payment completed", data: result });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.post("/supplierPayment", async (req: Request, res: Response) => {
  try {
    const { paymentData } = req.body;
    if (!paymentData) {
      throw new Error("Supplier payment payload is incomplete");
    }
    const result = await supplierPayment(paymentData, getExecuter(req));
    res.json({ message: "Supplier payment completed", data: result });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.post("/SupplierReturn", async (req: Request, res: Response) => {
  try {
    const { newReturn } = req.body;
    if (!newReturn) {
      throw new Error("Supplier return payload is incomplete");
    }

    const result = await handleSupplierReturn({
      ...newReturn,
      executer: getExecuter(req),
    });
    res.json({ message: "Supplier return completed", data: result });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.post("/CustomerReturn", async (req: Request, res: Response) => {
  try {
    const { newReturn } = req.body;
    if (!newReturn) {
      throw new Error("Customer return payload is incomplete");
    }
    const result = await handleCustomerReturn({
      ...newReturn,
      executer: getExecuter(req),
    });
    res.json({ message: "Customer return completed", data: result });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.post("/warehouseTransfer", async (req: Request, res: Response) => {
  try {
    const { transferData } = req.body;
    if (!transferData) {
      throw new Error("Warehouse transfer payload is incomplete");
    }
    const result = await warehouseTransfer({
      ...transferData,
      executer: getExecuter(req),
    });
    res.json({ message: "Warehouse transfer completed", data: result });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.post("/afterSellDiscount", async (req: Request, res: Response) => {
  try {
    const { discount, sellId, customerId } = req.body;
    if (discount == null || !sellId || !customerId) {
      throw new Error("after-sell-discount payload is incomplete");
    }

    await addAfterSellDiscountInternal({ sellId, discount });
    await updateCustomerBalanceInternal(customerId, discount);

    const executer = getExecuter(req) || "Unknown";
    const operationRef = push(ref(database, "discountOperations"));
    const operationId = operationRef.key || `discount-${Date.now()}`;

    await set(operationRef, {
      id: operationId,
      type: "after_sell_discount",
      executer,
      date: new Date().toLocaleString(),
      referenceId: sellId,
      amount: Number(-discount),
      currency: "USD",
      details: `After-sell discount for sell ${sellId}`,
      customerId,
    });

    res.json({ message: "After-sell discount completed" });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

export default router;
