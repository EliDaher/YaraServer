import express from "express";
import {
  createUser,
  deleteUser,
  getOperations,
  getUserOperations,
  listUsers,
  requireAdminUser,
  updateUser,
} from "../controllers/users.controller";

const router = express.Router();

router.use(requireAdminUser);

router.get("/operations", getOperations);
router.get("/:username/operations", getUserOperations);
router.get("/", listUsers);
router.post("/", createUser);
router.put("/:username", updateUser);
router.delete("/:username", deleteUser);

export default router;
