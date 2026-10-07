import assert from "node:assert/strict";
import test from "node:test";
import { canonicalRoleLabel, exactRolePattern } from "../src/routes/candidateRoutes.js";

test("role labels remove import separators without changing meaningful text", () => {
  assert.equal(canonicalRoleLabel("  Senior   Care Assistant |  "), "Senior Care Assistant");
  assert.equal(canonicalRoleLabel("RMN/RGN"), "RMN/RGN");
  assert.equal(canonicalRoleLabel("HCA"), "Healthcare Assistant");
  assert.equal(canonicalRoleLabel("Health Care Assistant"), "Healthcare Assistant");
});

test("healthcare assistant selection includes HCA naming variants", () => {
  const pattern = exactRolePattern("Healthcare Assistant");
  assert.equal(pattern.test("HCA"), true);
  assert.equal(pattern.test("Health Care Assistant"), true);
  assert.equal(pattern.test("Healthcare Assistant |"), true);
  assert.equal(pattern.test("Senior Healthcare Assistant"), false);
});

test("selected role patterns match formatting variants but not another role", () => {
  const pattern = exactRolePattern("Senior RGN");
  assert.equal(pattern.test("Senior RGN"), true);
  assert.equal(pattern.test(" senior-rgn | "), true);
  assert.equal(pattern.test("Senior RGN Nurse"), false);
});
