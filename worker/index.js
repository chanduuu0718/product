const encoder = new TextEncoder();
const decoder = new TextDecoder();
const SESSION_COOKIE = 'upcha_session';
const SESSION_DAYS = 7;
const PASSWORD_ITERATIONS = 100000;

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra }
  });
}

function base64url(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64url(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

function bytesToB64(bytes) { return base64url(new Uint8Array(bytes)); }
function b64ToBytes(value) { return fromBase64url(value); }

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: PASSWORD_ITERATIONS, hash: 'SHA-256' }, key, 256);
  return new Uint8Array(bits);
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await passwordHash(password, salt);
  return { salt: bytesToB64(salt), hash: bytesToB64(hash) };
}

async function verifyPassword(password, saltB64, hashB64) {
  const hash = await passwordHash(password, b64ToBytes(saltB64));
  return constantTimeEqual(hash, b64ToBytes(hashB64));
}

async function signSession(payload, secret) {
  const body = base64url(encoder.encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  return `${body}.${base64url(new Uint8Array(sig))}`;
}

async function verifySession(token, secret) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  try {
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('HMAC', key, fromBase64url(sig), encoder.encode(body));
    if (!ok) return null;
    const payload = JSON.parse(decoder.decode(fromBase64url(body)));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function setSessionCookie(token) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`;
}
function clearSessionCookie() { return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`; }

async function requireAuth(request, env) {
  if (!env.SESSION_SECRET) return null;
  const token = getCookie(request, SESSION_COOKIE);
  const session = await verifySession(token, env.SESSION_SECRET);
  return session?.username ? session : null;
}

function normalizeCode(value) { return String(value || '').trim().toUpperCase(); }
function productFromRow(row) {
  if (!row) return null;
  let images = [];
  try { images = JSON.parse(row.images); } catch { images = []; }
  return { ...row, originalPrice: row.original_price, affiliateUrl: row.affiliate_url, images };
}
function validProduct(body) {
  return body && String(body.code || '').trim() && String(body.name || '').trim() && Number(body.price) >= 0 && String(body.affiliateUrl || '').trim() && Array.isArray(body.images) && body.images.length >= 1 && body.images.length <= 4;
}
function validPassword(password) { return typeof password === 'string' && password.length >= 8 && password.length <= 200; }
function extension(type) { return ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' })[type] || null; }

async function ensureAdmin(env) {
  const existing = await env.DB.prepare('SELECT id FROM admins WHERE username = ?1').bind(env.ADMIN_USER || 'admin').first();
  if (existing) return;
  if (!env.ADMIN_BOOTSTRAP_PASSWORD || !validPassword(env.ADMIN_BOOTSTRAP_PASSWORD)) return;
  const credentials = await hashPassword(env.ADMIN_BOOTSTRAP_PASSWORD);
  try {
    await env.DB.prepare('INSERT INTO admins (username,password_hash,password_salt) VALUES (?1,?2,?3)')
      .bind(env.ADMIN_USER || 'admin', credentials.hash, credentials.salt).run();
  } catch { /* another request may have created the admin */ }
}

async function adminLogin(request, env) {
  await ensureAdmin(env);
  const body = await request.json().catch(() => ({}));
  const username = String(body.username || '');
  const password = String(body.password || '');
  const admin = await env.DB.prepare('SELECT username,password_hash,password_salt FROM admins WHERE username = ?1').bind(username).first();
  if (!admin || !(await verifyPassword(password, admin.password_salt, admin.password_hash))) return json({ error: 'Invalid credentials' }, 401);
  const token = await signSession({ username, exp: Date.now() + SESSION_DAYS * 86400000 }, env.SESSION_SECRET);
  return json({ ok: true, username }, 200, { 'set-cookie': setSessionCookie(token) });
}

async function changePassword(request, env, session) {
  const body = await request.json().catch(() => ({}));
  const currentPassword = String(body.currentPassword || '');
  const newPassword = String(body.newPassword || '');
  const admin = await env.DB.prepare('SELECT password_hash,password_salt FROM admins WHERE username = ?1').bind(session.username).first();
  if (!admin || !(await verifyPassword(currentPassword, admin.password_salt, admin.password_hash))) return json({ error: 'Current password is incorrect.' }, 400);
  if (!validPassword(newPassword)) return json({ error: 'New password must be at least 8 characters.' }, 400);
  const credentials = await hashPassword(newPassword);
  await env.DB.prepare('UPDATE admins SET password_hash=?1,password_salt=?2,updated_at=CURRENT_TIMESTAMP WHERE username=?3').bind(credentials.hash, credentials.salt, session.username).run();
  return json({ ok: true });
}

async function uploadImages(request, env) {
  const form = await request.formData();
  const files = form.getAll('images').filter(x => x instanceof File);
  if (!files.length || files.length > 4) return json({ error: 'Choose 1–4 images.' }, 400);
  const images = [];
  for (const file of files) {
    if (file.size > 5 * 1024 * 1024) return json({ error: 'Each image must be 5MB or smaller.' }, 400);
    const ext = extension(file.type);
    if (!ext) return json({ error: 'Use JPG, PNG, WEBP or GIF images.' }, 400);
    const key = `products/${crypto.randomUUID()}.${ext}`;
    await env.IMAGES.put(key, file.stream(), { httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=31536000, immutable' } });
    images.push(`/images/${key}`);
  }
  return json({ images });
}

async function handleApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/api/health' && request.method === 'GET') return json({ ok: true, service: 'upcha-product' });

  if (path === '/api/auth/login' && request.method === 'POST') return adminLogin(request, env);
  if (path === '/api/auth/logout' && request.method === 'POST') return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie() });
  if (path === '/api/auth/me' && request.method === 'GET') {
    const session = await requireAuth(request, env);
    return session ? json({ username: session.username }) : json({ error: 'Unauthorized' }, 401);
  }

  if (path === '/api/products' && request.method === 'GET') return json({ error: 'Use a product code.' }, 400);
  const publicMatch = path.match(/^\/api\/products\/([^/]+)$/);
  const clickMatch = path.match(/^\/api\/products\/([^/]+)\/click$/);

  if (publicMatch && request.method === 'GET') {
    const code = decodeURIComponent(publicMatch[1]);
    const row = await env.DB.prepare("SELECT * FROM products WHERE code = ?1 AND status = 'Published'").bind(normalizeCode(code)).first();
    return row ? json(productFromRow(row)) : json({ error: 'Product not found' }, 404);
  }
  if (clickMatch && request.method === 'POST') {
    const code = normalizeCode(decodeURIComponent(clickMatch[1]));
    const row = await env.DB.prepare("SELECT id,affiliate_url FROM products WHERE code = ?1 AND status = 'Published'").bind(code).first();
    if (!row) return json({ error: 'Product not found' }, 404);
    await env.DB.prepare('UPDATE products SET clicks = clicks + 1 WHERE id = ?1').bind(row.id).run();
    return json({ url: row.affiliate_url });
  }

  const session = await requireAuth(request, env);
  if (!session) return json({ error: 'Unauthorized' }, 401);

  if (path === '/api/auth/change-password' && request.method === 'POST') return changePassword(request, env, session);
  if (path === '/api/admin/upload' && request.method === 'POST') return uploadImages(request, env);

  if (path === '/api/admin/products' && request.method === 'GET') {
    const rows = await env.DB.prepare('SELECT * FROM products ORDER BY id DESC').all();
    return json(rows.results.map(productFromRow));
  }

  if (path === '/api/admin/products' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    if (!validProduct(body)) return json({ error: 'Code, name, price, affiliate link and 1–4 images are required.' }, 400);
    try {
      await env.DB.prepare('INSERT INTO products (code,name,price,original_price,description,affiliate_url,images,status) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)')
        .bind(normalizeCode(body.code), String(body.name).trim(), Number(body.price), Number(body.originalPrice || body.price), String(body.description || ''), String(body.affiliateUrl).trim(), JSON.stringify(body.images), body.status === 'Published' ? 'Published' : 'Draft').run();
      const row = await env.DB.prepare('SELECT * FROM products WHERE code=?1').bind(normalizeCode(body.code)).first();
      return json(productFromRow(row), 201);
    } catch { return json({ error: 'Product code already exists.' }, 409); }
  }

  const adminProduct = path.match(/^\/api\/admin\/products\/(\d+)$/);
  if (adminProduct && request.method === 'PUT') {
    const body = await request.json().catch(() => ({}));
    if (!validProduct(body)) return json({ error: 'Code, name, price, affiliate link and 1–4 images are required.' }, 400);
    try {
      await env.DB.prepare('UPDATE products SET code=?1,name=?2,price=?3,original_price=?4,description=?5,affiliate_url=?6,images=?7,status=?8,updated_at=CURRENT_TIMESTAMP WHERE id=?9')
        .bind(normalizeCode(body.code), String(body.name).trim(), Number(body.price), Number(body.originalPrice || body.price), String(body.description || ''), String(body.affiliateUrl).trim(), JSON.stringify(body.images), body.status === 'Published' ? 'Published' : 'Draft', Number(adminProduct[1])).run();
      const row = await env.DB.prepare('SELECT * FROM products WHERE id=?1').bind(Number(adminProduct[1])).first();
      return row ? json(productFromRow(row)) : json({ error: 'Product not found' }, 404);
    } catch { return json({ error: 'Product code already exists.' }, 409); }
  }
  if (adminProduct && request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM products WHERE id=?1').bind(Number(adminProduct[1])).run();
    return json({ ok: true });
  }

  return json({ error: 'Not found' }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith('/api/')) return await handleApi(request, env);
      if (url.pathname.startsWith('/images/')) {
        const key = decodeURIComponent(url.pathname.slice('/images/'.length));
        const object = await env.IMAGES.get(key);
        if (!object) return new Response('Not found', { status: 404 });
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);
        headers.set('cache-control', 'public, max-age=31536000, immutable');
        return new Response(object.body, { headers });
      }
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error(error);
      return json({ error: 'Server error. Please try again.' }, 500);
    }
  }
};
