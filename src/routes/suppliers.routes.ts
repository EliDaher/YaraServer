
import express from 'express';
import { getAll, create, getSupplierById, updateSupplierInfo } from '../controllers/suppliers.controller';
const router = express.Router();

router.get('/', getAll);
router.post('/', create);

router.put("/:id", updateSupplierInfo);

router.post('/byId', getSupplierById);

export default router;
