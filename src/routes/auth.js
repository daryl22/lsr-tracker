import { Router } from 'express';
import bcrypt from 'bcrypt';
import { getDb } from '../db.js';

const router = Router();
const db = getDb();

router.post('/api/register', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' });

  const passwordHash = bcrypt.hashSync(password, 10);
  const stmt = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)');
  stmt.run(email, passwordHash, function(err) {
    if (err) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    req.session.userId = this.lastID;
    return res.json({ ok: true, userId: this.lastID });
  });
});

router.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' });

  db.get('SELECT id, password_hash, is_admin FROM users WHERE email = ?', [email], (err, row) => {
    if (err || !row) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = bcrypt.compareSync(password, row.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    req.session.userId = row.id;
    req.session.isAdmin = !!row.is_admin;
    return res.json({ ok: true });
  });
});

router.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

router.get('/api/me', (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  db.get('SELECT id, email, is_admin FROM users WHERE id = ?', [req.session.userId], (err, row) => {
    if (err || !row) return res.json({ user: null });
    res.json({ user: { id: row.id, email: row.email, is_admin: !!row.is_admin } });
  });
});

export default router;


