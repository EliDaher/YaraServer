

import express from 'express';
import { getAll, getCustomerSummary, getCustomerPage, create, getCustomerById, updateCustomerInfo } from '../controllers/customer.controller';
const router = express.Router();

router.get('/', getAll);
router.get('/summary', getCustomerSummary);
router.get('/page', getCustomerPage);
router.post('/', create);

router.post('/byId', getCustomerById);

router.put("/:id", updateCustomerInfo);

export default router;
