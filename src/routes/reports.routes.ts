import express from "express";
import {
  getSalesReport,
  getTodayOverview,
  getTodayOverviewV2,
} from "../controllers/reports.controller";

const router = express.Router();

router.get("/today-overview", getTodayOverview);
router.get("/today-overview-v2", getTodayOverviewV2);
router.get("/sales", getSalesReport);

export default router;
