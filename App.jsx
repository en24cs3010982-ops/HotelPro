import React, { createContext, useContext, useEffect, useState } from 'react';
import { Routes, Route, Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { BedDouble, CalendarDays, CheckCircle2, ChevronRight, CircleUserRound, LogOut, Menu, ShieldCheck, Sparkles, Users, X } from 'lucide-react';
import api from './api';

const AuthContext = createContext(null);
const useAuth = () => useContext(AuthContext);
const money = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
const dateText = d => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

function App() {
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('roomstay_user')); } catch { return null; } });
  const [mobileOpen, setMobileOpen] = useState(false);
  const logout = () => { localStorage.removeItem('roomstay_token'); localStorage.removeItem('roomstay_user'); setUser(null); };
  const login = data => { localStorage.setItem('roomstay_token', data.token); localStorage.setItem('roomstay_user', JSON.stringify(data.user)); setUser(data.user); };
  return <AuthContext.Provider value={{ user, login, logout }}>
    <div className="app-shell">
      <header className="navbar">
        <Link to="/" className="brand"><span className="brand-icon"><BedDouble size={21}/></span><span>room<span className="brand-light">stay</span><small>STAYS THAT FEEL LIKE HOME</small></span></Link>
        <button className="mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">{mobileOpen ? <X/> : <Menu/>}</button>
        <nav className={mobileOpen ? 'nav-links open' : 'nav-links'} onClick={() => setMobileOpen(false)}>
          <NavLink to="/" end>Home</NavLink>
          <a href="/#rooms">Explore rooms</a>
          {user && user.role === 'customer' && <NavLink to="/my-bookings">My bookings</NavLink>}
          {user?.role === 'admin' && <NavLink to="/admin">Admin panel</NavLink>}
          {user ? <button className="nav-login" onClick={logout}><LogOut size={16}/> Logout</button> : <Link className="nav-login" to="/login">Sign in <ChevronRight size={16}/></Link>}
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<Home/>}/>
        <Route path="/login" element={<AuthPage mode="login"/>}/>
        <Route path="/register" element={<AuthPage mode="register"/>}/>
        <Route path="/my-bookings" element={<Protected><MyBookings/></Protected>}/>
        <Route path="/admin" element={<Protected admin><AdminDashboard/></Protected>}/>
        <Route path="*" element={<Home/>}/>
      </Routes>
      <footer className="footer"><div className="brand footer-brand"><span className="brand-icon"><BedDouble size={20}/></span><span>room<span className="brand-light">stay</span></span></div><p>Find your place. Make yourself at home.</p><span>© {new Date().getFullYear()} RoomStay · A room booking demo</span></footer>
    </div>
  </AuthContext.Provider>;
}

function Home() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [arrival, setArrival] = useState('');
  const [departure, setDeparture] = useState('');
  const [selected, setSelected] = useState(null);
  const [phone, setPhone] = useState(user?.phone || '');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const loadRooms = () => api.get('/rooms').then(r => setRooms(r.data)).catch(() => setError('Unable to load rooms. Check that the backend and MongoDB are running.')).finally(() => setLoading(false));
  useEffect(() => { loadRooms(); }, []);
  const validDates = arrival && departure && departure > arrival;
  const reserve = async room => {
    setNotice('');
    if (!user) { navigate('/login'); return; }
    if (!validDates) { setNotice('Choose a valid arrival and departure date first.'); return; }
    setSelected(room); setBusy(true);
    try {
      const result = await api.post('/bookings', { roomId: room._id, arrival, departure, phone });
      setNotice(`${result.data.message} Booking ID: ${result.data.booking.bookingId}`);
      setSelected(null);
    } catch (e) { setNotice(e.response?.data?.message || 'Could not create booking.'); }
    finally { setBusy(false); }
  };
  const nights = validDates ? Math.ceil((new Date(departure) - new Date(arrival)) / 86400000) : 0;

  return <>
    <main>
      <section className="hero">
        <div className="hero-shade"></div>
        <div className="hero-content">
          <div className="eyebrow"><Sparkles size={15}/> A BETTER WAY TO GET AWAY</div>
          <h1>Find a stay that<br/><em>feels like yours.</em></h1>
          <p>Thoughtfully chosen rooms, easy booking, and more time for the moments that matter.</p>
          {user ? <div className="welcome-pill"><CheckCircle2 size={17}/> Welcome back, {user.name}</div> : <div className="hero-actions"><Link className="btn btn-primary" to="/register">Get started <ChevronRight size={17}/></Link><Link className="btn btn-ghost" to="/login">Sign in</Link></div>}
          <div className="hero-proof"><span><CheckCircle2 size={15}/> Easy reservations</span><span><ShieldCheck size={15}/> Secure sign-in</span></div>
        </div>
        <div className="hero-caption">YOUR NEXT CHAPTER STARTS HERE</div>
      </section>

      <section className="search-wrap" id="rooms">
        <div className="search-card">
          <div className="search-heading"><div><span className="eyebrow dark">MAKE YOURSELF AT HOME</span><h2>Find your room</h2></div><span className="date-icon"><CalendarDays/></span></div>
          <div className="search-fields">
            <label>ARRIVAL DATE<input type="date" min={new Date().toISOString().slice(0,10)} value={arrival} onChange={e => setArrival(e.target.value)}/></label>
            <label>DEPARTURE DATE<input type="date" min={arrival || new Date().toISOString().slice(0,10)} value={departure} onChange={e => setDeparture(e.target.value)}/></label>
            <div className="stay-summary"><span>{nights || '—'} <small>{nights === 1 ? 'night' : 'nights'}</small></span><small>Selected stay</small></div>
          </div>
          {notice && <div className={notice.startsWith('Choose') || notice.startsWith('This') || notice.startsWith('Could') ? 'notice error' : 'notice success'}>{notice}</div>}
        </div>
        <div className="section-title"><div><span className="eyebrow dark">STAY A LITTLE DIFFERENT</span><h2>Rooms made for you<span className="title-dot">.</span></h2></div><p>Find the right space for your next trip.</p></div>
        {loading ? <div className="empty-state">Loading rooms…</div> : error ? <div className="notice error">{error}</div> : rooms.length === 0 ? <div className="empty-state">No rooms have been added yet. Please check back soon.</div> :
          <div className="room-grid">{rooms.map((room, i) => <article className="room-card" key={room._id}>
            <div className="room-image-wrap"><img src={room.image || `https://images.unsplash.com/photo-${['1611892440504-42a792e24d32','1566665797739-1674de7a421a','1582719508461-905c673771fd'][i%3]}?auto=format&fit=crop&w=900&q=80`} alt={room.type}/><span className="room-badge">{room.capacity || 2} guests</span></div>
            <div className="room-info"><div className="room-kicker">ROOM TYPE</div><h3>{room.type}</h3><p>{room.description || 'A comfortable, carefully prepared space for a restful stay.'}</p><div className="feature-list">{(room.features?.length ? room.features : ['Comfortable bed','Free Wi-Fi','Private space']).slice(0,3).map(f=><span key={f}>{f}</span>)}</div>
              <div className="room-bottom"><div><strong>{money(room.price)}</strong><small> / night</small></div><button className="btn btn-small" disabled={busy} onClick={() => reserve(room)}>{busy && selected?._id === room._id ? 'Booking…' : 'Book room'} <ChevronRight size={15}/></button></div>
            </div>
          </article>)}</div>}
      </section>
      <section className="about-strip"><div className="about-icon"><BedDouble size={27}/></div><div><span className="eyebrow">THE ROOMSTAY DIFFERENCE</span><h2>Less planning. More living.</h2><p>Browse room details, choose your dates, and manage your reservations in one simple place.</p></div><div className="about-stats"><div><strong>01</strong><span>Choose your room</span></div><div><strong>02</strong><span>Select your dates</span></div><div><strong>03</strong><span>Enjoy your stay</span></div></div></section>
    </main>
  </>;
}

function AuthPage({ mode }) {
  const isLogin = mode === 'login';
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name:'', email:'', password:'', confirm:'', phone:'' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const change = e => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = async e => {
    e.preventDefault(); setError('');
    if (!isLogin && form.password !== form.confirm) return setError('Passwords do not match.');
    if (!isLogin && form.password.length < 8) return setError('Password must be at least 8 characters.');
    setBusy(true);
    try {
      const { data } = await api.post(`/auth/${isLogin ? 'login' : 'register'}`, isLogin ? { email:form.email, password:form.password } : { name:form.name, email:form.email, password:form.password, phone:form.phone });
      login(data); navigate(data.user.role === 'admin' ? '/admin' : '/');
    } catch (e) { setError(e.response?.data?.message || 'Unable to connect. Check the backend server.'); }
    finally { setBusy(false); }
  };
  return <main className="auth-layout"><div className="auth-visual"><div className="auth-visual-copy"><span className="eyebrow">A PLACE TO PAUSE</span><h1>Come for the stay.<br/><em>Keep the feeling.</em></h1><p>Good rooms make good journeys.</p></div></div><div className="auth-form-side"><form className="auth-card" onSubmit={submit}><span className="eyebrow dark">{isLogin ? 'WELCOME BACK' : 'YOUR NEXT STAY STARTS HERE'}</span><h2>{isLogin ? 'Sign in' : 'Create an account'}</h2><p className="muted">{isLogin ? 'Enter your details to continue.' : 'Join RoomStay to manage your reservations.'}</p>
    {!isLogin && <label>Full name<input name="name" value={form.name} onChange={change} required placeholder="Your full name"/></label>}
    <label>Email address<input type="email" name="email" value={form.email} onChange={change} required placeholder="you@example.com"/></label>
    {!isLogin && <label>Phone number <span className="optional">(optional)</span><input name="phone" value={form.phone} onChange={change} placeholder="Your contact number"/></label>}
    <label>Password<input type="password" name="password" value={form.password} onChange={change} required minLength={8} placeholder="At least 8 characters"/></label>
    {!isLogin && <label>Confirm password<input type="password" name="confirm" value={form.confirm} onChange={change} required placeholder="Enter password again"/></label>}
    {error && <div className="notice error">{error}</div>}<button className="btn btn-primary full" disabled={busy}>{busy ? 'Please wait…' : isLogin ? 'Sign in securely' : 'Create account'} <ChevronRight size={17}/></button>
    <p className="switch-auth">{isLogin ? "New to RoomStay?" : 'Already have an account?'} <Link to={isLogin ? '/register' : '/login'}>{isLogin ? 'Create an account' : 'Sign in'}</Link></p>
    </form></div></main>;
}

function Protected({ children, admin=false }) {
  const { user } = useAuth(); const location = useLocation();
  if (!user) return <AuthRedirect to="/login" state={{ from: location.pathname }}/>;
  if (admin && user.role !== 'admin') return <AuthRedirect to="/"/>;
  return children;
}
function AuthRedirect({to, state}) { const navigate = useNavigate(); useEffect(()=>navigate(to,{replace:true,state}),[navigate,to,state]); return <div className="empty-state">Redirecting…</div>; }

function MyBookings() {
  const [bookings,setBookings] = useState([]); const [error,setError] = useState(''); const [loading,setLoading] = useState(true);
  const load = () => api.get('/bookings/my').then(r=>setBookings(r.data)).catch(e=>setError(e.response?.data?.message || 'Unable to load bookings.')).finally(()=>setLoading(false));
  useEffect(()=>{load()},[]);
  const cancel = async id => { if(!confirm('Cancel this booking?')) return; try { await api.patch(`/bookings/${id}/cancel`); load(); } catch(e) { alert(e.response?.data?.message || 'Could not cancel booking.'); } };
  return <main className="dashboard-page"><div className="page-heading"><div><span className="eyebrow dark">YOUR ROOMSTAY ACCOUNT</span><h1>My bookings<span className="title-dot">.</span></h1><p>Keep track of your upcoming stays and booking history.</p></div><Link to="/#rooms" className="btn btn-primary">Explore rooms <ChevronRight size={16}/></Link></div>
    {loading ? <div className="empty-state">Loading bookings…</div> : error ? <div className="notice error">{error}</div> : bookings.length===0 ? <div className="empty-panel"><CalendarDays size={35}/><h3>No bookings yet</h3><p>Your next trip could start with a great room.</p><Link to="/#rooms" className="btn btn-primary">Browse rooms</Link></div> :
      <div className="table-wrap"><table><thead><tr><th>Booking</th><th>Room</th><th>Dates</th><th>Total</th><th>Status</th><th>Action</th></tr></thead><tbody>{bookings.map(b=><tr key={b._id}><td><strong>{b.bookingId}</strong><small>{b.nights} night(s)</small></td><td>{b.roomType}<small>{b.phone || 'No phone provided'}</small></td><td>{dateText(b.arrival)}<small>to {dateText(b.departure)}</small></td><td><strong>{money(b.totalAmount)}</strong></td><td><span className={`status ${b.status}`}>{b.status}</span></td><td>{b.status!=='cancelled' && <button className="text-button danger-text" onClick={()=>cancel(b._id)}>Cancel</button>}</td></tr>)}</tbody></table></div>}
  </main>;
}

function AdminDashboard() {
  const [tab,setTab] = useState('bookings'); const [bookings,setBookings] = useState([]); const [rooms,setRooms] = useState([]); const [users,setUsers] = useState([]);
  const [message,setMessage] = useState(''); const [error,setError] = useState(''); const [editing,setEditing] = useState(null);
  const empty = { type:'', description:'', price:'', capacity:2, image:'', features:'Free Wi-Fi, Air conditioning' };
  const [form,setForm] = useState(empty);
  const load = async () => { try { const [b,r,u] = await Promise.all([api.get('/admin/bookings'),api.get('/admin/rooms'),api.get('/admin/users')]); setBookings(b.data);setRooms(r.data);setUsers(u.data);setError(''); } catch(e) { setError(e.response?.data?.message || 'Could not load admin data.'); } };
  useEffect(()=>{load()},[]);
  const saveRoom = async e => { e.preventDefault(); setError('');setMessage(''); const payload={...form,price:Number(form.price),capacity:Number(form.capacity),features:form.features.split(',').map(s=>s.trim()).filter(Boolean)};
    try { if(editing) await api.patch(`/admin/rooms/${editing}`,payload); else await api.post('/admin/rooms',payload); setMessage(editing?'Room updated.':'Room added.');setEditing(null);setForm(empty);await load(); } catch(e) {setError(e.response?.data?.message || 'Could not save room.');}
  };
  const editRoom = room => { setEditing(room._id);setForm({...room,features:(room.features||[]).join(', ')});setTab('add'); };
  const deleteRoom = async id => { if(!confirm('Hide this room from customers?'))return; try {await api.delete(`/admin/rooms/${id}`);setMessage('Room hidden from customers.');load();}catch(e){setError(e.response?.data?.message||'Could not remove room.');} };
  return <main className="dashboard-page admin-page"><div className="page-heading"><div><span className="eyebrow dark">CONTROL CENTRE</span><h1>Admin dashboard<span className="title-dot">.</span></h1><p>Manage rooms, reservations, and your customer community.</p></div><div className="admin-badge"><ShieldCheck size={18}/> Administrator</div></div>
    <div className="stats-grid"><div className="stat-card"><span>Total bookings</span><strong>{bookings.length}</strong><CalendarDays/></div><div className="stat-card"><span>Rooms in system</span><strong>{rooms.length}</strong><BedDouble/></div><div className="stat-card"><span>Registered users</span><strong>{users.length}</strong><Users/></div></div>
    {error&&<div className="notice error">{error}</div>}{message&&<div className="notice success">{message}</div>}
    <div className="admin-tabs">{[['bookings','All bookings'],['rooms','All rooms'],['add',editing?'Edit room':'Add room'],['users','All users']].map(([id,label])=><button key={id} className={tab===id?'active':''} onClick={()=>{setTab(id);setMessage('');setError('')}}>{label}</button>)}</div>
    {tab==='bookings'&&<div className="table-wrap"><table><thead><tr><th>Booking ID</th><th>Customer</th><th>Room</th><th>Dates</th><th>Amount</th><th>Status</th></tr></thead><tbody>{bookings.map(b=><tr key={b._id}><td><strong>{b.bookingId}</strong></td><td>{b.user?.name||'Deleted user'}<small>{b.user?.email||''}</small></td><td>{b.roomType}</td><td>{dateText(b.arrival)}<small>to {dateText(b.departure)}</small></td><td>{money(b.totalAmount)}</td><td><span className={`status ${b.status}`}>{b.status}</span></td></tr>)}{!bookings.length&&<tr><td colSpan="6">No bookings yet.</td></tr>}</tbody></table></div>}
    {tab==='rooms'&&<div className="admin-room-list">{rooms.map(r=><div className="admin-room" key={r._id}><div className="admin-room-icon"><BedDouble/></div><div className="admin-room-main"><strong>{r.type}</strong><span>{money(r.price)} / night · {r.capacity} guests · {r.active?'Visible':'Hidden'}</span><small>{r.description}</small></div><button className="text-button" onClick={()=>editRoom(r)}>Edit</button>{r.active&&<button className="text-button danger-text" onClick={()=>deleteRoom(r._id)}>Hide</button>}</div>)}{!rooms.length&&<div className="empty-state">No rooms added yet.</div>}</div>}
    {tab==='add'&&<form className="room-form" onSubmit={saveRoom}><h3>{editing?'Edit room details':'Add a new room'}</h3><div className="form-grid"><label>Room type<input required value={form.type} onChange={e=>setForm({...form,type:e.target.value})} placeholder="e.g. Deluxe Double"/></label><label>Price per night (₹)<input required type="number" min="1" value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/></label><label>Guest capacity<input type="number" min="1" value={form.capacity} onChange={e=>setForm({...form,capacity:e.target.value})}/></label><label>Image URL<input value={form.image} onChange={e=>setForm({...form,image:e.target.value})} placeholder="https://…"/></label><label className="wide">Description<textarea rows="3" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Describe the room…"/></label><label className="wide">Features (comma separated)<input value={form.features} onChange={e=>setForm({...form,features:e.target.value})} placeholder="Free Wi-Fi, Breakfast, Balcony"/></label></div><div className="form-actions"><button type="button" className="btn btn-outline" onClick={()=>{setForm(empty);setEditing(null)}}>Clear</button><button className="btn btn-primary">{editing?'Save changes':'Add room'} <ChevronRight size={16}/></button></div></form>}
    {tab==='users'&&<div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Joined</th></tr></thead><tbody>{users.map(u=><tr key={u._id}><td><strong>{u.name}</strong></td><td>{u.email}</td><td>{u.phone||'—'}</td><td><span className="status active">{u.role}</span></td><td>{dateText(u.createdAt)}</td></tr>)}{!users.length&&<tr><td colSpan="5">No users found.</td></tr>}</tbody></table></div>}
  </main>;
}

export default App;
