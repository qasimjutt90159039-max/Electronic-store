/**
 * Electronic Store - Unified Client Application Engine
 * Handles Authentication, Cart, Checkout, Order Tracking, Contact,
 * Policies, FAQs, Live Search, Price Filtering, Sorting, and REST API.
 */

(function () {
  'use strict';

  // Configuration
  const API_BASE = window.location.origin.startsWith('http') ? window.location.origin + '/api' : 'http://localhost:5000/api';
  let isApiOnline = false;

  // Local State Keys
  const STORAGE_KEYS = {
    CART: 'es_cart_items',
    USER: 'es_active_user',
    USERS: 'es_local_users',
    ORDERS: 'es_local_orders',
    MESSAGES: 'es_local_messages'
  };

  // Seed default demo user in localStorage if not present
  (function seedDemoUser() {
    try {
      const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
      if (!users.some(u => u.email === 'qasim@example.com')) {
        users.push({
          id: 1,
          name: 'Qasim',
          email: 'qasim@example.com',
          password: 'password123'
        });
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      }
    } catch (e) {
      console.warn('Storage warning:', e);
    }
  })();

  // Test API availability
  async function checkApiHealth() {
    try {
      const res = await fetch(`${API_BASE}/products?limit=1`, { method: 'GET', signal: AbortSignal.timeout(1500) });
      isApiOnline = res.ok;
    } catch (e) {
      isApiOnline = false;
    }
  }

  // ==========================================================
  // STATE MANAGEMENT
  // ==========================================================
  const State = {
    getCart() {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.CART) || '[]');
      } catch (e) {
        return [];
      }
    },
    saveCart(cart) {
      localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(cart));
      App.updateCartBadge();
      App.renderCartDrawer();
    },
    getUser() {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.USER) || 'null');
      } catch (e) {
        return null;
      }
    },
    setUser(user) {
      if (user) {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      } else {
        localStorage.removeItem(STORAGE_KEYS.USER);
      }
      App.updateAuthUI();
    }
  };

  // ==========================================================
  // TOAST NOTIFICATIONS
  // ==========================================================
  function showToast(message, type = 'info') {
    let container = document.getElementById('esToastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'esToastContainer';
      container.className = 'es-toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `es-toast ${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✓';
    if (type === 'error') icon = '✕';

    toast.innerHTML = `<span><strong>${icon}</strong></span><span>${message}</span>`;
    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // ==========================================================
  // UI INJECTION: MODALS & CART DRAWER
  // ==========================================================
  function injectComponents() {
    if (document.getElementById('esGlobalModals')) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'esGlobalModals';
    wrapper.innerHTML = `
      <!-- CART DRAWER -->
      <div id="esCartDrawer" class="es-cart-drawer">
        <div class="es-cart-header">
          <h3>🛒 Your Shopping Cart</h3>
          <button class="es-modal-close" id="esCloseCart">&times;</button>
        </div>
        <div class="es-cart-items" id="esCartItemsList">
          <!-- Dynamically populated -->
        </div>
        <div class="es-cart-footer">
          <div class="es-cart-subtotal">
            <span>Subtotal:</span>
            <span id="esCartSubtotalVal">$0.00</span>
          </div>
          <button class="es-btn-primary" id="esProceedCheckoutBtn">Proceed to Checkout</button>
        </div>
      </div>

      <!-- MODAL OVERLAY -->
      <div id="esModalOverlay" class="es-modal-overlay">
        <!-- AUTH MODAL -->
        <div id="esAuthModal" class="es-modal-box" style="display: none;">
          <button class="es-modal-close" id="esCloseAuth">&times;</button>
          <div class="es-auth-tabs">
            <button class="es-tab-btn active" id="esTabLogin">Sign In</button>
            <button class="es-tab-btn" id="esTabRegister">Create Account</button>
          </div>

          <!-- LOGIN FORM -->
          <form id="esLoginForm">
            <div class="es-form-group">
              <label for="loginEmail">Email Address</label>
              <input type="email" id="loginEmail" class="es-input" placeholder="e.g. qasim@example.com" required>
            </div>
            <div class="es-form-group">
              <label for="loginPass">Password</label>
              <input type="password" id="loginPass" class="es-input" placeholder="Enter your password" required>
            </div>
            <button type="submit" class="es-btn-primary">Sign In to Account</button>
            <div class="es-hint-box">
              <strong>Quick Demo Login:</strong><br>
              Email: <code>qasim@example.com</code> | Pass: <code>password123</code><br>
              <button type="button" id="esFillDemoBtn" style="background:none;border:none;color:#00e5ff;cursor:pointer;text-decoration:underline;padding:4px 0;font-size:12px;">Auto-fill demo credentials</button>
            </div>
          </form>

          <!-- REGISTER FORM -->
          <form id="esRegisterForm" style="display: none;">
            <div class="es-form-group">
              <label for="regName">Full Name</label>
              <input type="text" id="regName" class="es-input" placeholder="e.g. Qasim Khan" required>
            </div>
            <div class="es-form-group">
              <label for="regEmail">Email Address</label>
              <input type="email" id="regEmail" class="es-input" placeholder="name@example.com" required>
            </div>
            <div class="es-form-group">
              <label for="regPass">Password</label>
              <input type="password" id="regPass" class="es-input" placeholder="At least 6 characters" required>
            </div>
            <button type="submit" class="es-btn-primary">Create Account</button>
          </form>
        </div>

        <!-- CHECKOUT MODAL -->
        <div id="esCheckoutModal" class="es-modal-box" style="display: none;">
          <button class="es-modal-close" id="esCloseCheckout">&times;</button>
          <h3 style="margin-top:0;margin-bottom:16px;color:#00e5ff;">💳 Complete Your Order</h3>
          <form id="esCheckoutForm">
            <div class="es-form-group">
              <label for="orderName">Customer Name</label>
              <input type="text" id="orderName" class="es-input" required>
            </div>
            <div class="es-form-group">
              <label for="orderEmail">Email Address</label>
              <input type="email" id="orderEmail" class="es-input" required>
            </div>
            <div class="es-form-group">
              <label for="orderPhone">Phone Number</label>
              <input type="tel" id="orderPhone" class="es-input" placeholder="+92 300 1234567" required>
            </div>
            <div class="es-form-group">
              <label for="orderAddress">Delivery Address</label>
              <textarea id="orderAddress" class="es-input" placeholder="Street, House No., City" required></textarea>
            </div>
            <div class="es-form-group">
              <label for="orderPayment">Payment Method</label>
              <select id="orderPayment" class="es-input">
                <option value="Cash On Delivery">Cash On Delivery (COD)</option>
                <option value="Credit / Debit Card">Credit / Debit Card</option>
                <option value="JazzCash / Easypaisa">JazzCash / Easypaisa</option>
              </select>
            </div>
            <div style="background:#172440;padding:12px;border-radius:8px;margin-bottom:14px;">
              <div style="display:flex;justify-content:space-between;font-weight:700;">
                <span>Total Amount to Pay:</span>
                <span id="esCheckoutTotalVal" style="color:#00e5ff;">$0.00</span>
              </div>
            </div>
            <button type="submit" class="es-btn-primary">Confirm & Place Order</button>
          </form>
        </div>

        <!-- CONTACT MODAL -->
        <div id="esContactModal" class="es-modal-box" style="display: none;">
          <button class="es-modal-close" id="esCloseContact">&times;</button>
          <h3 style="margin-top:0;margin-bottom:10px;color:#00e5ff;">📞 Official Customer Care & Support</h3>
          <p style="color:#94a3b8;font-size:13px;margin-bottom:16px;">We are here to help! Reach out to our dedicated support team through any channel below.</p>
          
          <div class="es-contact-info-block" style="margin-bottom:16px;">
            <div style="margin-bottom:5px;"><strong>🏢 Official Brand:</strong> Tronmart Electronic Store Ltd.</div>
            <div style="margin-bottom:5px;"><strong>📍 Headquarters:</strong> Tronmart Plaza, 123 Fifth Avenue, Suite 800, New York, NY 10010</div>
            <div style="margin-bottom:5px;"><strong>📞 Toll-Free Helpline:</strong> +1 (800) 234-5678 &nbsp;|&nbsp; 1-800-TRONMART</div>
            <div style="margin-bottom:5px;"><strong>💬 WhatsApp Live:</strong> +1 (555) 234-5678 (Instant Assistance)</div>
            <div style="margin-bottom:5px;"><strong>✉️ Customer Support:</strong> <span style="color:#00e5ff;">support@electronicstore.com</span></div>
            <div style="margin-bottom:5px;"><strong>✉️ Orders & Billing:</strong> <span style="color:#00e5ff;">orders@electronicstore.com</span></div>
            <div><strong>🕒 Operating Hours:</strong> 24/7 Online Support (Live response within 15 mins)</div>
          </div>

          <form id="esContactForm">
            <div class="es-form-group">
              <label for="contactName">Your Name</label>
              <input type="text" id="contactName" class="es-input" placeholder="e.g. Ali Raza" required>
            </div>
            <div class="es-form-group">
              <label for="contactEmail">Your Email</label>
              <input type="email" id="contactEmail" class="es-input" placeholder="ali@example.com" required>
            </div>
            <div class="es-form-group">
              <label for="contactSubject">Subject</label>
              <input type="text" id="contactSubject" class="es-input" placeholder="e.g. Order Inquiry / Product Warranty" required>
            </div>
            <div class="es-form-group">
              <label for="contactMessage">Message</label>
              <textarea id="contactMessage" class="es-input" placeholder="How can we assist you today?" required></textarea>
            </div>
            <button type="submit" class="es-btn-primary">Send Message</button>
          </form>
        </div>

        <!-- TRACK ORDER MODAL -->
        <div id="esTrackModal" class="es-modal-box" style="display: none;">
          <button class="es-modal-close" id="esCloseTrack">&times;</button>
          <h3 style="margin-top:0;margin-bottom:10px;color:#00e5ff;">🚚 Track Your Order</h3>
          <p style="color:#94a3b8;font-size:13px;margin-bottom:16px;">Enter your Order ID (e.g. ORD-123456) received after checkout.</p>
          <form id="esTrackForm">
            <div class="es-form-group">
              <label for="trackOrderIdInput">Order Number</label>
              <input type="text" id="trackOrderIdInput" class="es-input" placeholder="e.g. ORD-123456" required>
            </div>
            <button type="submit" class="es-btn-primary">Track Order Status</button>
          </form>
          <div id="esTrackResultArea"></div>
        </div>

        <!-- POLICY MODAL (Shipping & Return) -->
        <div id="esPolicyModal" class="es-modal-box" style="display: none;">
          <button class="es-modal-close" id="esClosePolicy">&times;</button>
          <h3 style="margin-top:0;margin-bottom:12px;color:#00e5ff;">📦 Shipping & Return Policy</h3>
          <div class="es-faq-item">
            <div class="es-faq-question">🚀 Fast & Free Shipping</div>
            <div class="es-faq-answer">We offer free standard shipping on all orders over $80. Orders are processed within 24 hours and delivered within 2-4 business days.</div>
          </div>
          <div class="es-faq-item">
            <div class="es-faq-question">🔄 30-Day Hassle-Free Returns</div>
            <div class="es-faq-answer">Not satisfied with your item? Return it within 30 days in its original packaging for a full refund or direct exchange. No questions asked!</div>
          </div>
          <div class="es-faq-item">
            <div class="es-faq-question">🛡️ 1-Year Official Warranty</div>
            <div class="es-faq-answer">All electronics, TVs, home appliances, and gadgets include a 1-year manufacturer warranty covering repairs and replacements.</div>
          </div>
        </div>

        <!-- FAQ MODAL -->
        <div id="esFaqModal" class="es-modal-box" style="display: none;">
          <button class="es-modal-close" id="esCloseFaq">&times;</button>
          <h3 style="margin-top:0;margin-bottom:12px;color:#00e5ff;">❓ Frequently Asked Questions</h3>
          <div class="es-faq-item">
            <div class="es-faq-question">How do I place an order?</div>
            <div class="es-faq-answer">Simply browse any product, click "Add to Cart", open your shopping basket, and click "Proceed to Checkout" to enter your address.</div>
          </div>
          <div class="es-faq-item">
            <div class="es-faq-question">What payment methods do you accept?</div>
            <div class="es-faq-answer">We accept Cash On Delivery (COD), Credit/Debit cards, and Mobile Wallets (JazzCash & Easypaisa).</div>
          </div>
          <div class="es-faq-item">
            <div class="es-faq-question">Are all products 100% genuine?</div>
            <div class="es-faq-answer">Yes, all products in our store are 100% brand new, authentic, and sourced directly from certified manufacturers with full warranty.</div>
          </div>
        </div>

        <!-- ABOUT MODAL -->
        <div id="esAboutModal" class="es-modal-box" style="display: none;">
          <button class="es-modal-close" id="esCloseAbout">&times;</button>
          <h3 style="margin-top:0;margin-bottom:12px;color:#00e5ff;">🏢 About Electronic Store</h3>
          <p style="color:#cbd5e1;font-size:13.5px;line-height:1.6;">Welcome to <strong>Electronic Store</strong> — your trusted destination for cutting-edge technology, smart home devices, and premium home appliances.</p>
          <p style="color:#94a3b8;font-size:13px;line-height:1.6;">Founded with the mission of delivering reliable gadgets and electronics at unbeatable prices, we bring together high performance, trusted warranties, and dedicated 24/7 customer support.</p>
        </div>
      </div>
    `;

    document.body.appendChild(wrapper);
  }

  // ==========================================================
  // APPLICATION LOGIC
  // ==========================================================
  const App = {
    sortStateIndex: 0,
    sortModes: ['Default sorting', 'Price: Low to High', 'Price: High to Low', 'Name: A to Z'],

    init() {
      injectComponents();
      checkApiHealth();
      this.bindNavbarEvents();
      this.bindModalEvents();
      this.bindProductCardButtons();
      this.bindSearchAndFilters();
      this.bindNewsletter();
      this.bindContactTriggers();
      this.bindAllPageButtons();
      this.updateAuthUI();
      this.updateCartBadge();
      this.renderCartDrawer();
    },

    // 1. Navbar: Cart & Login buttons
    bindNavbarEvents() {
      // Basket / Cart click
      const baskets = document.querySelectorAll('.basket-logo, [href*="basket"], [data-action="open-cart"]');
      baskets.forEach(b => {
        b.addEventListener('click', (e) => {
          e.preventDefault();
          this.openCartDrawer();
        });
      });

      // Login / User button
      const loginBtns = document.querySelectorAll('.login-btn, #loginBtn, [data-action="open-login"]');
      loginBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const user = State.getUser();
          if (user) {
            this.toggleUserMenu(btn);
          } else {
            this.openAuthModal('login');
          }
        });
      });
    },

    toggleUserMenu(anchorEl) {
      let menu = document.getElementById('esUserDropdownMenu');
      if (!menu) {
        menu = document.createElement('div');
        menu.id = 'esUserDropdownMenu';
        menu.className = 'es-user-menu';
        menu.innerHTML = `
          <div style="padding:10px 16px;border-bottom:1px solid rgba(255,255,255,0.1);font-size:12px;color:#94a3b8;">
            Signed in as <strong id="esUserMenuName" style="color:#00e5ff;display:block;">User</strong>
          </div>
          <button type="button" id="esMenuTrackBtn">📦 My Orders</button>
          <button type="button" id="esLogoutBtn">🚪 Log Out</button>
        `;
        document.body.appendChild(menu);

        menu.querySelector('#esLogoutBtn').addEventListener('click', () => {
          State.setUser(null);
          menu.classList.remove('open');
          showToast('You have been logged out.', 'info');
        });

        menu.querySelector('#esMenuTrackBtn').addEventListener('click', () => {
          menu.classList.remove('open');
          this.openModal('esTrackModal');
        });

        document.addEventListener('click', (evt) => {
          if (!menu.contains(evt.target) && !anchorEl.contains(evt.target)) {
            menu.classList.remove('open');
          }
        });
      }

      const user = State.getUser();
      if (user) {
        menu.querySelector('#esUserMenuName').textContent = user.name;
      }

      const rect = anchorEl.getBoundingClientRect();
      menu.style.position = 'fixed';
      menu.style.top = `${rect.bottom + 8}px`;
      menu.style.right = `${window.innerWidth - rect.right}px`;
      menu.classList.toggle('open');
    },

    updateAuthUI() {
      const user = State.getUser();
      const loginBtns = document.querySelectorAll('.login-btn');
      loginBtns.forEach(btn => {
        if (user) {
          btn.innerHTML = `<span style="display:inline-flex;align-items:center;gap:5px;">👤 ${user.name.split(' ')[0]} ▾</span>`;
          btn.title = `Signed in as ${user.name} (${user.email})`;
        } else {
          btn.innerHTML = `<a href="#" style="color:inherit;text-decoration:none;">Log In</a>`;
          btn.title = 'Click to Sign In';
        }
      });
    },

    // 2. Modal Management
    openModal(modalId) {
      const overlay = document.getElementById('esModalOverlay');
      if (!overlay) return;
      ['esAuthModal', 'esCheckoutModal', 'esContactModal', 'esTrackModal', 'esPolicyModal', 'esFaqModal', 'esAboutModal'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = (id === modalId) ? 'block' : 'none';
      });
      overlay.classList.add('active');
    },

    closeModal() {
      const overlay = document.getElementById('esModalOverlay');
      if (overlay) overlay.classList.remove('active');
    },

    openAuthModal(tab = 'login') {
      this.openModal('esAuthModal');
      this.switchAuthTab(tab);
    },

    switchAuthTab(tab) {
      const loginTab = document.getElementById('esTabLogin');
      const regTab = document.getElementById('esTabRegister');
      const loginForm = document.getElementById('esLoginForm');
      const regForm = document.getElementById('esRegisterForm');

      if (tab === 'login') {
        loginTab.classList.add('active');
        regTab.classList.remove('active');
        loginForm.style.display = 'block';
        regForm.style.display = 'none';
      } else {
        regTab.classList.add('active');
        loginTab.classList.remove('active');
        regForm.style.display = 'block';
        loginForm.style.display = 'none';
      }
    },

    openCartDrawer() {
      const drawer = document.getElementById('esCartDrawer');
      if (drawer) drawer.classList.add('open');
      this.renderCartDrawer();
    },

    closeCartDrawer() {
      const drawer = document.getElementById('esCartDrawer');
      if (drawer) drawer.classList.remove('open');
    },

    // 3. Bind Modal Events
    bindModalEvents() {
      const overlay = document.getElementById('esModalOverlay');
      if (overlay) {
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) this.closeModal();
        });
      }

      ['esCloseAuth', 'esCloseCheckout', 'esCloseContact', 'esCloseTrack', 'esClosePolicy', 'esCloseFaq', 'esCloseAbout'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', () => this.closeModal());
      });

      const closeCart = document.getElementById('esCloseCart');
      if (closeCart) closeCart.addEventListener('click', () => this.closeCartDrawer());

      const loginTab = document.getElementById('esTabLogin');
      const regTab = document.getElementById('esTabRegister');
      if (loginTab) loginTab.addEventListener('click', () => this.switchAuthTab('login'));
      if (regTab) regTab.addEventListener('click', () => this.switchAuthTab('register'));

      const fillDemo = document.getElementById('esFillDemoBtn');
      if (fillDemo) {
        fillDemo.addEventListener('click', () => {
          document.getElementById('loginEmail').value = 'qasim@example.com';
          document.getElementById('loginPass').value = 'password123';
        });
      }

      // Login Form Submit
      const loginForm = document.getElementById('esLoginForm');
      if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const email = document.getElementById('loginEmail').value.trim();
          const password = document.getElementById('loginPass').value;

          try {
            if (isApiOnline) {
              const res = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.message || 'Login failed');
              State.setUser(data.user);
              showToast(`Welcome back, ${data.user.name}!`, 'success');
              this.closeModal();
              return;
            }
          } catch (apiErr) {
            console.warn('API error, falling back to local auth:', apiErr);
          }

          const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
          const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
          if (user) {
            State.setUser({ id: user.id, name: user.name, email: user.email });
            showToast(`Welcome back, ${user.name}!`, 'success');
            this.closeModal();
          } else {
            showToast('Invalid email or password. Please try again.', 'error');
          }
        });
      }

      // Register Form Submit
      const regForm = document.getElementById('esRegisterForm');
      if (regForm) {
        regForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const name = document.getElementById('regName').value.trim();
          const email = document.getElementById('regEmail').value.trim();
          const password = document.getElementById('regPass').value;

          try {
            if (isApiOnline) {
              const res = await fetch(`${API_BASE}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.message || 'Registration failed');
              State.setUser(data.user);
              showToast(`Account created! Welcome, ${data.user.name}!`, 'success');
              this.closeModal();
              return;
            }
          } catch (apiErr) {
            console.warn('API error, falling back to local registration:', apiErr);
          }

          const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
          if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
            showToast('An account with this email already exists.', 'error');
            return;
          }
          const newUser = { id: Date.now(), name, email, password };
          users.push(newUser);
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
          State.setUser({ id: newUser.id, name: newUser.name, email: newUser.email });
          showToast(`Account created! Welcome, ${newUser.name}!`, 'success');
          this.closeModal();
        });
      }

      // Proceed to Checkout button
      const proceedBtn = document.getElementById('esProceedCheckoutBtn');
      if (proceedBtn) {
        proceedBtn.addEventListener('click', () => {
          const cart = State.getCart();
          if (cart.length === 0) {
            showToast('Your cart is empty! Add products first.', 'error');
            return;
          }
          this.closeCartDrawer();
          this.openCheckoutModal();
        });
      }

      // Checkout Form Submit
      const checkoutForm = document.getElementById('esCheckoutForm');
      if (checkoutForm) {
        checkoutForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const cart = State.getCart();
          if (cart.length === 0) {
            showToast('Your cart is empty.', 'error');
            return;
          }

          const orderData = {
            customer: {
              name: document.getElementById('orderName').value.trim(),
              email: document.getElementById('orderEmail').value.trim(),
              phone: document.getElementById('orderPhone').value.trim()
            },
            address: document.getElementById('orderAddress').value.trim(),
            paymentMethod: document.getElementById('orderPayment').value,
            items: cart,
            total: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
          };

          try {
            if (isApiOnline) {
              const res = await fetch(`${API_BASE}/orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData)
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.message || 'Order failed');
              State.saveCart([]);
              this.closeModal();
              showToast(data.message || 'Order placed successfully!', 'success');
              return;
            }
          } catch (apiErr) {
            console.warn('API error, falling back to local order:', apiErr);
          }

          const orders = JSON.parse(localStorage.getItem(STORAGE_KEYS.ORDERS) || '[]');
          const newOrder = {
            orderId: 'ORD-' + Math.floor(100000 + Math.random() * 900000),
            ...orderData,
            status: 'Confirmed',
            createdAt: new Date().toISOString()
          };
          orders.push(newOrder);
          localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));

          State.saveCart([]);
          this.closeModal();
          showToast(`Order #${newOrder.orderId} placed successfully! Thank you for shopping with us.`, 'success');
        });
      }

      // Contact Form Submit
      const contactForm = document.getElementById('esContactForm');
      if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const payload = {
            name: document.getElementById('contactName').value.trim(),
            email: document.getElementById('contactEmail').value.trim(),
            subject: document.getElementById('contactSubject').value.trim(),
            message: document.getElementById('contactMessage').value.trim()
          };

          try {
            if (isApiOnline) {
              const res = await fetch(`${API_BASE}/contact`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.message || 'Contact message failed');
              showToast(data.message, 'success');
              this.closeModal();
              contactForm.reset();
              return;
            }
          } catch (apiErr) {
            console.warn('API contact error:', apiErr);
          }

          const msgs = JSON.parse(localStorage.getItem(STORAGE_KEYS.MESSAGES) || '[]');
          msgs.push({ id: Date.now(), ...payload, createdAt: new Date().toISOString() });
          localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(msgs));
          showToast('Thank you! Your message has been sent successfully.', 'success');
          this.closeModal();
          contactForm.reset();
        });
      }

      // Track Order Form Submit
      const trackForm = document.getElementById('esTrackForm');
      if (trackForm) {
        trackForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const idInput = document.getElementById('trackOrderIdInput').value.trim().toUpperCase();
          const resultArea = document.getElementById('esTrackResultArea');

          const orders = JSON.parse(localStorage.getItem(STORAGE_KEYS.ORDERS) || '[]');
          const order = orders.find(o => o.orderId && o.orderId.toUpperCase() === idInput);

          if (order) {
            resultArea.innerHTML = `
              <div class="es-track-result">
                <span class="es-track-badge">✓ ${order.status || 'Confirmed'}</span>
                <div><strong>Order ID:</strong> ${order.orderId}</div>
                <div><strong>Recipient:</strong> ${order.customer ? order.customer.name : 'Customer'}</div>
                <div><strong>Delivery Address:</strong> ${order.address || 'Standard Address'}</div>
                <div><strong>Estimated Delivery:</strong> 2-3 Business Days 🚚</div>
                <div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.1);">
                  <strong>Total:</strong> <span style="color:#00e5ff;font-weight:700;">$${order.total ? order.total.toFixed(2) : '0.00'}</span>
                </div>
              </div>
            `;
          } else {
            resultArea.innerHTML = `
              <div class="es-track-result" style="border-color:#ef4444;">
                <span style="color:#ef4444;font-weight:700;">Order Not Found</span>
                <p style="font-size:13px;color:#94a3b8;margin:6px 0 0 0;">No active order found with ID "${idInput}". Please verify your order ID or check your email confirmation.</p>
              </div>
            `;
          }
        });
      }
    },

    openCheckoutModal() {
      const cart = State.getCart();
      const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      document.getElementById('esCheckoutTotalVal').textContent = `$${total.toFixed(2)}`;

      const user = State.getUser();
      if (user) {
        const nameField = document.getElementById('orderName');
        const emailField = document.getElementById('orderEmail');
        if (nameField && !nameField.value) nameField.value = user.name;
        if (emailField && !emailField.value) emailField.value = user.email;
      }

      this.openModal('esCheckoutModal');
    },

    // 4. Cart Operations
    addToCart(product) {
      const cart = State.getCart();
      const existing = cart.find(item => item.id === product.id);

      if (existing) {
        existing.quantity += 1;
      } else {
        cart.push({
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.image,
          quantity: 1
        });
      }

      State.saveCart(cart);
      showToast(`🛒 "${product.name}" added to cart!`, 'success');
    },

    updateQuantity(productId, delta) {
      const cart = State.getCart();
      const item = cart.find(i => i.id === productId);
      if (!item) return;

      item.quantity += delta;
      if (item.quantity <= 0) {
        this.removeFromCart(productId);
        return;
      }

      State.saveCart(cart);
    },

    removeFromCart(productId) {
      let cart = State.getCart();
      cart = cart.filter(i => i.id !== productId);
      State.saveCart(cart);
      showToast('Item removed from cart', 'info');
    },

    updateCartBadge() {
      const cart = State.getCart();
      const totalCount = cart.reduce((sum, i) => sum + i.quantity, 0);

      const baskets = document.querySelectorAll('.basket-logo');
      baskets.forEach(basket => {
        let badge = basket.querySelector('.es-cart-badge');
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'es-cart-badge';
          basket.appendChild(badge);
        }
        badge.textContent = totalCount;
        badge.style.display = totalCount > 0 ? 'flex' : 'none';

        badge.classList.remove('bump');
        void badge.offsetWidth;
        badge.classList.add('bump');
      });
    },

    renderCartDrawer() {
      const list = document.getElementById('esCartItemsList');
      const subtotalEl = document.getElementById('esCartSubtotalVal');
      if (!list || !subtotalEl) return;

      const cart = State.getCart();
      if (cart.length === 0) {
        list.innerHTML = `
          <div class="es-cart-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.926-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
            </svg>
            <p>Your shopping cart is currently empty.</p>
          </div>
        `;
        subtotalEl.textContent = '$0.00';
        return;
      }

      let subtotal = 0;
      list.innerHTML = cart.map(item => {
        subtotal += item.price * item.quantity;
        return `
          <div class="es-cart-item">
            <img src="${item.image || 'photo/speaker.webp'}" alt="${item.name}" class="es-cart-thumb" onerror="this.src='photo/speaker.webp'">
            <div class="es-cart-info">
              <div class="es-cart-title" title="${item.name}">${item.name}</div>
              <div class="es-cart-item-price">$${item.price.toFixed(2)}</div>
              <div class="es-qty-controls">
                <button class="es-qty-btn es-btn-dec" data-id="${item.id}">-</button>
                <span class="es-qty-val">${item.quantity}</span>
                <button class="es-qty-btn es-btn-inc" data-id="${item.id}">+</button>
              </div>
            </div>
            <button class="es-cart-remove" data-id="${item.id}" title="Remove item">&times;</button>
          </div>
        `;
      }).join('');

      subtotalEl.textContent = `$${subtotal.toFixed(2)}`;

      list.querySelectorAll('.es-btn-dec').forEach(btn => {
        btn.addEventListener('click', () => this.updateQuantity(btn.dataset.id, -1));
      });
      list.querySelectorAll('.es-btn-inc').forEach(btn => {
        btn.addEventListener('click', () => this.updateQuantity(btn.dataset.id, 1));
      });
      list.querySelectorAll('.es-cart-remove').forEach(btn => {
        btn.addEventListener('click', () => this.removeFromCart(btn.dataset.id));
      });
    },

    // 5. Product Card Scanning & "Add to Cart" injection
    bindProductCardButtons() {
      const cardSelectors = [
        '.box', '.box2', '.card', '.product-card',
        '.small-box', '.arrival-box', '.deal-card',
        '.card-1', '.card-2', '.card-3', '.card-4', '.card-4-mobile', '.card-4-tablet',
        '.card-5', '.card-6', '.card-7', '.card-8', '.card-9', '.card-10', '.card-11', '.card-11-lcd', '.card-12',
        '.card-home1', '.card-home2', '.card-home3', '.card-home4', '.card-home5',
        '.card-conditoner1', '.card-conditoner2', '.card-conditoner3', '.card-conditoner3-ac', '.card-conditoner4',
        '.card-kitchen1', '.card-kitchen2', '.card-kitchen3', '.card-kitchen4',
        '.card-refrigerator1', '.card-refrigerator2', '.card-refrigerator3', '.card-refrigerator4', '.card-refrigerator4-frej',
        '.card-pc1', '.card-pc2', '.card-pc3', '.card-pc4',
        '.card-gadget1', '.card-gadget2', '.card-gadget3', '.card-gadget4'
      ];

      const cards = document.querySelectorAll(cardSelectors.join(','));

      cards.forEach((card, idx) => {
        if (card.querySelector('.es-btn-add')) return;

        const titleEl = card.querySelector('h1, h2, h3, h4, .title, p[class*="heading"], p:first-of-type');
        const priceEl = card.querySelector('.price, .dollar, [class*="price"], strong');
        const imgEl = card.querySelector('img');

        let title = titleEl ? titleEl.textContent.trim() : `Electronics Item #${idx + 1}`;
        title = title.replace(/\s+/g, ' ').substring(0, 50);

        let price = 49.99;
        if (priceEl) {
          const matches = priceEl.textContent.match(/\$?([0-9]+(?:\.[0-9]{2})?)/g);
          if (matches && matches.length > 0) {
            const nums = matches.map(m => parseFloat(m.replace('$', ''))).filter(n => !isNaN(n) && n > 0);
            if (nums.length > 0) price = Math.min(...nums);
          }
        }

        const image = imgEl ? (imgEl.getAttribute('src') || '') : 'photo/speaker.webp';
        const productId = 'prod_' + (card.className.split(' ')[0] || '') + '_' + (idx + 1);

        const addBtn = document.createElement('button');
        addBtn.className = 'es-btn-add';
        addBtn.innerHTML = `🛒 Add to Cart`;
        addBtn.dataset.id = productId;
        addBtn.dataset.name = title;
        addBtn.dataset.price = price;
        addBtn.dataset.image = image;

        addBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();

          this.addToCart({
            id: addBtn.dataset.id,
            name: addBtn.dataset.name,
            price: parseFloat(addBtn.dataset.price),
            image: addBtn.dataset.image
          });

          addBtn.classList.add('added');
          addBtn.textContent = '✓ Added!';
          setTimeout(() => {
            addBtn.classList.remove('added');
            addBtn.innerHTML = `🛒 Add to Cart`;
          }, 1400);
        });

        card.appendChild(addBtn);
      });
    },

    // 6. Live Search Bar & Price Range Slider
    bindSearchAndFilters() {
      const searchInputs = document.querySelectorAll('.search-space, input[type="search"], #search');
      searchInputs.forEach(input => {
        input.addEventListener('input', (e) => {
          const term = e.target.value.toLowerCase().trim();
          this.filterProducts(term);
        });

        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const term = e.target.value.toLowerCase().trim();
            this.filterProducts(term);
            const firstMatch = document.querySelector('[class*="card-"]:not([style*="display: none"])');
            if (firstMatch) {
              firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
        });
      });

      const rangeSliders = document.querySelectorAll('.range-line, input[type="range"]');
      rangeSliders.forEach(slider => {
        const label = document.querySelector('.range-h1, .price-range-label') || slider.nextElementSibling;
        
        slider.addEventListener('input', (e) => {
          const maxVal = parseFloat(e.target.value);
          if (label) {
            label.textContent = `$0 - $${maxVal}`;
          }
          this.filterByPrice(maxVal);
        });
      });
    },

    filterProducts(term) {
      const cards = document.querySelectorAll('[class*="card-"], .box, .box2');
      cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        if (!term || text.includes(term)) {
          card.style.display = '';
        } else {
          card.style.display = 'none';
        }
      });
    },

    filterByPrice(maxPrice) {
      const cards = document.querySelectorAll('[class*="card-"], .box, .box2');
      cards.forEach(card => {
        const btn = card.querySelector('.es-btn-add');
        if (btn && btn.dataset.price) {
          const p = parseFloat(btn.dataset.price);
          if (p <= maxPrice) {
            card.style.display = '';
          } else {
            card.style.display = 'none';
          }
        }
      });
    },

    // 7. Newsletter Subscriptions
    bindNewsletter() {
      const newsButtons = document.querySelectorAll('.subscribe-btn, button[class*="sub"]');
      newsButtons.forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          const parent = btn.closest('div, form') || document;
          const input = parent.querySelector('input[type="email"], input[type="text"], .mail-form');
          const email = input ? input.value.trim() : '';

          if (!email || !email.includes('@')) {
            showToast('Please enter a valid email address.', 'error');
            return;
          }

          try {
            if (isApiOnline) {
              const res = await fetch(`${API_BASE}/subscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
              });
              const data = await res.json();
              showToast(data.message || 'Subscribed successfully!', 'success');
              if (input) input.value = '';
              return;
            }
          } catch (err) {
            console.warn('Newsletter API error:', err);
          }

          showToast('🎉 Thank you for subscribing to our newsletter!', 'success');
          if (input) input.value = '';
        });
      });
    },

    // 8. Contact Triggers
    bindContactTriggers() {
      const contactElements = document.querySelectorAll('.advice, .custom, .question, .contact-box');
      contactElements.forEach(el => {
        el.addEventListener('click', (e) => {
          e.preventDefault();
          this.openModal('esContactModal');
        });
      });
    },

    // 9. All Other Interactive Buttons & Controls
    bindAllPageButtons() {
      // Top nav items
      const topLeft = document.querySelector('.top-nav .top-left');
      if (topLeft) {
        topLeft.addEventListener('click', () => this.openModal('esContactModal'));
      }

      const topRight = document.querySelector('.top-nav .top-right');
      if (topRight) {
        topRight.addEventListener('click', (e) => {
          const text = e.target.textContent || '';
          if (text.toLowerCase().includes('track')) {
            this.openModal('esTrackModal');
          } else {
            this.openModal('esPolicyModal');
          }
        });
      }

      // Shop Now Buttons
      document.querySelectorAll('.shop-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const cardSection = document.querySelector('.card-line-1, .card-line-4, [class*="card-line"]');
          if (cardSection) {
            cardSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {
            window.location.href = 'DEAL.HTML';
          }
        });
      });

      const shopHeadphone = document.querySelector('.shop-headphone');
      if (shopHeadphone) {
        shopHeadphone.addEventListener('click', () => window.location.href = 'audio.html');
      }

      const shopGrooming = document.querySelector('.shop-groming');
      if (shopGrooming) {
        shopGrooming.addEventListener('click', () => {
          const card1 = document.querySelector('.card-1');
          if (card1) card1.scrollIntoView({ behavior: 'smooth', block: 'center' });
          else window.location.href = 'DEAL.HTML';
        });
      }

      const shopGames = document.querySelector('.shop-games');
      if (shopGames) {
        shopGames.addEventListener('click', () => window.location.href = 'arrival.html');
      }

      const saveShopBtn = document.querySelector('.save-shop-btn');
      if (saveShopBtn) {
        saveShopBtn.addEventListener('click', () => window.location.href = 'DEAL.HTML');
      }

      // See More Buttons
      document.querySelectorAll('.see-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const parentText = btn.parentElement ? btn.parentElement.textContent.toLowerCase() : '';
          if (parentText.includes('applience') || parentText.includes('appliances')) {
            window.location.href = 'applience.html';
          } else if (parentText.includes('refrigerator')) {
            window.location.href = 'refrigerator.html';
          } else if (parentText.includes('laptop') || parentText.includes('pc')) {
            window.location.href = 'arrival.html';
          } else if (parentText.includes('conditioner')) {
            const acCards = document.querySelector('.card-line-5');
            if (acCards) acCards.scrollIntoView({ behavior: 'smooth', block: 'center' });
            else window.location.href = 'applience.html';
          } else {
            window.location.href = 'arrival.html';
          }
        });
      });

      // Category Buttons & Tiles on home.html
      const catBindings = [
        { selector: '.air-btn, .air', target: '.air-conditoner-container', fallbackUrl: 'applience.html' },
        { selector: '.audio-btn, .audio', fallbackUrl: 'audio.html' },
        { selector: '.gad-btn, .gadgates', target: '.gadget-container', fallbackUrl: 'arrival.html' },
        { selector: '.home-btn, .home', fallbackUrl: 'applience.html' },
        { selector: '.kitchen-btn, .kitchen', target: '.kitchen-container', fallbackUrl: 'applience.html' },
        { selector: '.laptop-btn, .laptop', target: '.pc-container', fallbackUrl: 'arrival.html' },
        { selector: '.refri-btn, .refri', fallbackUrl: 'refrigerator.html' },
        { selector: '.smart-btn, .smart', fallbackUrl: 'applience.html' }
      ];

      catBindings.forEach(binding => {
        document.querySelectorAll(binding.selector).forEach(el => {
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            if (binding.target) {
              const targetEl = document.querySelector(binding.target);
              if (targetEl) {
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                return;
              }
            }
            if (binding.fallbackUrl) {
              window.location.href = binding.fallbackUrl;
            }
          });
        });
      });

      // Sale badge buttons
      document.querySelectorAll('.sale-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          showToast('🏷️ On Sale! Extra discounts applied to this item today.', 'info');
        });
      });

      // Default Sorting Button (.defult-btn)
      const defultSortBtn = document.querySelector('.defult-btn');
      if (defultSortBtn) {
        defultSortBtn.addEventListener('click', () => {
          this.sortStateIndex = (this.sortStateIndex + 1) % this.sortModes.length;
          const currentMode = this.sortModes[this.sortStateIndex];
          defultSortBtn.textContent = currentMode;
          this.applyProductSorting(this.sortStateIndex);
          showToast(`Sorted by: ${currentMode}`, 'info');
        });
      }

      // Footer Links
      document.querySelectorAll('.need-box p, .shop-deal-box p').forEach(p => {
        const text = p.textContent.toLowerCase().trim();
        p.addEventListener('click', () => {
          if (text.includes('about')) {
            this.openModal('esAboutModal');
          } else if (text.includes('contact')) {
            this.openModal('esContactModal');
          } else if (text.includes('track')) {
            this.openModal('esTrackModal');
          } else if (text.includes('faq')) {
            this.openModal('esFaqModal');
          } else if (text.includes('return') || text.includes('privacy')) {
            this.openModal('esPolicyModal');
          } else if (text.includes('hot') || text.includes('weekly') || text.includes('deal')) {
            window.location.href = 'DEAL.HTML';
          } else if (text.includes('categor') || text.includes('brand') || text.includes('rebat')) {
            window.location.href = 'arrival.html';
          }
        });
      });
    },

    applyProductSorting(modeIndex) {
      const container = document.querySelector('.card-line-1, .card-line-4, .card-line-kitchen') || document.querySelector('.home-appplience-container');
      if (!container) return;

      const cards = Array.from(document.querySelectorAll('[class*="card-home"], [class*="card-1"], [class*="card-2"], [class*="card-3"], [class*="card-4"], [class*="card-5"], [class*="card-pc"], [class*="card-refrigerator"]'));
      if (!cards.length) return;

      cards.sort((a, b) => {
        const priceA = parseFloat(a.querySelector('.es-btn-add')?.dataset?.price || '0');
        const priceB = parseFloat(b.querySelector('.es-btn-add')?.dataset?.price || '0');
        const nameA = (a.querySelector('p[class*="heading"]')?.textContent || '').trim();
        const nameB = (b.querySelector('p[class*="heading"]')?.textContent || '').trim();

        if (modeIndex === 1) return priceA - priceB; // Low to High
        if (modeIndex === 2) return priceB - priceA; // High to Low
        if (modeIndex === 3) return nameA.localeCompare(nameB); // Name A-Z
        return 0;
      });

      cards.forEach(card => card.parentElement && card.parentElement.appendChild(card));
    }
  };

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
  } else {
    App.init();
  }

  // Expose App to window
  window.ElectronicStore = App;
})();
