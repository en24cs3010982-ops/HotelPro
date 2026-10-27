import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

const schema = new mongoose.Schema({
  name: String, email: { type: String, unique: true }, password: String,
  phone: String, role: { type: String, default: 'admin' }
}, { timestamps: true });
const User = mongoose.model('User', schema);

await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/room_booking');
const email = 'admin@roomstay.local';
const existing = await User.findOne({ email });
if (existing) {
  console.log('Admin already exists:', email);
} else {
  await User.create({ name: 'RoomStay Admin', email, password: await bcrypt.hash('Admin123!', 12), role: 'admin', phone: '' });
  console.log('Admin created:', email, 'Password: Admin123! (change it immediately)');
}
await mongoose.disconnect();
