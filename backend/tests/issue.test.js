const request = require('supertest');
const { app, connect, disconnect, clear, registerUser, createRoleUser, issueBody } = require('./helpers');

beforeAll(connect);
afterAll(disconnect);
beforeEach(clear);

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const create = (token, body = issueBody) => request(app).post('/api/v1/issues').set(auth(token)).send(body);

describe('Issues CRUD', () => {
  it('requires login', async () => {
    expect((await request(app).get('/api/v1/issues')).statusCode).toBe(401);
  });

  it('creates, reads, updates and deletes an own issue', async () => {
    const { token } = await registerUser('Stu', 'stu@test.com');
    const created = await create(token);
    expect(created.statusCode).toBe(201);
    const id = created.body.data._id;

    expect((await request(app).get(`/api/v1/issues/${id}`).set(auth(token))).statusCode).toBe(200);

    const upd = await request(app).put(`/api/v1/issues/${id}`).set(auth(token)).send({ title: 'Fan is broken again' });
    expect(upd.statusCode).toBe(200);
    expect(upd.body.data.title).toBe('Fan is broken again');

    expect((await request(app).delete(`/api/v1/issues/${id}`).set(auth(token))).statusCode).toBe(200);
    expect((await request(app).get(`/api/v1/issues/${id}`).set(auth(token))).statusCode).toBe(404);
  });

  it('validates input (400) and rejects bad ids (400)', async () => {
    const { token } = await registerUser('Stu', 'stu@test.com');
    const bad = await create(token, { ...issueBody, title: 'x', category: 'nonsense' });
    expect(bad.statusCode).toBe(400);
    expect(bad.body.errors.length).toBeGreaterThanOrEqual(2);
    expect((await request(app).get('/api/v1/issues/not-an-id').set(auth(token))).statusCode).toBe(400);
  });

  it("stops a student editing or deleting someone else's issue", async () => {
    const a = await registerUser('A', 'a@test.com');
    const b = await registerUser('B', 'b@test.com');
    const { body } = await create(a.token);
    const id = body.data._id;
    expect((await request(app).put(`/api/v1/issues/${id}`).set(auth(b.token)).send({ title: 'Hacked title!' })).statusCode).toBe(403);
    expect((await request(app).delete(`/api/v1/issues/${id}`).set(auth(b.token))).statusCode).toBe(403);
  });

  it('stops a student changing status / priority', async () => {
    const a = await registerUser('A', 'a@test.com');
    const { body } = await create(a.token);
    const res = await request(app).put(`/api/v1/issues/${body.data._id}`).set(auth(a.token)).send({ status: 'resolved' });
    expect(res.statusCode).toBe(403);
    const res2 = await request(app).put(`/api/v1/issues/${body.data._id}`).set(auth(a.token)).send({ priority: 'critical' });
    expect(res2.statusCode).toBe(403);
  });

  it('paginates, searches and filters', async () => {
    const { token } = await registerUser('Stu', 'stu@test.com');
    for (let i = 0; i < 12; i++) await create(token, { ...issueBody, title: `Issue number ${i} wifi`, category: i % 2 ? 'wifi' : 'furniture' });
    const p1 = await request(app).get('/api/v1/issues?page=1&limit=5').set(auth(token));
    expect(p1.body.data).toHaveLength(5);
    expect(p1.body.pagination).toMatchObject({ total: 12, pages: 3 });
    const f = await request(app).get('/api/v1/issues?category=wifi').set(auth(token));
    expect(f.body.pagination.total).toBe(6);
    const s = await request(app).get('/api/v1/issues?search=number 11').set(auth(token));
    expect(s.body.pagination.total).toBe(1);
  });
});

describe('Upvotes and comments', () => {
  it('prevents duplicate upvotes (toggle) and own-issue upvotes', async () => {
    const owner = await registerUser('Owner', 'o@test.com');
    const other = await registerUser('Other', 'x@test.com');
    const { body } = await create(owner.token);
    const id = body.data._id;

    expect((await request(app).post(`/api/v1/issues/${id}/upvote`).set(auth(owner.token))).statusCode).toBe(400);

    const up = await request(app).post(`/api/v1/issues/${id}/upvote`).set(auth(other.token));
    expect(up.body.data).toEqual({ upvoted: true, upvoteCount: 1 });
    const again = await request(app).post(`/api/v1/issues/${id}/upvote`).set(auth(other.token));
    expect(again.body.data).toEqual({ upvoted: false, upvoteCount: 0 });

    // two simultaneous upvotes from the same user can never produce count 2
    await Promise.all([
      request(app).post(`/api/v1/issues/${id}/upvote`).set(auth(other.token)),
      request(app).post(`/api/v1/issues/${id}/upvote`).set(auth(other.token)),
    ]);
    const check = await request(app).get(`/api/v1/issues/${id}`).set(auth(other.token));
    expect(check.body.data.upvoteCount).toBeLessThanOrEqual(1);
  });

  it('adds and deletes comments with correct permissions', async () => {
    const a = await registerUser('A', 'a@test.com');
    const b = await registerUser('B', 'b@test.com');
    const { body } = await create(a.token);
    const id = body.data._id;

    const c = await request(app).post(`/api/v1/issues/${id}/comments`).set(auth(b.token)).send({ text: 'Same here!' });
    expect(c.statusCode).toBe(201);
    expect((await request(app).post(`/api/v1/issues/${id}/comments`).set(auth(b.token)).send({ text: '  ' })).statusCode).toBe(400);

    const list = await request(app).get(`/api/v1/issues/${id}/comments`).set(auth(a.token));
    expect(list.body.data).toHaveLength(1);

    expect((await request(app).delete(`/api/v1/comments/${c.body.data._id}`).set(auth(a.token))).statusCode).toBe(403);
    expect((await request(app).delete(`/api/v1/comments/${c.body.data._id}`).set(auth(b.token))).statusCode).toBe(200);
    const issue = await request(app).get(`/api/v1/issues/${id}`).set(auth(a.token));
    expect(issue.body.data.commentCount).toBe(0);
  });
});

describe('Admin operations', () => {
  it('lets admin assign staff, change priority and status; blocks non-staff assignment', async () => {
    const student = await registerUser('Stu', 'stu@test.com');
    const admin = await createRoleUser('admin', 'admin@test.com');
    const staff = await createRoleUser('maintenance', 'staff@test.com');
    const { body } = await create(student.token);
    const id = body.data._id;

    const bad = await request(app).put(`/api/v1/issues/${id}`).set(auth(admin.token)).send({ assignedTo: student.id });
    expect(bad.statusCode).toBe(400);

    const ok = await request(app).put(`/api/v1/issues/${id}`).set(auth(admin.token))
      .send({ assignedTo: staff.id, priority: 'high', status: 'in-progress' });
    expect(ok.statusCode).toBe(200);
    expect(ok.body.data.priority).toBe('high');
    expect(ok.body.data.status).toBe('in-progress');
    expect(ok.body.data.assignedTo.name).toBeDefined();

    // assigned maintenance staff may update status only
    const st = await request(app).put(`/api/v1/issues/${id}`).set(auth(staff.token)).send({ status: 'resolved' });
    expect(st.statusCode).toBe(200);
    expect(st.body.data.status).toBe('resolved');
    const pr = await request(app).put(`/api/v1/issues/${id}`).set(auth(staff.token)).send({ priority: 'low' });
    expect(pr.statusCode).toBe(403);
  });

  it('protects admin routes from students and serves analytics', async () => {
    const student = await registerUser('Stu', 'stu@test.com');
    const admin = await createRoleUser('admin', 'admin@test.com');
    await create(student.token);

    expect((await request(app).get('/api/v1/users').set(auth(student.token))).statusCode).toBe(403);
    expect((await request(app).get('/api/v1/users').set(auth(admin.token))).statusCode).toBe(200);

    const stats = await request(app).get('/api/v1/dashboard/stats').set(auth(admin.token));
    expect(stats.statusCode).toBe(200);
    expect(stats.body.data.total).toBe(1);
    expect(stats.body.data.byStatus.find((s) => s._id === 'open').count).toBe(1);

    const filtered = await request(app).get('/api/v1/dashboard/stats?building=Library').set(auth(admin.token));
    expect(filtered.body.data.total).toBe(0);
  });

  it('lets admin deactivate a user, who can then no longer log in', async () => {
    const student = await registerUser('Stu', 'stu@test.com');
    const admin = await createRoleUser('admin', 'admin@test.com');
    const del = await request(app).delete(`/api/v1/users/${student.id}`).set(auth(admin.token));
    expect(del.statusCode).toBe(200);
    const login = await request(app).post('/api/v1/auth/login').send({ email: 'stu@test.com', password: 'Password123' });
    expect(login.statusCode).toBe(401);
  });
});
