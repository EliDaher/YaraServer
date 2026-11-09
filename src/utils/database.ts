import {
  DatabaseReference,
  get,
  set as firebaseSet,
  update as firebaseUpdate,
  push as firebasePush,
} from "firebase/database";
import { normalizeNumbers } from "./numbers";

// Preserve unchanged legacy fields when a controller writes an entire existing record.
export function normalizeChanges(value: any, previous: any, key = ""): any {
  if (value === previous) return value;
  if (Array.isArray(value))
    return value.map((item, index) =>
      normalizeChanges(item, previous?.[index]),
    );
  if (value && typeof value === "object") {
    for (const field of Object.keys(value)) {
      value[field] = normalizeChanges(
        value[field],
        previous?.[field],
        field.split("/").pop() || "",
      );
    }
    return value;
  }
  return normalizeNumbers(value, key);
}
async function prepare(reference: DatabaseReference, value: any) {
  // Normal two-decimal writes need no extra read. Legacy precision is compared
  // only when normalization would otherwise rewrite an unchanged old field.
  const rounded = normalizeNumbers(value, reference.key || "");
  if (JSON.stringify(rounded) === JSON.stringify(value)) return value;
  const previous = (await get(reference)).val();
  return normalizeChanges(value, previous, reference.key || "");
}
export async function set(
  reference: DatabaseReference,
  value: any,
): Promise<void> {
  await firebaseSet(reference, await prepare(reference, value));
}
export async function update(
  reference: DatabaseReference,
  value: any,
): Promise<void> {
  await firebaseUpdate(reference, await prepare(reference, value));
}
export function push(reference: DatabaseReference, value?: any) {
  return value === undefined
    ? firebasePush(reference)
    : firebasePush(reference, normalizeNumbers(value));
}
