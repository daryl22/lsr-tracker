import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getDb } from '../db.js';

const router = Router();
const db = getDb();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, unique + ext);
  }
});
const upload = multer({ storage });

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.userId || !req.session.isAdmin) return res.status(403).json({ error: 'Forbidden' });
  next();
}

router.get('/api/entries', requireAuth, (req, res) => {
  db.all(
    `SELECT e.id, e.entry_date as date, e.km_run as km, e.hours, e.pace, 
            u.id as upload_id, u.filename, u.originalname, u.mimetype
     FROM entries e 
     LEFT JOIN uploads u ON u.entry_id = e.id 
     WHERE e.user_id = ? 
     ORDER BY e.entry_date DESC LIMIT 30`,
    [req.session.userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch' });
      res.json({ entries: rows || [] });
    }
  );
});

const entryUpload = upload.single('file');
router.post('/api/entries', requireAuth, entryUpload, (req, res) => {
  const { date, km, hours, pace } = req.body;
  if (!date) return res.status(400).json({ error: 'Missing date' });
  if (!req.file) return res.status(400).json({ error: 'Screenshot file is required' });
  const kmNum = Number(km) || 0;
  const hoursNum = Number(hours) || 0;
  const paceNum = pace === null || pace === undefined || pace === '' ? null : Number(pace);

  const stmt = db.prepare(
    'INSERT INTO entries (user_id, entry_date, km_run, hours, pace) VALUES (?, ?, ?, ?, ?)'
  );
  stmt.run(req.session.userId, date, kmNum, hoursNum, paceNum, function(err) {
    if (err) return res.status(500).json({ error: 'Failed to save entry' });
    const entryId = this.lastID;
    const { filename, originalname, mimetype, size } = req.file;
    const upStmt = db.prepare('INSERT INTO uploads (user_id, entry_id, filename, originalname, mimetype, size) VALUES (?, ?, ?, ?, ?, ?)');
    upStmt.run(req.session.userId, entryId, filename, originalname, mimetype, size, function(upErr) {
      if (upErr) return res.status(500).json({ error: 'Failed to save screenshot' });
      return res.json({ ok: true, entryId });
    });
  });
});

router.post('/api/uploads', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const { filename, originalname, mimetype, size } = req.file;
  const stmt = db.prepare(
    'INSERT INTO uploads (user_id, filename, originalname, mimetype, size) VALUES (?, ?, ?, ?, ?)'
  );
  stmt.run(req.session.userId, filename, originalname, mimetype, size, function(err) {
    if (err) return res.status(500).json({ error: 'Failed to record upload' });
    res.json({ ok: true, file: { id: this.lastID, filename, originalname, size } });
  });
});

// User entry edit and delete endpoints
router.put('/api/entries/:id', requireAuth, (req, res) => {
  const entryId = Number(req.params.id);
  const { date, km, hours, pace } = req.body;
  
  if (!Number.isInteger(entryId) || entryId <= 0) {
    return res.status(400).json({ error: 'Invalid entry ID' });
  }
  
  // Verify the entry belongs to the current user
  db.get('SELECT id FROM entries WHERE id = ? AND user_id = ?', [entryId, req.session.userId], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!row) return res.status(404).json({ error: 'Entry not found or not authorized' });
    
    const kmNum = Number(km) || 0;
    const hoursNum = Number(hours) || 0;
    const paceNum = pace === null || pace === undefined || pace === '' ? null : Number(pace);
    
    db.run(
      'UPDATE entries SET entry_date = ?, km_run = ?, hours = ?, pace = ? WHERE id = ? AND user_id = ?',
      [date, kmNum, hoursNum, paceNum, entryId, req.session.userId],
      function(updateErr) {
        if (updateErr) return res.status(500).json({ error: 'Failed to update entry' });
        if (this.changes === 0) return res.status(404).json({ error: 'Entry not found' });
        res.json({ ok: true });
      }
    );
  });
});

router.delete('/api/entries/:id', requireAuth, (req, res) => {
  const entryId = Number(req.params.id);
  
  if (!Number.isInteger(entryId) || entryId <= 0) {
    return res.status(400).json({ error: 'Invalid entry ID' });
  }
  
  // Verify the entry belongs to the current user and delete it
  db.run('DELETE FROM entries WHERE id = ? AND user_id = ?', [entryId, req.session.userId], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to delete entry' });
    if (this.changes === 0) return res.status(404).json({ error: 'Entry not found' });
    res.json({ ok: true });
  });
});

// Admin entry edit and delete endpoints (can edit/delete any user's entries)
router.put('/api/admin/entries/:id', requireAdmin, (req, res) => {
  const entryId = Number(req.params.id);
  const { date, km, hours, pace } = req.body;
  
  if (!Number.isInteger(entryId) || entryId <= 0) {
    return res.status(400).json({ error: 'Invalid entry ID' });
  }
  
  // Verify the entry exists
  db.get('SELECT id FROM entries WHERE id = ?', [entryId], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!row) return res.status(404).json({ error: 'Entry not found' });
    
    const kmNum = Number(km) || 0;
    const hoursNum = Number(hours) || 0;
    const paceNum = pace === null || pace === undefined || pace === '' ? null : Number(pace);
    
    db.run(
      'UPDATE entries SET entry_date = ?, km_run = ?, hours = ?, pace = ? WHERE id = ?',
      [date, kmNum, hoursNum, paceNum, entryId],
      function(updateErr) {
        if (updateErr) return res.status(500).json({ error: 'Failed to update entry' });
        if (this.changes === 0) return res.status(404).json({ error: 'Entry not found' });
        res.json({ ok: true });
      }
    );
  });
});

router.delete('/api/admin/entries/:id', requireAdmin, (req, res) => {
  const entryId = Number(req.params.id);
  
  if (!Number.isInteger(entryId) || entryId <= 0) {
    return res.status(400).json({ error: 'Invalid entry ID' });
  }
  
  // Admin can delete any entry
  db.run('DELETE FROM entries WHERE id = ?', [entryId], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to delete entry' });
    if (this.changes === 0) return res.status(404).json({ error: 'Entry not found' });
    res.json({ ok: true });
  });
});

// Admin APIs
router.get('/api/admin/users', requireAdmin, (req, res) => {
  db.all("SELECT id, email, created_at FROM users WHERE email <> 'admin' ORDER BY id ASC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch users' });
    res.json({ users: rows });
  });
});

router.get('/api/admin/entries', requireAdmin, (req, res) => {
  const sql = `SELECT e.id, e.user_id, u.email, e.entry_date as date, e.km_run as km, e.hours, e.pace
               FROM entries e JOIN users u ON u.id = e.user_id
               ORDER BY e.entry_date DESC, e.user_id ASC LIMIT 500`;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch entries' });
    res.json({ entries: rows });
  });
});

router.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
  const targetId = Number(req.params.id);
  if (!Number.isInteger(targetId) || targetId <= 0) return res.status(400).json({ error: 'Invalid user id' });
  if (targetId === req.session.userId) return res.status(400).json({ error: 'Cannot delete yourself' });
  // Prevent deleting the seeded admin account named 'admin'
  db.get('SELECT email FROM users WHERE id = ?', [targetId], (err, row) => {
    if (err) return res.status(500).json({ error: 'Lookup failed' });
    if (!row) return res.status(404).json({ error: 'User not found' });
    if (row.email === 'admin') return res.status(400).json({ error: 'Cannot delete primary admin' });
    db.run('DELETE FROM users WHERE id = ?', [targetId], function(delErr) {
      if (delErr) return res.status(500).json({ error: 'Delete failed' });
      return res.json({ ok: true, deleted: this.changes });
    });
  });
});


router.get('/api/admin/top10', requireAdmin, (req, res) => {
  const { month } = req.query; // format YYYY-MM
  let start, end;
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    start = month + '-01';
    // Compute end as next month
    const [y, m] = month.split('-').map(Number);
    const next = new Date(y, m, 1); // m is 1-based here due to Date usage below
    const nextY = next.getFullYear();
    const nextM = String(next.getMonth() + 1).padStart(2, '0');
    end = `${nextY}-${nextM}-01`;
  } else {
    // default: current month
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    start = `${y}-${m}-01`;
    const next = new Date(y, now.getMonth() + 1, 1);
    const nextY = next.getFullYear();
    const nextM = String(next.getMonth() + 1).padStart(2, '0');
    end = `${nextY}-${nextM}-01`;
  }

  const sql = `SELECT u.id as user_id, u.email, ROUND(SUM(e.km_run), 2) as total_km
               FROM entries e JOIN users u ON u.id = e.user_id
               WHERE e.entry_date >= ? AND e.entry_date < ?
               GROUP BY e.user_id
               ORDER BY total_km DESC
               LIMIT 10`;
  db.all(sql, [start, end], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to compute top 10' });
    res.json({ month: start.slice(0,7), top10: rows });
  });
});

// Admin uploads listing
router.get('/api/admin/uploads', requireAdmin, (req, res) => {
  const { user_id } = req.query;
  const params = [];
  let where = '';
  if (user_id) {
    where = 'WHERE u.id = ?';
    params.push(Number(user_id));
  }
  const sql = `SELECT up.id, up.user_id, u.email, up.entry_id, e.entry_date as date, up.filename, up.originalname, up.mimetype, up.size, up.created_at
               FROM uploads up
               JOIN users u ON u.id = up.user_id
               LEFT JOIN entries e ON e.id = up.entry_id
               ${where}
               ORDER BY up.created_at DESC
               LIMIT 200`;
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch uploads' });
    res.json({ uploads: rows });
  });
});

// Admin secure file fetch
router.get('/api/admin/uploads/:id/file', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
  db.get('SELECT filename, originalname, mimetype FROM uploads WHERE id = ?', [id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'Not found' });
    const filePath = path.join(uploadDir, row.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing' });
    res.setHeader('Content-Type', row.mimetype);
    res.setHeader('Content-Disposition', `inline; filename="${row.originalname.replaceAll('"','')}"`);
    fs.createReadStream(filePath).pipe(res);
  });
});

// User uploads endpoint - users can access their own uploads
router.get('/api/uploads/:id/file', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
  db.get('SELECT filename, originalname, mimetype FROM uploads WHERE id = ? AND user_id = ?', [id, req.session.userId], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'Not found' });
    const filePath = path.join(uploadDir, row.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing' });
    res.setHeader('Content-Type', row.mimetype);
    res.setHeader('Content-Disposition', `inline; filename="${row.originalname.replaceAll('"','')}"`);
    fs.createReadStream(filePath).pipe(res);
  });
});

// Serve SPA
router.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'public', 'index.html'));
});

export default router;


