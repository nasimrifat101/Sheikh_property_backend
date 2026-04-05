import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import Admin from '../models/Admin.js';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Go up 3 levels: scripts → src → Backend → .env
dotenv.config({ path: resolve(__dirname, '../../.env') });

const ADMIN_USERNAME = process.env.SEED_ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin@1234';

async function seedAdmin() {
  if (!process.env.MONGO_URI) {
    console.error('❌ MONGO_URI not found. Check your .env file path.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const exists = await Admin.findOne({ username: ADMIN_USERNAME });
  if (exists) {
    console.log(`⚠️  Admin "${ADMIN_USERNAME}" already exists. Skipping.`);
    process.exit(0);
  }

  await Admin.create({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD });
  console.log(`✅ Admin seeded → username: ${ADMIN_USERNAME} | password: ${ADMIN_PASSWORD}`);
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});