import assert from "node:assert/strict";
import test from "node:test";
import { redactClientName } from "../src/utils/jobQuality.js";

test("client name is removed from public and candidate-facing job data", () => {
  const job = redactClientName({
    title: "Carer at Oak Lodge",
    description: "Join the oak lodge Care Home team",
    requirements: ["Work at Oak Lodge"],
    location: "Bradford BD2",
    clientName: "Oak Lodge"
  });
  assert.equal("clientName" in job, false);
  assert.equal(job.title, "Carer at our client");
  assert.equal(job.description, "Join the our client Care Home team");
  assert.deepEqual(job.requirements, ["Work at our client"]);
  assert.equal(job.location, "Bradford BD2");
});

test("records without a client name pass through unchanged", () => {
  assert.deepEqual(redactClientName({ title: "Nurse", clientName: "" }), { title: "Nurse" });
  assert.equal(redactClientName(null), null);
});

test("names with regex characters are treated literally", () => {
  const job = redactClientName({ description: "Care (North) Ltd. is hiring", clientName: "Care (North) Ltd." });
  assert.equal(job.description, "our client is hiring");
});
