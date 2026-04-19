"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTodayOverview = void 0;
const reports_service_1 = require("../services/reports.service");
const parseIncludeRaw = (value) => {
    if (typeof value !== "string") {
        return false;
    }
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes";
};
const getTodayOverview = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const includeRaw = parseIncludeRaw(req.query.includeRaw);
        const overview = yield (0, reports_service_1.buildTodayOverview)({ includeRaw });
        return res.json(overview);
    }
    catch (error) {
        console.error("Today overview error:", error);
        return res
            .status(500)
            .json({ error: "Failed to generate today work overview" });
    }
});
exports.getTodayOverview = getTodayOverview;
