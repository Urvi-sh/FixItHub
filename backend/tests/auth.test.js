const request = require('supertest');
const { app, connect, disconnect, clear } = require('./helpers');

beforeAll(connect);
afterAll(disconnect);
beforeEach(clear);

const user = { name: 'Test Student', email: 'test@student.com', password: 'Password123' };

describe('Auth API', () => {
  it('registers a user and never returns the password', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(user);
    expect(res.statusCode).toBe(201);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.password).toBeUndefined();
  });

  it('ignores a role sent in the body (no self-promotion to admin)', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ ...user, role: 'admin' });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.user.role).toBe('student');
  });

  it('rejects duplicate email with 409', async () => {
    await request(app).post('/api/v1/auth/register').send(user);
    const res = await request(app).post('/api/v1/auth/register').send(user);
    expect(res.statusCode).toBe(409);
  });

  it('rejects weak password with 400 and field errors', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ ...user, password: 'short' });
    expect(res.statusCode).toBe(400);
    expect(res.body.errors[0].field).toBe('password');
  });

  it('logs in with correct credentials', async () => {
    await request(app).post('/api/v1/auth/register').send(user);
    const res = await request(app).post('/api/v1/auth/login').send({ email: user.email, password: user.password });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.token).toBeDefined();
  });

  it('rejects wrong password with 401', async () => {
    await request(app).post('/api/v1/auth/register').send(user);
    const res = await request(app).post('/api/v1/auth/login').send({ email: user.email, password: 'wrongpass1' });
    expect(res.statusCode).toBe(401);
  });

  it('blocks /auth/me without a token and allows it with one', async () => {
    expect((await request(app).get('/api/v1/auth/me')).statusCode).toBe(401);
    const reg = await request(app).post('/api/v1/auth/register').send(user);
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${reg.body.data.token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.email).toBe(user.email);
  });

  it('changes password', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send(user);
    const auth = { Authorization: `Bearer ${reg.body.data.token}` };
    const bad = await request(app).put('/api/v1/auth/change-password').set(auth)
      .send({ currentPassword: 'nope12345', newPassword: 'NewPass456' });
    expect(bad.statusCode).toBe(401);
    const ok = await request(app).put('/api/v1/auth/change-password').set(auth)
      .send({ currentPassword: user.password, newPassword: 'NewPass456' });
    expect(ok.statusCode).toBe(200);
    const login = await request(app).post('/api/v1/auth/login').send({ email: user.email, password: 'NewPass456' });
    expect(login.statusCode).toBe(200);
  });
});
