import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import attendanceRouter from '../src/routes/attendanceRoutes.js';
import { protect } from '../src/middleware/auth.js';
import Attendance from '../src/models/Attendance.js';
import User from '../src/models/User.js';
import ActivityLog from '../src/models/ActivityLog.js';

// Real routing/permission checks with a test identity and in-memory records.
// No production database or attendance entries are accessed.
test('staff can mark, update and check out their own attendance without report access', async (t) => {
  const ownId = '507f1f77bcf86cd799439011';
  const otherId = '507f1f77bcf86cd799439022';
  const member = { _id: ownId, name: 'Example staff', email: 'staff@example.test', role: 'viewer', permissions: [] };
  let record = null;
  let previousOpenRecord = null;
  let reportQueries = 0;
  const query = (value) => ({ select() { return this; }, sort() { return this; }, lean: async () => value, then: (resolve, reject) => Promise.resolve(value).then(resolve, reject) });
  t.mock.method(Attendance, 'findOne', (filter) => {
    assert.equal(String(filter.user), ownId, 'all personal operations must scope records to the signed-in member');
    if (filter.attendanceDate) {
      assert.match(filter.attendanceDate, /^\d{4}-\d{2}-\d{2}$/);
      return query(record);
    }
    assert.equal(filter.checkOutAt, null);
    assert.ok(filter.checkInAt.$gte instanceof Date, 'open-session recovery must have a recent cutoff');
    return query(previousOpenRecord);
  });
  t.mock.method(Attendance, 'create', async (data) => {
    assert.equal(String(data.user), ownId);
    record = { _id: '507f1f77bcf86cd799439033', cvsDownloaded: 0, cvsSubmitted: 0, ...data, save: async () => {} };
    return record;
  });
  t.mock.method(ActivityLog, 'create', async () => ({}));
  t.mock.method(Attendance, 'find', () => { reportQueries += 1; return query([]); });
  t.mock.method(Attendance, 'distinct', async () => []);
  t.mock.method(User, 'find', () => query([]));
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = member; next(); });
  const router = express.Router();
  router.stack = attendanceRouter.stack.filter((layer) => layer.handle !== protect);
  app.use('/attendance', router);
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/attendance`;
  const send = (path, method, body = {}) => fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  assert.equal((await fetch(base + '/today')).status, 200);
  const checkIn = await send('/check-in', 'POST', { workLocation: 'Remote', user: otherId, employeeName: 'Another person' });
  assert.equal(checkIn.status, 201, 'automatic My Attendance access must permit check-in');
  const marked = await checkIn.json();
  assert.equal(marked.user, ownId);
  assert.equal(marked.employeeName, member.name);
  assert.equal((await send('/check-in', 'POST')).status, 409, 'duplicate check-in remains blocked');

  const update = await send('/today', 'PUT', { cvsDownloaded: 8, cvsSubmitted: 3, user: otherId, notes: 'Daily work' });
  assert.equal(update.status, 200);
  assert.equal((await update.json()).cvsSubmitted, 3);
  assert.equal((await send('/today', 'PUT', { cvsDownloaded: -1 })).status, 400);
  const checkOut = await send('/check-out', 'POST', { cvsDownloaded: 9, cvsSubmitted: 4 });
  assert.equal(checkOut.status, 200);
  assert.ok((await checkOut.json()).checkOutAt);
  assert.equal((await send('/today', 'PUT', { notes: 'Change after checkout' })).status, 409);
  const repeatedCheckOut = await send('/check-out', 'POST');
  assert.equal(repeatedCheckOut.status, 200, 'checkout retries must be safe when the first response was lost');
  assert.ok((await repeatedCheckOut.json()).checkOutAt);

  record = null;
  previousOpenRecord = {
    _id: '507f1f77bcf86cd799439044',
    user: ownId,
    employeeName: member.name,
    employeeEmail: member.email,
    attendanceDate: '2026-01-01',
    checkInAt: new Date(),
    checkOutAt: null,
    cvsDownloaded: 2,
    cvsSubmitted: 1,
    workLocation: 'Office',
    notes: '',
    save: async () => {}
  };
  const recovered = await fetch(base + '/today');
  assert.equal(recovered.status, 200);
  assert.equal((await recovered.json()).attendance._id, previousOpenRecord._id, 'an open cross-date session must remain visible');
  const recoveredCheckOut = await send('/check-out', 'POST', { cvsDownloaded: 3 });
  assert.equal(recoveredCheckOut.status, 200, 'an open cross-date session must be possible to close');
  assert.ok((await recoveredCheckOut.json()).checkOutAt);

  for (const path of ['/report', '/report.pdf', `/report?userId=${ownId}`]) {
    assert.equal((await fetch(base + path)).status, 403, 'self attendance must not grant employee reports');
  }
  assert.equal(reportQueries, 0, 'unauthorised report requests cannot query employee records');
  member.permissions = ['attendance.manage'];
  assert.equal((await fetch(base + '/report')).status, 200, 'explicit report access still works');
  assert.equal(reportQueries, 1);
  member.permissions = [];
  assert.equal((await fetch(base + '/report')).status, 403);
});
