// Run with: npm run seed   (creates demo users and sample issues; wipes existing data!)
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./src/config/db');
const User = require('./src/models/User');
const Issue = require('./src/models/Issue');
const Comment = require('./src/models/Comment');

const sample = [
  ['Wi-Fi keeps dropping in reading hall', 'The Wi-Fi disconnects every few minutes on the second floor of the library. Students cannot attend online sessions.', 'wifi', 'Library', 'Administration', 'Second floor reading hall', 'high', 'open'],
  ['Three computers not booting in Lab 2', 'PC numbers 4, 7 and 12 show a black screen after power on. Lab sessions are affected.', 'computer', 'Computer Lab Block', 'Computer Science', 'Lab 2', 'high', 'in-progress'],
  ['Broken benches outside Science Block', 'Two benches have broken legs and are unsafe to sit on.', 'furniture', 'Science Block', 'Administration', 'Entrance courtyard', 'low', 'open'],
  ['No hot water in Hostel A bathrooms', 'Geysers on the first and second floor have not worked for four days.', 'hostel', 'Hostel A', 'Hostel Office', 'Floors 1 and 2', 'critical', 'in-progress'],
  ['Corridor lights flickering', 'Tube lights in the Main Block corridor flicker constantly and two are completely off.', 'electricity', 'Main Block', 'Administration', 'Ground floor corridor', 'medium', 'resolved'],
  ['Water leakage in cafeteria sink', 'The sink pipe leaks and the floor stays wet, which is a slipping hazard.', 'plumbing', 'Cafeteria', 'Administration', 'Kitchen side', 'medium', 'resolved'],
  ['Projector not working in Room 204', 'The projector shows no signal even with different cables.', 'electricity', 'Main Block', 'Electronics', 'Room 204', 'medium', 'open'],
  ['Dustbins overflowing near sports complex', 'Bins are not emptied for days and the smell is bad.', 'cleanliness', 'Sports Complex', 'Administration', 'Main gate side', 'low', 'open'],
];

(async () => {
  await connectDB();
  await Promise.all([User.deleteMany({}), Issue.deleteMany({}), Comment.deleteMany({})]);

  const mk = (name, email, role, department = '') => User.create({ name, email, password: 'Demo@1234', role, department });
  const [admin, staff1, staff2, s1, s2] = await Promise.all([
    mk('Admin User', 'admin@demo.com', 'admin', 'Administration'),
    mk('Ramesh (Electrician)', 'ramesh@demo.com', 'maintenance'),
    mk('Sunita (IT Support)', 'sunita@demo.com', 'maintenance'),
    mk('Aarav Sharma', 'student@demo.com', 'student', 'Computer Science'),
    mk('Diya Verma', 'diya@demo.com', 'student', 'Electronics'),
  ]);
  const staffFor = { electricity: staff1, plumbing: staff1, wifi: staff2, computer: staff2 };

  for (let i = 0; i < sample.length; i++) {
    const [title, description, category, building, department, location, priority, status] = sample[i];
    const reporter = i % 2 === 0 ? s1 : s2;
    const createdAt = new Date(Date.now() - (i * 9 + 2) * 24 * 3600 * 1000);
    const issue = await Issue.create({
      title, description, category, building, department, location, priority, status,
      reportedBy: reporter._id,
      assignedTo: status === 'open' ? null : (staffFor[category] || staff1)._id,
      upvotes: [i % 2 === 0 ? s2._id : s1._id],
      upvoteCount: 1,
      resolvedAt: status === 'resolved' ? new Date(createdAt.getTime() + 3 * 24 * 3600 * 1000) : undefined,
      statusHistory: [{ status: 'open', changedBy: reporter._id, changedAt: createdAt }],
      createdAt, updatedAt: createdAt,
    });
    await Comment.create({ text: 'I face this problem too, please look into it soon.', issue: issue._id, author: i % 2 === 0 ? s2._id : s1._id });
    await Issue.updateOne({ _id: issue._id }, { commentCount: 1 });
  }

  console.log('Seed complete. Demo logins (password for all: Demo@1234):');
  console.log('  admin@demo.com    (admin)');
  console.log('  student@demo.com  (student)');
  console.log('  diya@demo.com     (student)');
  console.log('  ramesh@demo.com   (maintenance)');
  await mongoose.disconnect();
})();
