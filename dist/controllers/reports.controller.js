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
exports.getTodayOverviewV2 = exports.getTodayOverview = void 0;
const reports_service_1 = require("../services/reports.service");
const parseBooleanFlag = (value) => {
    if (typeof value !== "string") {
        return false;
    }
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes";
};
const getTodayOverview = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const includeRaw = parseBooleanFlag(req.query.includeRaw);
        const overview = yield (0, reports_service_1.buildTodayOverview)({ includeRaw });
        const payload = Object.assign(Object.assign({}, overview), { meta: Object.assign(Object.assign({}, overview.meta), { deprecated: true, migrateTo: "/api/reports/today-overview-v2" }) });
        return res.json(payload);
    }
    catch (error) {
        console.error("Today overview error:", error);
        return res
            .status(500)
            .json({ error: "Failed to generate today work overview" });
    }
});
exports.getTodayOverview = getTodayOverview;
const getTodayOverviewV2 = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const details = parseBooleanFlag(req.query.details);
        const overview = yield (0, reports_service_1.buildTodayOverviewV2)({ details });
        return res.json(overview);
    }
    catch (error) {
        console.error("Today overview v2 error:", error);
        return res
            .status(500)
            .json({ error: "Failed to generate today work overview v2" });
    }
});
exports.getTodayOverviewV2 = getTodayOverviewV2;
