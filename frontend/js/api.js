/* ═══════════════════════════════
   NUTRILIFE — API CLIENT
   Change API_URL when deployed
═══════════════════════════════ */

const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:4000/api'
  : 'https://nutrilife-monorepo.onrender.com/api';  // ← change after Render deploy

/* ── Fetch wrapper */
async function api(endpoint, options = {}) {
  const token = localStorage.getItem('nl_token');
  try {
    const res = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    return data;
  } catch (err) {
    if (err.message === 'Failed to fetch') throw new Error('Cannot connect to server. Is the backend running?');
    throw err;
  }
}

/* ── AUTH */
const Auth = {
  async register(d) {
    const data = await api('/auth/register', { method: 'POST', body: d });
    localStorage.setItem('nl_token', data.token);
    localStorage.setItem('nl_user', JSON.stringify(data.user));
    return data;
  },
  async login(email, password) {
    const data = await api('/auth/login', { method: 'POST', body: { email, password } });
    localStorage.setItem('nl_token', data.token);
    localStorage.setItem('nl_user', JSON.stringify(data.user));
    return data;
  },
  logout() {
    localStorage.removeItem('nl_token');
    localStorage.removeItem('nl_user');
    localStorage.removeItem('nl_cart');
    window.location.href = '/pages/login.html';
  },
  getUser()    { return JSON.parse(localStorage.getItem('nl_user') || 'null'); },
  isLoggedIn() { return !!localStorage.getItem('nl_token'); },
  isAdmin()    { return this.getUser()?.role === 'ADMIN'; }
};

/* ── MEALS */
const Meals = {
  getAll(cat)   { return api(`/meals${cat && cat !== 'all' ? '?category=' + cat : ''}`); },
  getAllAdmin()  { return api('/meals/admin/all'); },
  getOne(id)    { return api(`/meals/${id}`); },
  create(d)     { return api('/meals',      { method: 'POST',   body: d }); },
  update(id, d) { return api(`/meals/${id}`, { method: 'PUT',   body: d }); },
  delete(id)    { return api(`/meals/${id}`, { method: 'DELETE' }); }
};

/* ── ORDERS */
const Orders = {
  create(d)            { return api('/orders', { method: 'POST', body: d }); },
  getMine()            { return api('/orders/my-orders'); },
  getOne(id)           { return api(`/orders/${id}`); },
  getAll(status, page) {
    const q = new URLSearchParams();
    if (status) q.set('status', status);
    if (page)   q.set('page', page);
    return api(`/orders?${q}`);
  },
  updateStatus(id, status) { return api(`/orders/${id}/status`, { method: 'PATCH', body: { status } }); }
};

/* ── PAYMENTS */
const Payments = {
  initiate(orderId)      { return api('/payments/initiate', { method: 'POST', body: { orderId } }); },
  checkStatus(trackId)   { return api(`/payments/status/${trackId}`); },
  getHistory()           { return api('/payments/history'); },
  getAll()               { return api('/payments'); }
};

/* ── TRACKER */
const Tracker = {
  getLogs(date) { return api(`/users/meal-log?date=${date || 'today'}`); },
  logMeal(d)    { return api('/users/meal-log', { method: 'POST', body: d }); },
  deleteLog(id) { return api(`/users/meal-log/${id}`, { method: 'DELETE' }); }
};

/* ── USERS */
const Users = {
  getMe()          { return api('/auth/me'); },
  getAll(plan, pg) {
    const q = new URLSearchParams();
    if (plan) q.set('plan', plan);
    if (pg)   q.set('page', pg);
    return api(`/users?${q}`);
  },
  updateProfile(d) { return api('/users/profile', { method: 'PUT',   body: d }); },
  suspend(id)      { return api(`/users/${id}/suspend`,  { method: 'PATCH' }); },
  activate(id)     { return api(`/users/${id}/activate`, { method: 'PATCH' }); }
};

/* ── CART (localStorage) */
const Cart = {
  get()        { return JSON.parse(localStorage.getItem('nl_cart') || '[]'); },
  save(cart)   { localStorage.setItem('nl_cart', JSON.stringify(cart)); },
  count()      { return this.get().reduce((s, c) => s + c.qty, 0); },
  total()      { return this.get().reduce((s, c) => s + c.price * c.qty, 0); },
  clear()      { localStorage.removeItem('nl_cart'); this.updateBadge(); },
  add(meal) {
    const cart = this.get();
    const ex   = cart.find(c => c.id === meal.id);
    if (ex) ex.qty++;
    else cart.push({ ...meal, qty: 1 });
    this.save(cart);
    showToast(`${meal.emoji} ${meal.name} added!`, 'success');
    this.updateBadge();
  },
  remove(id)     { this.save(this.get().filter(c => c.id !== id)); this.updateBadge(); },
  changeQty(id, d) {
    const cart = this.get();
    const item = cart.find(c => c.id === id);
    if (item) { item.qty = Math.max(1, item.qty + d); this.save(cart); }
    this.updateBadge();
  },
  updateBadge() {
    document.querySelectorAll('.cart-badge').forEach(b => b.textContent = this.count());
  }
};

/* ── TOAST */
function showToast(msg, type = 'success') {
  let c = document.getElementById('toast-container');
  if (!c) { c = document.createElement('div'); c.id = 'toast-container'; document.body.appendChild(c); }
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type]||'✅'}</span><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity='0'; t.style.transform='translateX(30px)'; t.style.transition='all .3s'; setTimeout(()=>t.remove(),300); }, 3500);
}

/* ── HELPERS */
const CAT_BG = { breakfast:'#FEF3C7', lunch:'#D1FAE5', dinner:'#DBEAFE', snack:'#FEE2E2', vegan:'#E0E7FF' };

function fmtUGX(n)  { return 'UGX ' + Number(n).toLocaleString(); }
function fmtDate(d) { return new Date(d).toLocaleDateString('en-UG', { day:'numeric', month:'short', year:'numeric' }); }

function statusBadge(s) {
  const m = {
    PENDING:'<span class="badge badge-gold">⏳ Pending</span>',
    PREPARING:'<span class="badge badge-gold">🔄 Preparing</span>',
    ON_THE_WAY:'<span class="badge badge-blue">🚴 On the Way</span>',
    DELIVERED:'<span class="badge badge-green">✅ Delivered</span>',
    CANCELLED:'<span class="badge badge-red">❌ Cancelled</span>',
    SUCCESS:'<span class="badge badge-green">✓ Success</span>',
    FAILED:'<span class="badge badge-red">✗ Failed</span>',
  };
  return m[s] || `<span class="badge badge-grey">${s}</span>`;
}

function planBadge(p) {
  const m = { Starter:'badge-green', Pro:'badge-gold', Elite:'badge-purple' };
  return `<span class="badge ${m[p]||'badge-grey'}">${p}</span>`;
}

// Close modal on overlay click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('open');
});
