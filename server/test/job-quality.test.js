import assert from "node:assert/strict";
import test from "node:test";
import { extractPostcode, normaliseJobPayload, normaliseSalary, salaryProblem } from "../src/utils/jobQuality.js";

test("postcodes are taken from the location text", () => {
  assert.equal(extractPostcode("Southport, PR9"), "PR9");
  assert.equal(extractPostcode("Malton, North Yorkshire, YO17"), "YO17");
  assert.equal(extractPostcode("OX14 3UJ"), "OX14 3UJ");
  assert.equal(extractPostcode("Maldon, CM9 8JX"), "CM9 8JX");
  assert.equal(extractPostcode("Derby"), "");
  assert.equal(extractPostcode("Warrington, WA, United Kingdom"), "");
});

test("salary text gets a currency symbol when it is missing", () => {
  assert.equal(normaliseSalary("60,000 per annum"), "£60,000 per annum");
  assert.equal(normaliseSalary("16 per hour"), "£16 per hour");
  assert.equal(normaliseSalary("£13.50 per hour"), "£13.50 per hour");
  assert.equal(normaliseSalary("€14.15–€17.18 per hour"), "€14.15–€17.18 per hour");
  assert.equal(normaliseSalary("TBC"), "TBC");
});

test("pay figures that contradict their pay period are rejected", () => {
  assert.match(salaryProblem("£16 per annum"), /hourly rate/);
  assert.match(salaryProblem("£14 per annum"), /hourly rate/);
  assert.match(salaryProblem("£60,000 per hour"), /annual figure/);
  assert.equal(salaryProblem("£55K per annum"), "");
  assert.equal(salaryProblem("55-65K per annum"), "");
  assert.equal(salaryProblem("£13.50 per hour"), "");
  assert.equal(salaryProblem("TBC"), "");
});

test("job payloads are tidied without touching fields that were not sent", () => {
  const payload = normaliseJobPayload({ title: "  REGISTERED   NURSE ", location: "Wolverhampton,  WV6", salary: "22.36 per hour" });
  assert.equal(payload.title, "Registered Nurse");
  assert.equal(payload.location, "Wolverhampton, WV6");
  assert.equal(payload.salary, "£22.36 per hour");
  assert.equal(payload.postcode, "WV6");
  assert.equal("shift" in payload, false);

  const edited = normaliseJobPayload({ location: "Leyland, PR25" }, { postcode: "PR26" });
  assert.equal("postcode" in edited, false);
  assert.equal(normaliseJobPayload({ title: "HCA" }).title, "HCA");
});
