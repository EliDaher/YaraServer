
import express from 'express';
import { getAll, create, getProductById, updateProduct, deleteProduct, getAllWarehouses } from '../controllers/products';
const router = express.Router();

router.get('/', getAll);
router.post('/', create);

router.put("/:id", updateProduct);
router.delete("/:id", deleteProduct);

router.post("/byId", getProductById);

router.get('/warehouses', getAllWarehouses)

export default router;
