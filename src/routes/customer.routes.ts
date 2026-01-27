

import express from 'express';
import { getAll, create, getCustomerById } from '../controllers/customer.controller';
const router = express.Router();

router.get('/', getAll);
router.post('/', create);

router.post('/byId', getCustomerById);

export default router;
