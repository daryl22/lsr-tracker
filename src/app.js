import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import SQLiteStoreFactory from 'connect-sqlite3';
import dotenv from 'dotenv';

import { ensureDatabase } from './db.js';
import cors from 'cors';
import authRouter from './routes/auth.js';
import mainRouter from './routes/index.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const SQLiteStore = SQLiteStoreFactory(session);

ensureDatabase();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

app.use(express.urlencoded({ limit: '5mb', extended: true }));
app.use(express.json());
app.use('/public', express.static(path.join(__dirname, '..', 'public')));

app.use(cors({ origin: true, credentials: true }));

const SESSION_SECRET = process.env.SESSION_SECRET || 'dev_secret_change_me';

app.use(
  session({
    store: new SQLiteStore({ db: 'sessions.db', dir: path.join(__dirname, '..', 'data') }),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
  })
);

app.use((req, res, next) => {
  res.locals.currentUserId = req.session.userId || null;
  next();
});

app.use('/', authRouter);
app.use('/', mainRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${PORT}`);
});


