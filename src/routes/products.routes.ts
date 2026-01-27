
import express from 'express';
import { getAll, create, getProductById, updateProduct, deleteProduct, getByWarehouse } from '../controllers/products.controller';
const router = express.Router();

router.get('/', getAll);
router.post('/', create);

router.put("/:id", updateProduct);
router.delete("/:id", deleteProduct);

router.post("/byId", getProductById);

router.post('/getByWarehouse', getByWarehouse)

export default router;
