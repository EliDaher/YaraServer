import { Request, Response } from "express";
import { buildTodayOverview } from "../services/reports.service";

const parseIncludeRaw = (value: unknown): boolean => {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
};

export const getTodayOverview = async (req: Request, res: Response) => {
  try {
    const includeRaw = parseIncludeRaw(req.query.includeRaw);
    const overview = await buildTodayOverview({ includeRaw });
    return res.json(overview);
  } catch (error) {
    console.error("Today overview error:", error);
    return res
      .status(500)
      .json({ error: "Failed to generate today work overview" });
  }
};
