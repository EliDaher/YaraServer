
import express from 'express';
import { getAll, create, getSupplierById } from '../controllers/suppliers.controller';
const router = express.Router();

router.get('/', getAll);
router.post('/', create);

router.post('/byId', getSupplierById);

export default router;
