import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

dotenv.config();
const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '2mb' }));

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  phone: { type: String, default: '' },
  role: { type: String, enum: ['customer', 'admin'], default: 'customer' }
}, { timestamps: true });

const roomSchema = new mongoose.Schema({
  type: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true, min: 1 },
  capacity: { type: Number, default: 2, min: 1 },
  image: { type: String, default: '' },
  features: [{ type: String }],
  active: { type: Boolean, default: true }
}, { timestamps: true });

const bookingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  roomType: { type: String, required: true },
  bookingId: { type: String, required: true, unique: true },
  arrival: { type: Date, required: true },
  departure: { type: Date, required: true },
  nights: { type: Number, required: true },
  totalAmount: { type: Number, required: true },
  phone: { type: String, default: '' },
  status: { type: String, enum: ['active', 'cancelled'], default: 'active' }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Room = mongoose.model('Room', roomSchema);
const Booking = mongoose.model('Booking', bookingSchema);

const safeUser = user => ({ id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role });
const makeToken = user => jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

async function auth(req, res, next) {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ message: 'Please log in to continue.' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(payload.id);
    if (!req.user) return res.status(401).json({ message: 'Account not found.' });
    next();
  } catch { return res.status(401).json({ message: 'Session expired. Please log in again.' }); }
}
const adminOnly = (req, res, next) => req.user?.role === 'admin'
  ? next() : res.status(403).json({ message: 'Administrator access required.' });

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'Name, email and password are required.' });
    if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    const normalizedEmail = email.toLowerCase().trim();
    if (await User.findOne({ email: normalizedEmail })) return res.status(409).json({ message: 'An account with this email already exists.' });
    const user = await User.create({ name, email: normalizedEmail, password: await bcrypt.hash(password, 12), phone, role: 'customer' });
    res.status(201).json({ token: makeToken(user), user: safeUser(user) });
  } catch (e) { res.status(500).json({ message: 'Could not create account.', detail: e.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: (email || '').toLowerCase().trim() }).select('+password');
    if (!user || !(await bcrypt.compare(password || '', user.password))) return res.status(401).json({ message: 'Invalid email or password.' });
    res.json({ token: makeToken(user), user: safeUser(user) });
  } catch (e) { res.status(500).json({ message: 'Login failed.', detail: e.message }); }
});

app.get('/api/auth/me', auth, (req, res) => res.json({ user: safeUser(req.user) }));

app.get('/api/rooms', async (_req, res) => {
  try { res.json(await Room.find({ active: true }).sort({ createdAt: -1 })); }
  catch (e) { res.status(500).json({ message: 'Could not load rooms.', detail: e.message }); }
});

app.post('/api/bookings', auth, async (req, res) => {
  try {
    const { roomId, arrival, departure, phone } = req.body;
    const start = new Date(arrival), end = new Date(departure);
    if (!roomId || !arrival || !departure || Number.isNaN(+start) || Number.isNaN(+end) || end <= start)
      return res.status(400).json({ message: 'Choose valid arrival and departure dates.' });
    if (start < new Date(new Date().setHours(0,0,0,0))) return res.status(400).json({ message: 'Arrival date cannot be in the past.' });
    const room = await Room.findOne({ _id: roomId, active: true });
    if (!room) return res.status(404).json({ message: 'Room is not available.' });
    const overlap = await Booking.findOne({
      room: roomId, status: 'active',
      arrival: { $lt: end }, departure: { $gt: start }
    });
    if (overlap) return res.status(409).json({ message: 'This room is already booked for some of those dates.' });
    const nights = Math.ceil((end - start) / 86400000);
    const booking = await Booking.create({
      user: req.user._id, room: room._id, roomType: room.type,
      bookingId: `RB-${Date.now().toString(36).toUpperCase()}`,
      arrival: start, departure: end, nights, totalAmount: nights * room.price,
      phone: phone || req.user.phone || '', status: 'active'
    });
    res.status(201).json({ message: 'Booking created. Demo checkout completed; no real payment was taken.', booking });
  } catch (e) { res.status(500).json({ message: 'Could not create booking.', detail: e.message }); }
});

app.get('/api/bookings/my', auth, async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(bookings);
  } catch (e) { res.status(500).json({ message: 'Could not load bookings.', detail: e.message }); }
});

app.patch('/api/bookings/:id/cancel', auth, async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, user: req.user._id });
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });
    if (booking.status === 'cancelled') return res.status(400).json({ message: 'Booking is already cancelled.' });
    booking.status = 'cancelled';
    await booking.save();
    res.json({ message: 'Booking cancelled.', booking });
  } catch (e) { res.status(500).json({ message: 'Could not cancel booking.', detail: e.message }); }
});

app.get('/api/admin/bookings', auth, adminOnly, async (_req, res) => {
  try {
    const bookings = await Booking.find().populate('user', 'name email phone').sort({ createdAt: -1 });
    res.json(bookings);
  } catch (e) { res.status(500).json({ message: 'Could not load bookings.', detail: e.message }); }
});
app.get('/api/admin/users', auth, adminOnly, async (_req, res) => {
  try { res.json(await User.find().select('-password').sort({ createdAt: -1 })); }
  catch (e) { res.status(500).json({ message: 'Could not load users.', detail: e.message }); }
});
app.get('/api/admin/rooms', auth, adminOnly, async (_req, res) => {
  try { res.json(await Room.find().sort({ createdAt: -1 })); }
  catch (e) { res.status(500).json({ message: 'Could not load rooms.', detail: e.message }); }
});
app.post('/api/admin/rooms', auth, adminOnly, async (req, res) => {
  try {
    const { type, description, price, capacity, image, features } = req.body;
    if (!type || !Number.isFinite(Number(price)) || Number(price) <= 0) return res.status(400).json({ message: 'Room type and a valid price are required.' });
    const room = await Room.create({ type, description, price: Number(price), capacity: Number(capacity) || 2, image, features: Array.isArray(features) ? features : String(features || '').split(',').map(x => x.trim()).filter(Boolean) });
    res.status(201).json(room);
  } catch (e) { res.status(500).json({ message: 'Could not add room.', detail: e.message }); }
});
app.patch('/api/admin/rooms/:id', auth, adminOnly, async (req, res) => {
  try {
    const updates = { ...req.body };
    delete updates._id; delete updates.createdAt; delete updates.updatedAt;
    if (updates.price !== undefined) updates.price = Number(updates.price);
    const room = await Room.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!room) return res.status(404).json({ message: 'Room not found.' });
    res.json(room);
  } catch (e) { res.status(400).json({ message: 'Could not update room.', detail: e.message }); }
});
app.delete('/api/admin/rooms/:id', auth, adminOnly, async (req, res) => {
  try {
    const room = await Room.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
    if (!room) return res.status(404).json({ message: 'Room not found.' });
    res.json({ message: 'Room hidden from customers.' });
  } catch (e) { res.status(500).json({ message: 'Could not remove room.', detail: e.message }); }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: 'Unexpected server error.' });
});

const port = process.env.PORT || 5000;
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/room_booking')
  .then(() => app.listen(port, () => console.log(`Room booking API running on http://localhost:${port}`)))
  .catch(err => { console.error('MongoDB connection failed:', err.message); process.exit(1); });
