
import express from 'express';
import { getAll, getSupplierPage, getSupplierSummary, create, getSupplierById, updateSupplierInfo } from '../controllers/suppliers.controller';
const router = express.Router();

router.get('/', getAll);
router.get('/page', getSupplierPage);
router.get('/summary', getSupplierSummary);
router.post('/', create);

router.put("/:id", updateSupplierInfo);

router.post('/byId', getSupplierById);

export default router;
