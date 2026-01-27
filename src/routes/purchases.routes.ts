
import express from 'express';
import { getAllPurchases, createPurchase } from '../controllers/purchases.controller';
const router = express.Router();

router.get('/', getAllPurchases);
router.post('/', createPurchase);

export default router;
