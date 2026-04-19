import { Request, Response } from "express";
import {
  buildTodayOverview,
  buildTodayOverviewV2,
} from "../services/reports.service";

const parseBooleanFlag = (value: unknown): boolean => {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
};

export const getTodayOverview = async (req: Request, res: Response) => {
  try {
    const includeRaw = parseBooleanFlag(req.query.includeRaw);
    const overview = await buildTodayOverview({ includeRaw });
    const payload = {
      ...overview,
      meta: {
        ...overview.meta,
        deprecated: true,
        migrateTo: "/api/reports/today-overview-v2",
      },
    };
    return res.json(payload);
  } catch (error) {
    console.error("Today overview error:", error);
    return res
      .status(500)
      .json({ error: "Failed to generate today work overview" });
  }
};

export const getTodayOverviewV2 = async (req: Request, res: Response) => {
  try {
    const details = parseBooleanFlag(req.query.details);
    const overview = await buildTodayOverviewV2({ details });
    return res.json(overview);
  } catch (error) {
    console.error("Today overview v2 error:", error);
    return res
      .status(500)
      .json({ error: "Failed to generate today work overview v2" });
  }
};
