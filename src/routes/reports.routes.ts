import express from "express";
import {
  getTodayOverview,
  getTodayOverviewV2,
} from "../controllers/reports.controller";

const router = express.Router();

router.get("/today-overview", getTodayOverview);
router.get("/today-overview-v2", getTodayOverviewV2);

export default router;
