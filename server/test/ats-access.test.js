import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import mongoose from 'mongoose';
import ats from '../src/routes/recruitmentWorkflowRoutes.js';
import { protect } from '../src/middleware/auth.js';
import Submission from '../src/models/RecruitmentSubmission.js';
import Job from '../src/models/Job.js';

test('ATS route registers the Partner model before populating partner submissions', () => {
  assert.equal(mongoose.model('Partner').modelName, 'Partner');
});

// Exercise the real ATS routing and permission chain; authentication and DB
// records are substituted so these regressions never access production data.
test('ATS honours view, submit and review independently through its real routes', async (t) => {
  const queries = [];
  const query = (value) => ({ select() { return this; }, populate() { return this; }, sort() { return this; }, limit() { return this; }, lean: async () => value, then: (resolve, reject) => Promise.resolve(value).then(resolve, reject) });
  t.mock.method(Submission, 'find', (filter) => { queries.push(filter); return query([]); });
  t.mock.method(Submission, 'findOne', () => query(null));
  t.mock.method(Job, 'find', () => query([]));
  let member = { _id: '507f1f77bcf86cd799439011', role: 'viewer', permissions: [] };
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = member; next(); });
  const router = express.Router();
  router.stack = ats.stack.filter((layer) => layer.handle !== protect);
  app.use('/ats', router);
  app.use((error, req, res, next) => res.status(error.statusCode || 400).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/ats`;
  assert.equal((await fetch(`${base}/overview`)).status, 403);
  assert.equal(queries.length, 0);

  member.permissions = ['recruitmentPipeline.view'];
  const response = await fetch(`${base}/overview`);
  assert.equal(response.status, 200, 'view access must not require the nonexistent approve permission');
  const memberOverview = await response.json();
  assert.equal(memberOverview.canReview, false);
  assert.equal(memberOverview.scope, 'mine');
  assert.equal(String(queries.at(-1)['submittedBy.user']), member._id, 'recruiters only see submissions they uploaded');
  assert.equal(queries.at(-1).$or, undefined, 'later workflow stages must not expose submissions to other recruiters');
  assert.equal((await fetch(`${base}/507f1f77bcf86cd799439012/cv-review`)).status, 404, 'CV reading passes permission checks, then finds no fixture record');
  assert.equal((await fetch(base, { method: 'POST' })).status, 403);
  assert.equal((await fetch(`${base}/507f1f77bcf86cd799439012/stage`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage: 'Hired' }) })).status, 403);
  assert.equal((await fetch(`${base}/507f1f77bcf86cd799439012/security-scan`, { method: 'POST' })).status, 403);

  member.permissions = ['recruitmentPipeline.submit'];
  assert.equal((await fetch(base, { method: 'POST' })).status, 400, 'submit permission reaches input validation without requiring create');
  member.permissions = ['recruitmentPipeline.review'];
  const reviewer = await fetch(`${base}/overview`);
  assert.equal(reviewer.status, 200);
  const reviewerOverview = await reviewer.json();
  assert.equal(reviewerOverview.canReview, true);
  assert.equal(reviewerOverview.scope, 'all');
  assert.deepEqual(queries.at(-1), {});
  assert.equal((await fetch(`${base}/507f1f77bcf86cd799439012/security-scan`, { method: 'POST' })).status, 404, 'review permission reaches record lookup without requiring edit');
  member.permissions = [];
  assert.equal((await fetch(`${base}/overview`)).status, 403, 'revocation applies to the next request');
});
