

import express from 'express';
import { getAll, create, getCustomerById, updateCustomerInfo } from '../controllers/customer.controller';
const router = express.Router();

router.get('/', getAll);
router.post('/', create);

router.post('/byId', getCustomerById);

router.put("/:id", updateCustomerInfo);

export default router;
