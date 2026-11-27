require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/config/db');

const PORT = process.env.PORT || 5000;

if (!process.env.JWT_SECRET || !process.env.MONGO_URI) {
  console.error('Missing JWT_SECRET or MONGO_URI. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

connectDB().then(() => {
  app.listen(PORT, () => console.log(`FixItHub running on http://localhost:${PORT}`));
});
