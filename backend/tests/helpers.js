const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');

exports.app = app;
exports.connect = () => mongoose.connect(process.env.MONGO_URI_TEST);
exports.disconnect = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
};
exports.clear = async () => {
  const cols = Object.values(mongoose.connection.collections);
  await Promise.all(cols.map((c) => c.deleteMany({})));
};

exports.registerUser = async (name, email) => {
  const res = await request(app).post('/api/v1/auth/register').send({ name, email, password: 'Password123' });
  return { token: res.body.data.token, id: res.body.data.user.id };
};

// create an admin / maintenance user directly in the DB (the API never lets users pick a role)
exports.createRoleUser = async (role, email) => {
  await User.create({ name: `${role} user`, email, password: 'Password123', role });
  const res = await request(app).post('/api/v1/auth/login').send({ email, password: 'Password123' });
  return { token: res.body.data.token, id: res.body.data.user.id };
};

exports.issueBody = {
  title: 'Broken fan in room 101',
  description: 'The ceiling fan in room 101 makes a loud noise and does not spin.',
  category: 'electricity',
  building: 'Main Block',
  department: 'Computer Science',
};
