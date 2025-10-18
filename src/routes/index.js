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
  req.user = { id: req.session.userId };
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.userId || !req.session.isAdmin) return res.status(403).json({ error: 'Forbidden' });
  req.user = { id: req.session.userId };
  next();
}

router.get('/api/entries', requireAuth, (req, res) => {
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
  
  db.all(
    `SELECT e.id, e.entry_date as date, e.km_run as km, e.hours, e.pace, 
            u.id as upload_id, u.filename, u.originalname, u.mimetype
     FROM entries e 
     LEFT JOIN uploads u ON u.entry_id = e.id 
     WHERE e.user_id = ? AND e.entry_date >= ? AND e.entry_date < ?
     ORDER BY e.entry_date DESC`,
    [req.session.userId, start, end],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch' });
      res.json({ entries: rows || [], month: start.slice(0,7) });
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
  
  const sql = `SELECT e.id, e.user_id, u.email, e.entry_date as date, e.km_run as km, e.hours, e.pace,
                      up.id as upload_id, up.filename, up.originalname, up.mimetype
               FROM entries e 
               JOIN users u ON u.id = e.user_id
               LEFT JOIN uploads up ON up.entry_id = e.id
               WHERE e.entry_date >= ? AND e.entry_date < ?
               ORDER BY e.entry_date DESC, e.user_id ASC`;
  db.all(sql, [start, end], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch entries' });
    res.json({ entries: rows || [], month: start.slice(0,7) });
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

// Event management APIs
router.post('/api/admin/events', requireAdmin, (req, res) => {
  const { name, start_date, end_date, category, gender_restriction, km_goal } = req.body;
  
  if (!name || !start_date || !end_date || !category || !gender_restriction || km_goal === undefined || km_goal === null) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  if (!['advanced', 'intermediate'].includes(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }
  
  if (!['male', 'female', 'both'].includes(gender_restriction)) {
    return res.status(400).json({ error: 'Invalid gender restriction' });
  }
  
  if (new Date(start_date) >= new Date(end_date)) {
    return res.status(400).json({ error: 'End date must be after start date' });
  }
  
  const kmGoalNum = Number(km_goal) || 0;
  if (kmGoalNum < 0) {
    return res.status(400).json({ error: 'KM goal must be a positive number' });
  }
  
  const stmt = db.prepare(
    'INSERT INTO events (name, start_date, end_date, category, gender_restriction, km_goal, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  
  stmt.run(name, start_date, end_date, category, gender_restriction, kmGoalNum, req.session.userId, function(err) {
    if (err) return res.status(500).json({ error: 'Failed to create event' });
    res.json({ ok: true, eventId: this.lastID });
  });
});

router.get('/api/admin/events', requireAdmin, (req, res) => {
  db.all(
    `SELECT e.id, e.name, e.start_date, e.end_date, e.category, e.gender_restriction, e.km_goal,
            e.created_at, e.is_ended, u.email as created_by_email
     FROM events e
     JOIN users u ON u.id = e.created_by
     ORDER BY e.created_at DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch events' });
      res.json({ events: rows || [] });
    }
  );
});

// Get ended events with rankings (admin only)
router.get('/api/admin/events/ended', requireAdmin, (req, res) => {
  db.all(
    `SELECT e.id, e.name, e.start_date, e.end_date, e.category, e.gender_restriction, e.km_goal,
            e.created_at, e.is_ended, u.email as created_by_email
     FROM events e
     JOIN users u ON u.id = e.created_by
     WHERE e.is_ended = 1
     ORDER BY e.end_date DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch ended events' });
      res.json({ events: rows || [] });
    }
  );
});

router.put('/api/admin/events/:id', requireAdmin, (req, res) => {
  const eventId = Number(req.params.id);
  const { name, start_date, end_date, category, gender_restriction, km_goal } = req.body;
  
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return res.status(400).json({ error: 'Invalid event ID' });
  }
  
  if (!name || !start_date || !end_date || !category || !gender_restriction || km_goal === undefined || km_goal === null) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  if (!['advanced', 'intermediate'].includes(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }
  
  if (!['male', 'female', 'both'].includes(gender_restriction)) {
    return res.status(400).json({ error: 'Invalid gender restriction' });
  }
  
  if (new Date(start_date) >= new Date(end_date)) {
    return res.status(400).json({ error: 'End date must be after start date' });
  }
  
  const kmGoalNum = Number(km_goal) || 0;
  if (kmGoalNum < 0) {
    return res.status(400).json({ error: 'KM goal must be a positive number' });
  }
  
  db.run(
    'UPDATE events SET name = ?, start_date = ?, end_date = ?, category = ?, gender_restriction = ?, km_goal = ? WHERE id = ?',
    [name, start_date, end_date, category, gender_restriction, kmGoalNum, eventId],
    function(err) {
      if (err) return res.status(500).json({ error: 'Failed to update event' });
      if (this.changes === 0) return res.status(404).json({ error: 'Event not found' });
      res.json({ ok: true });
    }
  );
});

// End an event manually
router.post('/api/admin/events/:id/end', requireAdmin, (req, res) => {
  const eventId = Number(req.params.id);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return res.status(400).json({ error: 'Invalid event ID' });
  }
  
  db.run('UPDATE events SET is_ended = 1 WHERE id = ?', [eventId], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to end event' });
    if (this.changes === 0) return res.status(404).json({ error: 'Event not found' });
    res.json({ ok: true });
  });
});

router.delete('/api/admin/events/:id', requireAdmin, (req, res) => {
  const eventId = Number(req.params.id);
  
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return res.status(400).json({ error: 'Invalid event ID' });
  }
  
  db.run('DELETE FROM events WHERE id = ?', [eventId], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to delete event' });
    if (this.changes === 0) return res.status(404).json({ error: 'Event not found' });
    res.json({ ok: true });
  });
});

// Event participation APIs
router.post('/api/events/:id/join', requireAuth, (req, res) => {
  const eventId = Number(req.params.id);
  
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return res.status(400).json({ error: 'Invalid event ID' });
  }
  
  // Check if event exists and is active
  db.get('SELECT * FROM events WHERE id = ?', [eventId], (err, event) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    
    // Get current Philippine time (UTC+8)
    const now = new Date();
    const phTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    const startDate = new Date(event.start_date);
    const endDate = new Date(event.end_date);
    
    if (phTime < startDate) {
      return res.status(400).json({ error: 'Event has not started yet' });
    }
    if (phTime > endDate) {
      return res.status(400).json({ error: 'Event has already ended' });
    }
    
    // Check if user already joined
    db.get('SELECT id FROM event_participants WHERE event_id = ? AND user_id = ?', [eventId, req.session.userId], (err, existing) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (existing) return res.status(400).json({ error: 'You have already joined this event' });
      
      // Check gender eligibility
      db.get('SELECT gender FROM users WHERE id = ?', [req.session.userId], (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        // Check if user's gender matches event restriction
        if (event.gender_restriction !== 'both' && event.gender_restriction !== user.gender) {
          return res.status(403).json({ 
            error: `This event is exclusive to ${event.gender_restriction} participants only. You are ${user.gender}.` 
          });
        }
        
        // Join the event
        db.run('INSERT INTO event_participants (event_id, user_id) VALUES (?, ?)', [eventId, req.session.userId], function(err) {
          if (err) return res.status(500).json({ error: 'Failed to join event' });
          res.json({ ok: true, participantId: this.lastID });
        });
      });
    });
  });
});

router.get('/api/events/:id/participants', requireAuth, (req, res) => {
  const eventId = Number(req.params.id);
  
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return res.status(400).json({ error: 'Invalid event ID' });
  }
  
  db.all(
    `SELECT u.id, u.email, ep.joined_at
     FROM event_participants ep
     JOIN users u ON u.id = ep.user_id
     WHERE ep.event_id = ?
     ORDER BY ep.joined_at ASC`,
    [eventId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch participants' });
      res.json({ participants: rows || [] });
    }
  );
});

router.get('/api/events/:id/ranking', requireAuth, (req, res) => {
  const eventId = Number(req.params.id);
  
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return res.status(400).json({ error: 'Invalid event ID' });
  }
  
  // Get event details
  db.get('SELECT * FROM events WHERE id = ?', [eventId], (err, event) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    
    const startDate = event.start_date;
    const endDate = event.end_date;
    
    // Get participants with their total KM during the event period
    db.all(
      `SELECT u.id, u.email, COALESCE(SUM(e.km_run), 0) as total_km, COUNT(e.id) as entry_count
       FROM event_participants ep
       JOIN users u ON u.id = ep.user_id
       LEFT JOIN entries e ON e.user_id = u.id AND e.entry_date >= ? AND e.entry_date <= ?
       WHERE ep.event_id = ?
       GROUP BY u.id, u.email
       ORDER BY total_km DESC, u.email ASC`,
      [startDate, endDate, eventId],
      (err, rows) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch ranking' });
        res.json({ 
          event: event,
          ranking: rows || [],
          goal: event.km_goal
        });
      }
    );
  });
});

// Get ended events for users (public)
router.get('/api/events/ended', requireAuth, (req, res) => {
  const userId = req.user.id;
  
  db.all(
    `SELECT e.id, e.name, e.start_date, e.end_date, e.category, e.gender_restriction, e.km_goal,
            e.created_at, e.is_ended,
            CASE WHEN ep.user_id IS NOT NULL THEN 1 ELSE 0 END as has_joined
     FROM events e
     LEFT JOIN event_participants ep ON e.id = ep.event_id AND ep.user_id = ?
     WHERE e.is_ended = 1
     ORDER BY e.end_date DESC`,
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch ended events' });
      res.json({ events: rows || [] });
    }
  );
});

// Get available events for users
router.get('/api/events', requireAuth, (req, res) => {
  // Get current Philippine time (UTC+8)
  const now = new Date();
  const phTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  const today = phTime.toISOString().split('T')[0]; // Current date in YYYY-MM-DD format
  
  db.all(
    `SELECT e.id, e.name, e.start_date, e.end_date, e.category, e.gender_restriction, e.km_goal,
            e.created_at, e.is_ended, u.email as created_by_email,
            CASE WHEN ep.id IS NOT NULL THEN 1 ELSE 0 END as has_joined
     FROM events e 
     JOIN users u ON u.id = e.created_by
     LEFT JOIN event_participants ep ON ep.event_id = e.id AND ep.user_id = ?
     WHERE e.end_date >= ?
     ORDER BY e.start_date ASC`,
    [req.session.userId, today],
    (err, events) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch events' });
      
      // For each joined event, calculate user's rank
      const eventsWithRanking = events.map(event => {
        if (!event.has_joined) {
          return Promise.resolve({ ...event, user_rank: null, total_participants: 0 });
        }
        
        return new Promise((resolve) => {
          // Get ranking for this event
          db.all(
            `SELECT u.id, 
                    COALESCE(SUM(e.km_run), 0) as total_km,
                    COALESCE(SUM(e.hours), 0) as total_hours,
                    COUNT(DISTINCT e.entry_date) as total_days
             FROM event_participants ep
             JOIN users u ON u.id = ep.user_id
             LEFT JOIN entries e ON e.user_id = u.id AND e.entry_date >= ? AND e.entry_date <= ?
             WHERE ep.event_id = ?
             GROUP BY u.id
             ORDER BY total_km DESC, u.id ASC`,
            [event.start_date, event.end_date, event.id],
            (err, ranking) => {
              if (err) {
                resolve({ ...event, user_rank: null, total_participants: 0, user_total_km: 0, user_total_hours: 0, user_total_days: 0 });
                return;
              }
              
              const userRank = ranking.findIndex(r => r.id === req.session.userId) + 1;
              const userStats = ranking.find(r => r.id === req.session.userId);
              resolve({ 
                ...event, 
                user_rank: userRank > 0 ? userRank : null, 
                total_participants: ranking.length,
                user_total_km: userStats ? userStats.total_km : 0,
                user_total_hours: userStats ? userStats.total_hours : 0,
                user_total_days: userStats ? userStats.total_days : 0
              });
            }
          );
        });
      });
      
      Promise.all(eventsWithRanking).then(eventsData => {
        res.json({ events: eventsData });
      });
    }
  );
});

// Get entries for a specific event (for current user)
router.get('/api/events/:id/entries', requireAuth, (req, res) => {
  const eventId = Number(req.params.id);
  
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return res.status(400).json({ error: 'Invalid event ID' });
  }
  
  // Check if event exists
  db.get('SELECT * FROM events WHERE id = ?', [eventId], (err, event) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    
    // Check if user is participant in this event
    db.get('SELECT id FROM event_participants WHERE event_id = ? AND user_id = ?', [eventId, req.session.userId], (err, participant) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (!participant) return res.status(403).json({ error: 'You are not a participant in this event' });
      
      // Get user's entries for this event
      const sql = `SELECT e.id, e.entry_date as date, e.km_run as km, e.hours, e.pace,
                          up.id as upload_id, up.filename, up.originalname, up.mimetype
                   FROM entries e
                   LEFT JOIN uploads up ON up.entry_id = e.id
                   WHERE e.user_id = ? AND e.entry_date >= ? AND e.entry_date <= ?
                   ORDER BY e.entry_date DESC`;
      
      db.all(sql, [req.session.userId, event.start_date, event.end_date], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch entries' });
        res.json({ entries: rows || [], event: event });
      });
    });
  });
});

// Submit entry for event participants
router.post('/api/events/:id/entry', requireAuth, entryUpload, (req, res) => {
  const eventId = Number(req.params.id);
  const { date, km, hours, pace } = req.body;
  
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return res.status(400).json({ error: 'Invalid event ID' });
  }
  
  if (!date) return res.status(400).json({ error: 'Missing date' });
  if (!req.file) return res.status(400).json({ error: 'Screenshot file is required' });
  
  // Check if user is participant in this event
  db.get('SELECT id FROM event_participants WHERE event_id = ? AND user_id = ?', [eventId, req.session.userId], (err, participant) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!participant) return res.status(403).json({ error: 'You are not a participant in this event' });
    
    // Check if entry date is within event period
    db.get('SELECT start_date, end_date FROM events WHERE id = ?', [eventId], (err, event) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (!event) return res.status(404).json({ error: 'Event not found' });
      
      if (date < event.start_date || date > event.end_date) {
        return res.status(400).json({ error: 'Entry date must be within event period' });
      }
      
      // Check if submission is closed for this date
      db.get('SELECT id FROM event_closed_dates WHERE event_id = ? AND closed_date = ?', [eventId, date], (err, closedDate) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (closedDate) {
          return res.status(400).json({ error: 'Entry submission is closed for this date' });
        }
        
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
    });
  });
});

// Admin API for managing closed submission dates
router.post('/api/admin/events/:id/close-date', requireAdmin, (req, res) => {
  const eventId = Number(req.params.id);
  const { date } = req.body;
  
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return res.status(400).json({ error: 'Invalid event ID' });
  }
  
  if (!date) return res.status(400).json({ error: 'Missing date' });
  
  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
  }
  
  // Check if event exists
  db.get('SELECT id, start_date, end_date FROM events WHERE id = ?', [eventId], (err, event) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    
    // Check if date is within event period
    if (date < event.start_date || date > event.end_date) {
      return res.status(400).json({ error: 'Date must be within event period' });
    }
    
    // Insert closed date
    const stmt = db.prepare('INSERT INTO event_closed_dates (event_id, closed_date, created_by) VALUES (?, ?, ?)');
    stmt.run(eventId, date, req.session.userId, function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          return res.status(400).json({ error: 'This date is already closed for submissions' });
        }
        return res.status(500).json({ error: 'Failed to close date' });
      }
      res.json({ ok: true, closedDateId: this.lastID });
    });
  });
});

router.delete('/api/admin/events/:id/close-date', requireAdmin, (req, res) => {
  const eventId = Number(req.params.id);
  const { date } = req.body;
  
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return res.status(400).json({ error: 'Invalid event ID' });
  }
  
  if (!date) return res.status(400).json({ error: 'Missing date' });
  
  const stmt = db.prepare('DELETE FROM event_closed_dates WHERE event_id = ? AND closed_date = ?');
  stmt.run(eventId, date, function(err) {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Closed date not found' });
    }
    res.json({ ok: true });
  });
});

router.get('/api/admin/events/:id/closed-dates', requireAdmin, (req, res) => {
  const eventId = Number(req.params.id);
  
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return res.status(400).json({ error: 'Invalid event ID' });
  }
  
  db.all(
    `SELECT ecd.id, ecd.closed_date, ecd.created_at, u.email as closed_by_email
     FROM event_closed_dates ecd
     JOIN users u ON u.id = ecd.created_by
     WHERE ecd.event_id = ?
     ORDER BY ecd.closed_date ASC`,
    [eventId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch closed dates' });
      res.json({ closedDates: rows || [] });
    }
  );
});

// Serve SPA
router.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'public', 'index.html'));
});

export default router;
