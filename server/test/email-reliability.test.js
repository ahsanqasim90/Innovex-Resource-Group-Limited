import assert from "node:assert/strict";
import test from "node:test";
import multer from "multer";
import { isCronAuthorized, rejectUnlessCron } from "../src/utils/cronAuth.js";
import { describeMailError } from "../src/services/emailService.js";
import { dailyLimitReason, hasReachedDailyLimit, mailboxDailyLimit, startOfUtcDay } from "../src/services/mailboxLimitService.js";
import { errorHandler } from "../src/middleware/errorHandler.js";

function fakeResponse() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(payload) { this.body = payload; return this; } };
}

test("cron endpoints stay closed unless the secret matches", () => {
  const original = process.env.CRON_SECRET;
  try {
    delete process.env.CRON_SECRET;
    assert.equal(isCronAuthorized({ headers: { authorization: "Bearer anything" } }), false);
    assert.equal(isCronAuthorized({ headers: {} }), false);

    process.env.CRON_SECRET = "correct-secret";
    assert.equal(isCronAuthorized({ headers: { authorization: "Bearer correct-secret" } }), true);
    assert.equal(isCronAuthorized({ headers: { authorization: "Bearer wrong" } }), false);
    assert.equal(isCronAuthorized({ headers: {}, query: { secret: "correct-secret" } }), false);

    const res = fakeResponse();
    assert.equal(rejectUnlessCron({ headers: {} }, res), true);
    assert.equal(res.statusCode, 401);
    assert.equal(rejectUnlessCron({ headers: { authorization: "Bearer correct-secret" } }, fakeResponse()), false);
  } finally {
    if (original === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = original;
  }
});

test("mail errors are turned into messages staff can act on", () => {
  assert.match(describeMailError({ code: "EAUTH", response: "535 Authentication failed" }), /rejected the mailbox login/);
  assert.match(describeMailError({ code: "ETIMEDOUT", message: "timeout" }), /did not respond in time/);
  assert.match(describeMailError({ code: "EENVELOPE", message: "bad recipient" }), /recipient address was rejected/);
  assert.match(describeMailError({ responseCode: 451, response: "try later" }), /slow down/);
  assert.match(describeMailError({ responseCode: 550, response: "no such user" }), /rejected this message \(550\)/);
  assert.equal(describeMailError({}), "Email could not be sent");
});

test("the daily mailbox limit stops sending before the cap is passed", () => {
  const original = process.env.MAILBOX_DAILY_LIMIT;
  try {
    delete process.env.MAILBOX_DAILY_LIMIT;
    assert.equal(mailboxDailyLimit(), 3000);
    process.env.MAILBOX_DAILY_LIMIT = "1000";
    assert.equal(mailboxDailyLimit(), 1000);
    process.env.MAILBOX_DAILY_LIMIT = "not-a-number";
    assert.equal(mailboxDailyLimit(), 3000);
  } finally {
    if (original === undefined) delete process.env.MAILBOX_DAILY_LIMIT; else process.env.MAILBOX_DAILY_LIMIT = original;
  }
  assert.equal(hasReachedDailyLimit(2990, 9, 3000), false);
  assert.equal(hasReachedDailyLimit(2990, 10, 3000), true);
  assert.equal(hasReachedDailyLimit(0, 0, 900), false);
  assert.match(dailyLimitReason("info@example.com", 3000, 3000), /info@example\.com.*3000 of 3000/);
  assert.equal(startOfUtcDay(new Date("2026-09-20T15:45:10Z")).toISOString(), "2026-09-20T00:00:00.000Z");
});

test("upload mistakes return a 4xx message instead of a server error", () => {
  const tooLarge = fakeResponse();
  errorHandler(new multer.MulterError("LIMIT_FILE_SIZE", "cv"), { method: "POST", originalUrl: "/api/x", path: "/x" }, tooLarge, () => {});
  assert.equal(tooLarge.statusCode, 413);
  assert.match(tooLarge.body.message, /too large/);

  const unexpected = fakeResponse();
  errorHandler(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "other"), { method: "POST", originalUrl: "/api/x", path: "/x" }, unexpected, () => {});
  assert.equal(unexpected.statusCode, 400);
});
