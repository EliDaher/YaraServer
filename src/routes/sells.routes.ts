
import express from 'express';
import { deleteSellById, getAllSells, getSellById, updateSellById } from '../controllers/sells';
const router = express.Router();

router.get('/', getAllSells);

router.get("/:id", getSellById);

router.put("/:id", updateSellById);

router.delete("/:id", deleteSellById);


export default router;
