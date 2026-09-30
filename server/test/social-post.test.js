import assert from "node:assert/strict";
import test from "node:test";
import { buildJobCaption, jobUrl, socialStatus } from "../src/services/socialPostService.js";

const job = {
  _id: "64b7f0c2a1b2c3d4e5f60718",
  title: "Registered Nurse (RGN)",
  location: "Bradford BD2",
  salary: "£32,000 per annum",
  type: "Permanent",
  shift: "Days and nights",
  clientName: "Oak Lodge",
  description: "Join Oak Lodge as a registered nurse. You will lead medication rounds and care plans for residents with dementia."
};

test("caption never contains the client name", () => {
  const caption = buildJobCaption(job);
  assert.equal(/oak lodge/i.test(caption), false);
  assert.match(caption, /We're hiring: Registered Nurse \(RGN\)/);
  assert.match(caption, /Location: Bradford BD2/);
  assert.match(caption, /Apply now: https:\/\/www\.innovexresourcegroup\.co\.uk\/jobs\/64b7f0c2a1b2c3d4e5f60718/);
});

test("caption has relevant hashtags and stays a sensible length", () => {
  const caption = buildJobCaption(job);
  assert.match(caption, /#NursingJobs/);
  assert.match(caption, /#BradfordJobs/);
  assert.ok(caption.length < 900);
  assert.ok(caption.split("#").length - 1 <= 8);
});

test("job link uses the configured site address", () => {
  process.env.SITE_URL = "https://example.test/";
  assert.equal(jobUrl(job), "https://example.test/jobs/64b7f0c2a1b2c3d4e5f60718");
  delete process.env.SITE_URL;
});

test("platforms report as not connected without credentials", () => {
  for (const key of ["FACEBOOK_PAGE_ID", "FACEBOOK_PAGE_ACCESS_TOKEN", "INSTAGRAM_BUSINESS_ACCOUNT_ID", "INSTAGRAM_ACCESS_TOKEN"]) delete process.env[key];
  const status = socialStatus();
  assert.equal(status.facebook, false);
  assert.equal(status.instagram, false);
  assert.equal(status.linkedin, "share");
});

test("Instagram Login tokens use graph.instagram.com, Page tokens use graph.facebook.com", async () => {
  const { postToInstagram } = await import("../src/services/socialPostService.js");
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    const body = String(url).includes("/media_publish") ? { id: "999" } : String(url).includes("status_code") ? { status_code: "FINISHED" } : String(url).includes("permalink") ? { permalink: "https://instagram.test/p/1" } : { id: "111" };
    return { ok: true, status: 200, json: async () => body };
  };
  try {
    process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID = "1789";
    process.env.INSTAGRAM_ACCESS_TOKEN = "IGAAtoken";
    await postToInstagram({ caption: "Hello", imageUrl: "https://example.test/a.jpg" });
    assert.ok(calls.length >= 3 && calls.every((url) => url.startsWith("https://graph.instagram.com/")));
    calls.length = 0;
    delete process.env.INSTAGRAM_ACCESS_TOKEN;
    process.env.FACEBOOK_PAGE_ACCESS_TOKEN = "EAAtoken";
    await postToInstagram({ caption: "Hello", imageUrl: "https://example.test/a.jpg" });
    assert.ok(calls.every((url) => url.startsWith("https://graph.facebook.com/")));
  } finally {
    globalThis.fetch = realFetch;
    for (const key of ["INSTAGRAM_BUSINESS_ACCOUNT_ID", "INSTAGRAM_ACCESS_TOKEN", "FACEBOOK_PAGE_ACCESS_TOKEN"]) delete process.env[key];
  }
});
