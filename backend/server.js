/**
 * Electronic Store - Full Backend Server & REST API
 * Built with pure Node.js (Zero external dependencies)
 * Run locally: node backend/server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 5000;
const PUBLIC_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');

// MIME types dictionary
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

// In-memory store fallback
const memoryStore = {};

// Helper to ensure data directory exists
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {
  // Read-only filesystem safe
}

// Data store helpers
function readData(filename, fallback = []) {
  if (memoryStore[filename]) {
    return memoryStore[filename];
  }
  try {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) {
      try {
        fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2), 'utf-8');
      } catch (_) {}
      memoryStore[filename] = fallback;
      return fallback;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content || '[]');
    memoryStore[filename] = parsed;
    return parsed;
  } catch (err) {
    console.error(`Error reading ${filename}:`, err.message);
    return memoryStore[filename] || fallback;
  }
}

function writeData(filename, data) {
  memoryStore[filename] = data;
  try {
    const filePath = path.join(DATA_DIR, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    return true;
  }
}

// Send JSON response
function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(payload));
}

// Parse request body JSON
function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 10 * 1024 * 1024) { // 10MB limit
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON format'));
      }
    });
    req.on('error', err => reject(err));
  });
}

// Main Request Handler
async function handleRequest(req, res) {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();

  // ==========================================
  // API ROUTING
  // ==========================================
  if (pathname.startsWith('/api/')) {
    try {
      // 1. GET /api/products
      if (pathname === '/api/products' && method === 'GET') {
        let products = readData('products.json', []);
        const { category, search, maxPrice, minPrice, sort } = parsedUrl.query;

        if (category && category !== 'all') {
          products = products.filter(p => p.category && p.category.toLowerCase() === category.toLowerCase());
        }
        if (search) {
          const s = search.toLowerCase().trim();
          products = products.filter(p => 
            (p.name && p.name.toLowerCase().includes(s)) ||
            (p.category && p.category.toLowerCase().includes(s)) ||
            (p.description && p.description.toLowerCase().includes(s))
          );
        }
        if (maxPrice) {
          const max = parseFloat(maxPrice);
          if (!isNaN(max)) products = products.filter(p => p.price <= max);
        }
        if (minPrice) {
          const min = parseFloat(minPrice);
          if (!isNaN(min)) products = products.filter(p => p.price >= min);
        }
        if (sort === 'low-to-high') {
          products.sort((a, b) => a.price - b.price);
        } else if (sort === 'high-to-low') {
          products.sort((a, b) => b.price - a.price);
        }

        return sendJson(res, 200, { success: true, count: products.length, products });
      }

      // 2. GET /api/products/:id
      if (pathname.startsWith('/api/products/') && method === 'GET') {
        const id = parseInt(pathname.replace('/api/products/', ''), 10);
        const products = readData('products.json', []);
        const product = products.find(p => p.id === id);
        if (product) {
          return sendJson(res, 200, { success: true, product });
        }
        return sendJson(res, 404, { success: false, message: 'Product not found' });
      }

      // 3. POST /api/auth/register
      if (pathname === '/api/auth/register' && method === 'POST') {
        const body = await parseRequestBody(req);
        const { name, email, password } = body;

        if (!name || !email || !password) {
          return sendJson(res, 400, { success: false, message: 'Name, email, and password are required.' });
        }

        const users = readData('users.json', []);
        const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (existing) {
          return sendJson(res, 409, { success: false, message: 'An account with this email already exists.' });
        }

        const newUser = {
          id: Date.now(),
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password: password,
          createdAt: new Date().toISOString()
        };

        users.push(newUser);
        writeData('users.json', users);

        const safeUser = { id: newUser.id, name: newUser.name, email: newUser.email, createdAt: newUser.createdAt };
        return sendJson(res, 201, {
          success: true,
          message: 'Account created successfully!',
          user: safeUser,
          token: `token_${newUser.id}_${Date.now()}`
        });
      }

      // 4. POST /api/auth/login
      if (pathname === '/api/auth/login' && method === 'POST') {
        const body = await parseRequestBody(req);
        const { email, password } = body;

        if (!email || !password) {
          return sendJson(res, 400, { success: false, message: 'Email and password are required.' });
        }

        const users = readData('users.json', []);
        const user = users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
        
        if (!user || user.password !== password) {
          return sendJson(res, 401, { success: false, message: 'Invalid email or password.' });
        }

        const safeUser = { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt };
        return sendJson(res, 200, {
          success: true,
          message: 'Logged in successfully!',
          user: safeUser,
          token: `token_${user.id}_${Date.now()}`
        });
      }

      // 5. POST /api/orders
      if (pathname === '/api/orders' && method === 'POST') {
        const body = await parseRequestBody(req);
        const { items, customer, address, paymentMethod, total } = body;

        if (!items || !items.length) {
          return sendJson(res, 400, { success: false, message: 'Order must contain at least one item.' });
        }

        const orders = readData('orders.json', []);
        const newOrder = {
          orderId: 'ORD-' + Math.floor(100000 + Math.random() * 900000),
          items,
          customer: customer || { name: 'Guest', email: 'guest@example.com' },
          address: address || 'N/A',
          paymentMethod: paymentMethod || 'Cash On Delivery',
          total: parseFloat(total) || 0,
          status: 'Confirmed',
          createdAt: new Date().toISOString()
        };

        orders.push(newOrder);
        writeData('orders.json', orders);

        return sendJson(res, 201, {
          success: true,
          message: `Order #${newOrder.orderId} placed successfully!`,
          order: newOrder
        });
      }

      // 6. GET /api/orders
      if (pathname === '/api/orders' && method === 'GET') {
        const orders = readData('orders.json', []);
        return sendJson(res, 200, { success: true, count: orders.length, orders });
      }

      // 7. POST /api/contact
      if (pathname === '/api/contact' && method === 'POST') {
        const body = await parseRequestBody(req);
        const { name, email, phone, subject, message } = body;

        if (!name || !email || !message) {
          return sendJson(res, 400, { success: false, message: 'Name, email, and message are required.' });
        }

        const messages = readData('messages.json', []);
        const newMessage = {
          id: Date.now(),
          name: name.trim(),
          email: email.trim(),
          phone: phone ? phone.trim() : '',
          subject: subject ? subject.trim() : 'General Inquiry',
          message: message.trim(),
          createdAt: new Date().toISOString()
        };

        messages.push(newMessage);
        writeData('messages.json', messages);

        return sendJson(res, 201, {
          success: true,
          message: 'Thank you for reaching out! We have received your message and will get back to you shortly.'
        });
      }

      // 8. GET /api/contact
      if (pathname === '/api/contact' && method === 'GET') {
        const messages = readData('messages.json', []);
        return sendJson(res, 200, { success: true, count: messages.length, messages });
      }

      // 9. POST /api/subscribe
      if (pathname === '/api/subscribe' && method === 'POST') {
        const body = await parseRequestBody(req);
        const { email } = body;

        if (!email || !email.includes('@')) {
          return sendJson(res, 400, { success: false, message: 'A valid email address is required.' });
        }

        const subscribers = readData('subscribers.json', []);
        if (!subscribers.some(s => s.email.toLowerCase() === email.toLowerCase())) {
          subscribers.push({
            email: email.trim().toLowerCase(),
            subscribedAt: new Date().toISOString()
          });
          writeData('subscribers.json', subscribers);
        }

        return sendJson(res, 200, {
          success: true,
          message: 'You have been subscribed to our newsletter for exclusive deals!'
        });
      }

      // 10. GET /api/stats (system overview)
      if (pathname === '/api/stats' && method === 'GET') {
        const products = readData('products.json', []);
        const users = readData('users.json', []);
        const orders = readData('orders.json', []);
        const messages = readData('messages.json', []);
        return sendJson(res, 200, {
          success: true,
          stats: {
            products: products.length,
            users: users.length,
            orders: orders.length,
            messages: messages.length
          }
        });
      }

      // Unknown API endpoint
      return sendJson(res, 404, { success: false, message: 'API route not found' });
    } catch (apiErr) {
      console.error('API Error:', apiErr);
      return sendJson(res, 500, { success: false, message: apiErr.message || 'Internal Server Error' });
    }
  }

  // ==========================================
  // STATIC FILE SERVING
  // ==========================================
  let safePath = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') {
    safePath = '/home.html';
  }

  const filePath = path.join(PUBLIC_DIR, safePath);

  // Security check: ensure filePath is within PUBLIC_DIR
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Access Denied');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      const htmlTry = filePath + '.html';
      if (fs.existsSync(htmlTry)) {
        res.writeHead(200, { 'Content-Type': MIME_TYPES['.html'] });
        return fs.createReadStream(htmlTry).pipe(res);
      }
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html>
<html>
<head><title>404 - Page Not Found</title><style>body{font-family:sans-serif;text-align:center;padding:50px;background:#0d1527;color:#fff}a{color:#00e5ff}</style></head>
<body>
  <h1>404 - Page Not Found</h1>
  <p>The requested file <code>${pathname}</code> was not found.</p>
  <p><a href="/home.html">Return to Home</a></p>
</body>
</html>`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

// Start Server locally when executed directly with `node backend/server.js`
if (require.main === module) {
  const server = http.createServer(handleRequest);
  server.listen(PORT, () => {
    console.log('========================================================');
    console.log(`🚀 Electronic Store Server is running!`);
    console.log(`📍 Web URL: http://localhost:${PORT}/home.html`);
    console.log(`🔌 API Base: http://localhost:${PORT}/api/products`);
    console.log(`💾 Data stored in: ${DATA_DIR}`);
    console.log('========================================================');
  });
}

module.exports = handleRequest;
