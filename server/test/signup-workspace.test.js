import assert from "node:assert/strict";
import test from "node:test";
import { slugify } from "../src/routes/organizationRoutes.js";
import { rolePresets, allPermissions } from "../src/config/permissions.js";

test("workspace slugs are lowercased, hyphenated and length-capped", () => {
  assert.equal(slugify("Acme Recruitment Ltd"), "acme-recruitment-ltd");
  assert.equal(slugify("  Spaces & Punctuation!! "), "spaces-punctuation");
  assert.equal(slugify(""), "");
  assert.equal(slugify("A".repeat(80)).length, 60);
});

test("a self-serve signup admin gets the full admin permission preset", () => {
  // The signup route assigns role "admin" with rolePresets.admin - confirms a new
  // agency's first user can manage their own workspace (team, email accounts, etc.)
  // without needing Innovex to grant anything by hand.
  assert.deepEqual(rolePresets.admin, allPermissions);
});
