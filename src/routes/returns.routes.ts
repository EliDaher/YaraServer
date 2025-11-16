
import express from 'express';
import { getAllReturns, createReturn, getReturnById } from '../controllers/returns';
const router = express.Router();

router.get('/', getAllReturns);
router.post('/', createReturn);

router.post("/byId", getReturnById);

export default router;
