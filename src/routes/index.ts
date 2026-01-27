import { Router } from "express";
import authRoutes from "./auth.routes";
import productsRouter from "./products.routes";
import suppliersRouter from "./suppliers.routes";
import purchasesRouter from "./purchases.routes";
import transactionsRouter from "./transactions.routes";
import paymentsRouter from "./payments.routes";
import customersRouter from "./customer.routes";
import sellsRouter from "./sells.routes";
import warehousesRouter from "./warehouse.routes";


const router = Router();

router.use("/auth", authRoutes);

router.use("/products", productsRouter);
router.use("/suppliers", suppliersRouter);
router.use("/purchases", purchasesRouter);
router.use("/transactions", transactionsRouter);
router.use("/payments", paymentsRouter);
router.use("/customers", customersRouter);
router.use("/sells", sellsRouter);
router.use("/warehouses", warehousesRouter);

export default router;
