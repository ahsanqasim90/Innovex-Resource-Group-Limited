import assert from "node:assert/strict";
import test from "node:test";
import { canonicalRoleLabel, exactRolePattern } from "../src/routes/candidateRoutes.js";

test("role labels remove import separators without changing meaningful text", () => {
  assert.equal(canonicalRoleLabel("  Senior   Care Assistant |  "), "Senior Care Assistant");
  assert.equal(canonicalRoleLabel("RMN/RGN"), "RMN/RGN");
});

test("selected role patterns match formatting variants but not another role", () => {
  const pattern = exactRolePattern("Senior RGN");
  assert.equal(pattern.test("Senior RGN"), true);
  assert.equal(pattern.test(" senior-rgn | "), true);
  assert.equal(pattern.test("Senior RGN Nurse"), false);
});
