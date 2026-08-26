
import express from 'express';
import { createPayment, deletePayment, getAll, getMonthPayments } from '../controllers/payments.controller';
const router = express.Router();

router.get('/', getAll);

router.get('/month', getMonthPayments);

router.post('/create', createPayment);

router.delete('/:id', deletePayment);

export default router;
