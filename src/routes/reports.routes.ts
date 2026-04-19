import express from "express";
import { getTodayOverview } from "../controllers/reports.controller";

const router = express.Router();

router.get("/today-overview", getTodayOverview);

export default router;
