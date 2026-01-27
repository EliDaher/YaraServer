
import express from 'express';
import { createPayment, getAll, getMonthPayments } from '../controllers/payments.controller';
const router = express.Router();

router.get('/', getAll);

router.get('/month', getMonthPayments);

router.post('/create', createPayment);

export default router;
