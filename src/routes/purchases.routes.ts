
import express from 'express';
import { getAllPurchases, createPurchase } from '../controllers/purchases';
const router = express.Router();

router.get('/', getAllPurchases);
router.post('/', createPurchase);

export default router;
