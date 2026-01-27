import express from "express";
import * as warehouseController from "../controllers/warehouses.controller";

const router = express.Router();

router.get("/", warehouseController.getAll);

router.post("/", warehouseController.create);

router.get("/migrate", warehouseController.migrateWarehousesFromExistingData);


export default router;
