import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dataDir = path.resolve(process.env.APP_DATA_DIR || path.join(root, 'data'));
const uploadDir = path.join(dataDir, 'uploads');
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });

const db = new Database(path.join(dataDir, 'products.db'));
db.pragma('journal_mode = WAL');
db.exec(`CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, price INTEGER NOT NULL, original_price INTEGER NOT NULL, description TEXT DEFAULT '', affiliate_url TEXT NOT NULL, images TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Draft', clicks INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`);

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use('/uploads', express.static(uploadDir, { maxAge: '7d', immutable: true }));
const upload = multer({
  storage: multer.diskStorage({ destination: uploadDir, filename: (_, file, cb) => cb(null, crypto.randomUUID() + path.extname(file.originalname).toLowerCase()) }),
  limits: { files: 4, fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, file, cb) => cb(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype))
});

const isProduction = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || (!isProduction ? 'change-this-secret-before-production' : '');
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '';
if (isProduction && (!JWT_SECRET || JWT_SECRET.length < 32)) throw new Error('JWT_SECRET must be set to a random secret of at least 32 characters in production.');
if (isProduction && !ADMIN_PASSWORD_HASH) throw new Error('ADMIN_PASSWORD_HASH must be set in production.');
const loginHash = ADMIN_PASSWORD_HASH || bcrypt.hashSync('change-me-now', 12);

function auth(req, res, next) {
  try {
    const token = req.cookies.admin_token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}
function cleanProduct(row) { return row ? { ...row, originalPrice: row.original_price, affiliateUrl: row.affiliate_url, images: JSON.parse(row.images) } : null; }
function validateProduct(body) { return body.code && body.name && Number(body.price) >= 0 && body.affiliateUrl && Array.isArray(body.images) && body.images.length >= 1 && body.images.length <= 4; }

app.get('/api/health', (_, res) => res.json({ ok: true }));

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username !== ADMIN_USER || !bcrypt.compareSync(password || '', loginHash)) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('admin_token', token, { httpOnly: true, sameSite: 'lax', secure: isProduction, maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.json({ ok: true, username });
});
app.post('/api/auth/logout', (req, res) => { res.clearCookie('admin_token'); res.json({ ok: true }); });
app.get('/api/auth/me', auth, (req, res) => res.json({ username: req.admin.username }));

app.get('/api/products/:code', (req, res) => { const row = db.prepare("SELECT * FROM products WHERE lower(code)=lower(?) AND status='Published'").get(req.params.code); if (!row) return res.status(404).json({ error: 'Product not found' }); res.json(cleanProduct(row)); });
app.post('/api/products/:code/click', (req, res) => { db.prepare("UPDATE products SET clicks=clicks+1 WHERE lower(code)=lower(?) AND status='Published'").run(req.params.code); const row = db.prepare("SELECT affiliate_url FROM products WHERE lower(code)=lower(?) AND status='Published'").get(req.params.code); if (!row) return res.status(404).json({ error: 'Product not found' }); res.json({ url: row.affiliate_url }); });

app.get('/api/admin/products', auth, (_, res) => res.json(db.prepare('SELECT * FROM products ORDER BY id DESC').all().map(cleanProduct)));
app.post('/api/admin/upload', auth, upload.array('images', 4), (req, res) => res.json({ images: (req.files || []).map(f => '/uploads/' + f.filename) }));
app.post('/api/admin/products', auth, (req, res) => { if (!validateProduct(req.body)) return res.status(400).json({ error: 'Code, name, price, affiliate link and 1–4 images are required.' }); try { const p = req.body; const result = db.prepare('INSERT INTO products (code,name,price,original_price,description,affiliate_url,images,status) VALUES (?,?,?,?,?,?,?,?)').run(p.code.trim().toUpperCase(), p.name.trim(), Number(p.price), Number(p.originalPrice || p.price), p.description || '', p.affiliateUrl.trim(), JSON.stringify(p.images), p.status === 'Published' ? 'Published' : 'Draft'); res.status(201).json(cleanProduct(db.prepare('SELECT * FROM products WHERE id=?').get(result.lastInsertRowid))); } catch { res.status(409).json({ error: 'Product code already exists.' }); } });
app.put('/api/admin/products/:id', auth, (req, res) => { if (!validateProduct(req.body)) return res.status(400).json({ error: 'Code, name, price, affiliate link and 1–4 images are required.' }); const p=req.body; db.prepare('UPDATE products SET code=?,name=?,price=?,original_price=?,description=?,affiliate_url=?,images=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(p.code.trim().toUpperCase(),p.name.trim(),Number(p.price),Number(p.originalPrice||p.price),p.description||'',p.affiliateUrl.trim(),JSON.stringify(p.images),p.status==='Published'?'Published':'Draft',req.params.id); res.json(cleanProduct(db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id))); });
app.delete('/api/admin/products/:id', auth, (req, res) => { db.prepare('DELETE FROM products WHERE id=?').run(req.params.id); res.json({ ok:true }); });

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Each image must be 5MB or smaller.' : 'You can upload up to 4 images at a time.' });
  if (err) return res.status(400).json({ error: 'Upload failed. Use JPG, PNG, WEBP or GIF images.' });
  next();
});

const dist = path.join(root, 'dist');
if (fs.existsSync(dist)) { app.use(express.static(dist)); app.get('*', (_, res) => res.sendFile(path.join(dist, 'index.html'))); }
const port = Number(process.env.PORT || 3000);
app.listen(port, '0.0.0.0', () => console.log(`UPCHA product portal running on http://localhost:${port}`));
