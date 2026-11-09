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
exports.normalizeChanges = normalizeChanges;
exports.set = set;
exports.update = update;
exports.push = push;
const database_1 = require("firebase/database");
const numbers_1 = require("./numbers");
// Preserve unchanged legacy fields when a controller writes an entire existing record.
function normalizeChanges(value, previous, key = "") {
    if (value === previous)
        return value;
    if (Array.isArray(value))
        return value.map((item, index) => normalizeChanges(item, previous === null || previous === void 0 ? void 0 : previous[index]));
    if (value && typeof value === "object") {
        for (const field of Object.keys(value)) {
            value[field] = normalizeChanges(value[field], previous === null || previous === void 0 ? void 0 : previous[field], field.split("/").pop() || "");
        }
        return value;
    }
    return (0, numbers_1.normalizeNumbers)(value, key);
}
function prepare(reference, value) {
    return __awaiter(this, void 0, void 0, function* () {
        // Normal two-decimal writes need no extra read. Legacy precision is compared
        // only when normalization would otherwise rewrite an unchanged old field.
        const rounded = (0, numbers_1.normalizeNumbers)(value, reference.key || "");
        if (JSON.stringify(rounded) === JSON.stringify(value))
            return value;
        const previous = (yield (0, database_1.get)(reference)).val();
        return normalizeChanges(value, previous, reference.key || "");
    });
}
function set(reference, value) {
    return __awaiter(this, void 0, void 0, function* () {
        yield (0, database_1.set)(reference, yield prepare(reference, value));
    });
}
function update(reference, value) {
    return __awaiter(this, void 0, void 0, function* () {
        yield (0, database_1.update)(reference, yield prepare(reference, value));
    });
}
function push(reference, value) {
    return value === undefined
        ? (0, database_1.push)(reference)
        : (0, database_1.push)(reference, (0, numbers_1.normalizeNumbers)(value));
}
