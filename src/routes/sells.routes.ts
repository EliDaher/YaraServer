
import express from 'express';
import { deleteSellById, getAllSells, getSalesByWarehouseAndDate, getSellById, updateSellById } from '../controllers/sells.controller';
const router = express.Router();

router.get('/', getAllSells);

router.get("/:id", getSellById);

router.put("/:id", updateSellById);

router.delete("/:id", deleteSellById);

router.post("/byWarehouseDate", getSalesByWarehouseAndDate);


export default router;
