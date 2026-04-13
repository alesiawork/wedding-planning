(function () {
  'use strict';

  const CATEGORY_COLORS = {
    Venue: '#7a9e7a', Catering: '#d4a0a0', Photography: '#6b9e6b',
    Flowers: '#c9a0c4', Music: '#7aaec9', Attire: '#d4a0a0',
    Stationery: '#a3c4a3', Decor: '#c9b896', Transportation: '#7bc4b8',
    Videography: '#8aaa8a', Florist: '#c9a0c4', 'DJ / Band': '#7aaec9',
    Baker: '#d4a0a0', 'Hair & Makeup': '#c4a0b8', Officiant: '#7a9e7a',
    Rentals: '#7bc4b8', Planner: '#a3c4a3', Other: '#8a8a86',
  };

  // ─── Firebase Cloud Sync ─────────────────
  let firebaseRef = null;
  let lastSaveTimestamp = 0;

  try {
    const firebaseConfig = {
      apiKey: "AIzaSyAMkHZgvWGnwdS32izKq0WwyKXlsi89va4",
      authDomain: "wedding-planning-b7755.firebaseapp.com",
      databaseURL: "https://wedding-planning-b7755-default-rtdb.firebaseio.com",
      projectId: "wedding-planning-b7755",
      storageBucket: "wedding-planning-b7755.firebasestorage.app",
      messagingSenderId: "576327502141",
      appId: "1:576327502141:web:9884f6a57b56a0d7d45d54"
    };

    if (firebaseConfig.apiKey !== "REPLACE_ME" && typeof firebase !== 'undefined') {
      firebase.initializeApp(firebaseConfig);
      firebaseRef = firebase.database().ref('wedding-planner');
    }
  } catch (e) {
    console.warn('Firebase sync not available:', e.message);
  }

  // ─── State ───────────────────────────────
  let state = loadState();

  function defaultState() {
    return {
      totalBudget: 0,
      weddingDate: '',
      expenses: [],
      vendors: [],
      todos: [],
      guests: [],
      tables: [],
      timelineEvents: [],
      notes: [],
      venues: [],
    };
  }

  function ensureArray(val) {
    if (Array.isArray(val)) return val;
    if (val && typeof val === 'object') return Object.values(val);
    return [];
  }

  function normalizeState(s) {
    s.expenses = ensureArray(s.expenses);
    s.vendors = ensureArray(s.vendors);
    s.todos = ensureArray(s.todos);
    s.guests = ensureArray(s.guests);
    s.tables = ensureArray(s.tables).map(t => ({
      ...t,
      guestIds: ensureArray(t.guestIds),
    }));
    s.timelineEvents = ensureArray(s.timelineEvents);
    s.notes = ensureArray(s.notes);
    s.venues = ensureArray(s.venues);
    return s;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem('wedding-planner-state');
      if (raw) {
        const s = JSON.parse(raw);
        return normalizeState(Object.assign(defaultState(), s));
      }
    } catch (_) {}
    return defaultState();
  }

  function saveState() {
    localStorage.setItem('wedding-planner-state', JSON.stringify(state));
    if (firebaseRef) {
      lastSaveTimestamp = Date.now();
      firebaseRef.set(state);
    }
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function fmt(n) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
  }

  function fmtFull(n) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  }

  function fmtDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function fmtTime(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeAttr(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ─── Navigation ──────────────────────────
  const navBtns = document.querySelectorAll('.nav-btn');
  const sections = document.querySelectorAll('.section');

  navBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.section;
      navBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      sections.forEach((s) => {
        s.classList.remove('active');
        if (s.id === target) s.classList.add('active');
      });
      if (target === 'dashboard') renderDashboard();
      if (target === 'seating') renderSeating();
    });
  });

  // ═══════════════════════════════════════════
  // COUNTDOWN
  // ═══════════════════════════════════════════
  const weddingDateInput = document.getElementById('wedding-date-input');
  const setDateBtn = document.getElementById('set-date-btn');
  const countdownDisplay = document.getElementById('countdown-display');
  const countdownMessage = document.getElementById('countdown-message');
  let countdownInterval = null;

  setDateBtn.addEventListener('click', () => {
    state.weddingDate = weddingDateInput.value;
    saveState();
    startCountdown();
  });

  function startCountdown() {
    if (countdownInterval) clearInterval(countdownInterval);
    if (!state.weddingDate) {
      countdownDisplay.style.display = 'none';
      countdownMessage.textContent = '';
      return;
    }

    weddingDateInput.value = state.weddingDate;
    countdownDisplay.style.display = 'flex';

    function tick() {
      const now = new Date();
      const wedding = new Date(state.weddingDate + 'T00:00:00');
      const diff = wedding - now;

      if (diff <= 0) {
        countdownDisplay.style.display = 'none';
        countdownMessage.textContent = 'Congratulations on your wedding day!';
        clearInterval(countdownInterval);
        return;
      }

      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);

      document.getElementById('cd-days').textContent = days;
      document.getElementById('cd-hours').textContent = hours.toString().padStart(2, '0');
      document.getElementById('cd-mins').textContent = mins.toString().padStart(2, '0');
      document.getElementById('cd-secs').textContent = secs.toString().padStart(2, '0');
      countdownMessage.textContent = '';
    }

    tick();
    countdownInterval = setInterval(tick, 1000);
  }

  // ═══════════════════════════════════════════
  // BUDGET
  // ═══════════════════════════════════════════
  const totalBudgetInput = document.getElementById('total-budget-input');
  const setBudgetBtn = document.getElementById('set-budget-btn');
  const expenseForm = document.getElementById('expense-form');
  const filterCategory = document.getElementById('filter-category');

  setBudgetBtn.addEventListener('click', () => {
    const val = parseFloat(totalBudgetInput.value);
    if (!isNaN(val) && val >= 0) {
      state.totalBudget = val;
      saveState();
      renderBudget();
    }
  });

  totalBudgetInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); setBudgetBtn.click(); }
  });

  expenseForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const expense = {
      id: uid(),
      name: document.getElementById('expense-name').value.trim(),
      category: document.getElementById('expense-category').value,
      amount: parseFloat(document.getElementById('expense-amount').value) || 0,
      date: document.getElementById('expense-date').value,
      status: document.getElementById('expense-status').value,
    };
    if (!expense.name) return;
    state.expenses.push(expense);
    saveState();
    expenseForm.reset();
    renderBudget();
  });

  filterCategory.addEventListener('change', renderExpensesTable);

  function getTotalSpent() {
    return state.expenses.reduce((sum, e) => sum + e.amount, 0);
  }

  function renderBudget() {
    const spent = getTotalSpent();
    const remaining = state.totalBudget - spent;
    document.getElementById('budget-total-display').textContent = fmt(state.totalBudget);
    document.getElementById('budget-spent-display').textContent = fmt(spent);
    document.getElementById('budget-remaining-display').textContent = fmt(remaining);
    document.querySelector('.pill-remaining').classList.toggle('over', remaining < 0);
    if (state.totalBudget > 0) totalBudgetInput.value = state.totalBudget;
    renderExpensesTable();
  }

  function renderExpensesTable() {
    const tbody = document.getElementById('expenses-body');
    const emptyMsg = document.getElementById('expenses-empty');
    const filter = filterCategory.value;
    let expenses = state.expenses;
    if (filter !== 'all') expenses = expenses.filter((e) => e.category === filter);

    if (expenses.length === 0) {
      tbody.innerHTML = '';
      emptyMsg.style.display = 'block';
      return;
    }
    emptyMsg.style.display = 'none';
    tbody.innerHTML = expenses.map((e) => `
      <tr>
        <td>${escapeHtml(e.name)}</td>
        <td>${escapeHtml(e.category)}</td>
        <td>${fmtFull(e.amount)}</td>
        <td>${fmtDate(e.date)}</td>
        <td><span class="status-badge ${e.status}">${e.status === 'deposit' ? 'Deposit Paid' : e.status}</span></td>
        <td>
          <button class="btn-icon" onclick="app.editExpense('${e.id}')" title="Edit">✏️</button>
          <button class="btn-icon" onclick="app.deleteExpense('${e.id}')" title="Delete">🗑️</button>
        </td>
      </tr>
    `).join('');
  }

  function deleteExpense(id) {
    state.expenses = state.expenses.filter((e) => e.id !== id);
    saveState();
    renderBudget();
  }

  function editExpense(id) {
    const expense = state.expenses.find((e) => e.id === id);
    if (!expense) return;
    openModal('Edit Expense', `
      <div class="form-group"><label>Name</label><input type="text" id="edit-expense-name" value="${escapeAttr(expense.name)}"></div>
      <div class="form-group"><label>Category</label><select id="edit-expense-category">
        ${['Venue','Catering','Photography','Flowers','Music','Attire','Stationery','Decor','Transportation','Other']
          .map(c => `<option value="${c}" ${c === expense.category ? 'selected' : ''}>${c}</option>`).join('')}
      </select></div>
      <div class="form-group"><label>Amount</label><input type="number" id="edit-expense-amount" value="${expense.amount}" min="0" step="0.01"></div>
      <div class="form-group"><label>Date</label><input type="date" id="edit-expense-date" value="${expense.date || ''}"></div>
      <div class="form-group"><label>Status</label><select id="edit-expense-status">
        <option value="estimated" ${expense.status === 'estimated' ? 'selected' : ''}>Estimated</option>
        <option value="paid" ${expense.status === 'paid' ? 'selected' : ''}>Paid</option>
        <option value="deposit" ${expense.status === 'deposit' ? 'selected' : ''}>Deposit Paid</option>
      </select></div>
    `, () => {
      expense.name = document.getElementById('edit-expense-name').value.trim();
      expense.category = document.getElementById('edit-expense-category').value;
      expense.amount = parseFloat(document.getElementById('edit-expense-amount').value) || 0;
      expense.date = document.getElementById('edit-expense-date').value;
      expense.status = document.getElementById('edit-expense-status').value;
      saveState();
      renderBudget();
    });
  }

  // ═══════════════════════════════════════════
  // GUESTS
  // ═══════════════════════════════════════════
  const guestForm = document.getElementById('guest-form');
  const filterRsvp = document.getElementById('filter-rsvp');
  const filterParty = document.getElementById('filter-party');
  const guestPlusOneSelect = document.getElementById('guest-plusone');
  const guestPartnerSelect = document.getElementById('guest-partner');

  function getAvailablePartners(excludeId) {
    return state.guests.filter(g => g.id !== excludeId && g.plusOne !== 'partner');
  }

  function populatePartnerSelect(selectEl, excludeId, selectedId) {
    const available = getAvailablePartners(excludeId);
    selectEl.innerHTML = '<option value="">Select partner...</option>' +
      available.map(g => `<option value="${g.id}" ${g.id === selectedId ? 'selected' : ''}>${escapeHtml(g.name)}</option>`).join('');
  }

  guestPlusOneSelect.addEventListener('change', () => {
    if (guestPlusOneSelect.value === 'partner') {
      populatePartnerSelect(guestPartnerSelect, null, '');
      guestPartnerSelect.style.display = '';
    } else {
      guestPartnerSelect.style.display = 'none';
    }
  });

  function linkPartner(guestId, partnerId) {
    const partner = state.guests.find(g => g.id === partnerId);
    if (partner) {
      partner.plusOne = 'partner';
      partner.partnerId = guestId;
    }
  }

  function unlinkPartner(guestId) {
    const oldPartner = state.guests.find(g => g.partnerId === guestId);
    if (oldPartner) {
      oldPartner.plusOne = 'no';
      oldPartner.partnerId = '';
    }
  }

  guestForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const guest = {
      id: uid(),
      name: document.getElementById('guest-name').value.trim(),
      email: document.getElementById('guest-email').value.trim(),
      phone: document.getElementById('guest-phone').value.trim(),
      party: document.getElementById('guest-party').value,
      plusOne: document.getElementById('guest-plusone').value,
      rsvp: document.getElementById('guest-rsvp').value,
      meal: document.getElementById('guest-meal').value,
      dietary: document.getElementById('guest-dietary').value.trim(),
      tableId: '',
      partnerId: '',
    };
    if (!guest.name) return;

    if (guest.plusOne === 'partner') {
      const partnerId = guestPartnerSelect.value;
      if (partnerId) {
        guest.partnerId = partnerId;
        linkPartner(guest.id, partnerId);
      } else {
        guest.plusOne = 'no';
      }
    }

    state.guests.push(guest);
    saveState();
    guestForm.reset();
    guestPartnerSelect.style.display = 'none';
    renderGuests();
  });

  filterRsvp.addEventListener('change', renderGuestTable);
  filterParty.addEventListener('change', renderGuestTable);

  function renderGuests() {
    const total = state.guests.length;
    const confirmed = state.guests.filter(g => g.rsvp === 'confirmed').length;
    const declined = state.guests.filter(g => g.rsvp === 'declined').length;
    const pending = state.guests.filter(g => g.rsvp === 'pending').length;
    const attending = state.guests.reduce((sum, g) => {
      if (g.rsvp === 'confirmed') return sum + 1 + (g.plusOne === 'yes' ? 1 : 0);
      return sum;
    }, 0);

    document.getElementById('guest-total').textContent = total;
    document.getElementById('guest-confirmed').textContent = confirmed;
    document.getElementById('guest-declined').textContent = declined;
    document.getElementById('guest-pending').textContent = pending;
    document.getElementById('guest-attending').textContent = attending;
    renderGuestTable();
  }

  function renderGuestTable() {
    const tbody = document.getElementById('guests-body');
    const emptyMsg = document.getElementById('guests-empty');
    const rsvpFilter = filterRsvp.value;
    const partyFilter = filterParty.value;

    let guests = state.guests;
    if (rsvpFilter !== 'all') guests = guests.filter(g => g.rsvp === rsvpFilter);
    if (partyFilter !== 'all') guests = guests.filter(g => g.party === partyFilter);

    if (guests.length === 0) {
      tbody.innerHTML = '';
      emptyMsg.style.display = 'block';
      return;
    }
    emptyMsg.style.display = 'none';

    const partyLabels = { bride: "Bride's", groom: "Groom's", both: 'Both' };

    tbody.innerHTML = guests.map((g) => {
      let plusOneDisplay = 'No';
      if (g.plusOne === 'partner' && g.partnerId) {
        const partner = state.guests.find(p => p.id === g.partnerId);
        plusOneDisplay = partner ? escapeHtml(partner.name) : 'Partner';
      } else if (g.plusOne === 'yes') {
        plusOneDisplay = 'Yes (+1)';
      }

      return `
        <tr>
          <td><strong>${escapeHtml(g.name)}</strong>${g.email ? '<br><span style="font-size:0.78rem;color:var(--color-text-muted)">' + escapeHtml(g.email) + '</span>' : ''}</td>
          <td>${partyLabels[g.party] || g.party}</td>
          <td><span class="status-badge ${g.rsvp}">${g.rsvp}</span></td>
          <td>${g.plusOne === 'partner' ? '<span style="color:var(--color-primary);font-weight:500">' + plusOneDisplay + '</span>' : plusOneDisplay}</td>
          <td>${g.meal ? escapeHtml(g.meal) : '—'}</td>
          <td>${g.dietary ? escapeHtml(g.dietary) : '—'}</td>
          <td>
            <button class="btn-icon" onclick="app.editGuest('${g.id}')" title="Edit">✏️</button>
            <button class="btn-icon" onclick="app.deleteGuest('${g.id}')" title="Delete">🗑️</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function deleteGuest(id) {
    unlinkPartner(id);
    state.guests = state.guests.filter(g => g.id !== id);
    state.tables.forEach(t => { t.guestIds = t.guestIds.filter(gid => gid !== id); });
    saveState();
    renderGuests();
  }

  function editGuest(id) {
    const g = state.guests.find(g => g.id === id);
    if (!g) return;

    const availablePartners = getAvailablePartners(id);
    const partnerOptions = availablePartners.map(p =>
      `<option value="${p.id}" ${p.id === g.partnerId ? 'selected' : ''}>${escapeHtml(p.name)}</option>`
    ).join('');

    openModal('Edit Guest', `
      <div class="form-group"><label>Name</label><input type="text" id="edit-guest-name" value="${escapeAttr(g.name)}"></div>
      <div class="form-group"><label>Email</label><input type="email" id="edit-guest-email" value="${escapeAttr(g.email)}"></div>
      <div class="form-group"><label>Phone</label><input type="tel" id="edit-guest-phone" value="${escapeAttr(g.phone)}"></div>
      <div class="form-group"><label>Party</label><select id="edit-guest-party">
        <option value="bride" ${g.party === 'bride' ? 'selected' : ''}>Bride's Side</option>
        <option value="groom" ${g.party === 'groom' ? 'selected' : ''}>Groom's Side</option>
        <option value="both" ${g.party === 'both' ? 'selected' : ''}>Both</option>
      </select></div>
      <div class="form-group"><label>Plus-One / Partner</label><select id="edit-guest-plusone">
        <option value="no" ${g.plusOne === 'no' ? 'selected' : ''}>No Plus-One</option>
        <option value="yes" ${g.plusOne === 'yes' ? 'selected' : ''}>Plus-One Invited</option>
        <option value="partner" ${g.plusOne === 'partner' ? 'selected' : ''}>Partner / Spouse</option>
      </select></div>
      <div class="form-group" id="edit-partner-group" style="${g.plusOne === 'partner' ? '' : 'display:none'}"><label>Linked Partner</label><select id="edit-guest-partner">
        <option value="">Select partner...</option>
        ${partnerOptions}
      </select></div>
      <div class="form-group"><label>RSVP</label><select id="edit-guest-rsvp">
        <option value="pending" ${g.rsvp === 'pending' ? 'selected' : ''}>Pending</option>
        <option value="confirmed" ${g.rsvp === 'confirmed' ? 'selected' : ''}>Confirmed</option>
        <option value="declined" ${g.rsvp === 'declined' ? 'selected' : ''}>Declined</option>
      </select></div>
      <div class="form-group"><label>Meal</label><select id="edit-guest-meal">
        <option value="" ${!g.meal ? 'selected' : ''}>No Preference</option>
        <option value="chicken" ${g.meal === 'chicken' ? 'selected' : ''}>Chicken</option>
        <option value="beef" ${g.meal === 'beef' ? 'selected' : ''}>Beef</option>
        <option value="fish" ${g.meal === 'fish' ? 'selected' : ''}>Fish</option>
        <option value="vegetarian" ${g.meal === 'vegetarian' ? 'selected' : ''}>Vegetarian</option>
        <option value="vegan" ${g.meal === 'vegan' ? 'selected' : ''}>Vegan</option>
      </select></div>
      <div class="form-group"><label>Dietary Restrictions</label><input type="text" id="edit-guest-dietary" value="${escapeAttr(g.dietary)}"></div>
    `, () => {
      const oldPlusOne = g.plusOne;
      const newPlusOne = document.getElementById('edit-guest-plusone').value;

      if (oldPlusOne === 'partner' && newPlusOne !== 'partner') {
        unlinkPartner(id);
        g.partnerId = '';
      }

      g.name = document.getElementById('edit-guest-name').value.trim();
      g.email = document.getElementById('edit-guest-email').value.trim();
      g.phone = document.getElementById('edit-guest-phone').value.trim();
      g.party = document.getElementById('edit-guest-party').value;
      g.plusOne = newPlusOne;
      g.rsvp = document.getElementById('edit-guest-rsvp').value;
      g.meal = document.getElementById('edit-guest-meal').value;
      g.dietary = document.getElementById('edit-guest-dietary').value.trim();

      if (newPlusOne === 'partner') {
        const newPartnerId = document.getElementById('edit-guest-partner').value;
        if (newPartnerId) {
          if (g.partnerId && g.partnerId !== newPartnerId) {
            unlinkPartner(id);
          }
          g.partnerId = newPartnerId;
          linkPartner(id, newPartnerId);
        } else {
          g.plusOne = 'no';
          g.partnerId = '';
        }
      }

      saveState();
      renderGuests();
    });

    setTimeout(() => {
      const editPlusOne = document.getElementById('edit-guest-plusone');
      const editPartnerGroup = document.getElementById('edit-partner-group');
      if (editPlusOne && editPartnerGroup) {
        editPlusOne.addEventListener('change', () => {
          editPartnerGroup.style.display = editPlusOne.value === 'partner' ? '' : 'none';
        });
      }
    }, 50);
  }

  // ═══════════════════════════════════════════
  // VENUES & VENDOR RESEARCH
  // ═══════════════════════════════════════════
  const venueForm = document.getElementById('venue-form');
  const venueFilterBtns = document.querySelectorAll('[data-venue-filter]');
  let venueFilter = 'all';

  venueForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const venue = {
      id: uid(),
      name: document.getElementById('venue-name').value.trim(),
      type: document.getElementById('venue-type').value,
      location: document.getElementById('venue-location').value.trim(),
      capacity: parseInt(document.getElementById('venue-capacity').value, 10) || 0,
      costLow: parseFloat(document.getElementById('venue-cost-low').value) || 0,
      costHigh: parseFloat(document.getElementById('venue-cost-high').value) || 0,
      setting: document.getElementById('venue-setting').value,
      catering: document.getElementById('venue-catering').value,
      website: document.getElementById('venue-website').value.trim(),
      phone: document.getElementById('venue-phone').value.trim(),
      contact: document.getElementById('venue-contact').value.trim(),
      availability: document.getElementById('venue-avail').value,
      rating: parseInt(document.getElementById('venue-rating').value, 10) || 0,
      status: document.getElementById('venue-status').value,
      pros: document.getElementById('venue-pros').value.trim(),
      cons: document.getElementById('venue-cons').value.trim(),
      notes: document.getElementById('venue-notes').value.trim(),
    };
    if (!venue.name) return;
    state.venues.push(venue);
    saveState();
    venueForm.reset();
    renderVenues();
  });

  venueFilterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      venueFilterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      venueFilter = btn.dataset.venueFilter;
      renderVenues();
    });
  });

  function renderStars(rating) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
      html += i <= rating ? '★' : '<span class="empty-star">★</span>';
    }
    return html;
  }

  function renderVenues() {
    const grid = document.getElementById('venue-grid');
    const emptyMsg = document.getElementById('venues-empty');

    let venues = state.venues || [];
    if (venueFilter === 'Venue') {
      venues = venues.filter(v => v.type === 'Venue');
    } else if (venueFilter === 'vendor') {
      venues = venues.filter(v => v.type !== 'Venue');
    } else if (venueFilter === 'favorite') {
      venues = venues.filter(v => v.status === 'favorite');
    }

    if (venues.length === 0) {
      grid.innerHTML = '';
      grid.appendChild(emptyMsg);
      emptyMsg.style.display = 'block';
      return;
    }
    emptyMsg.style.display = 'none';

    const statusOrder = { favorite: 0, booked: 1, toured: 2, researching: 3, passed: 4 };
    venues = [...venues].sort((a, b) => (statusOrder[a.status] ?? 5) - (statusOrder[b.status] ?? 5));

    const settingLabels = { indoor: 'Indoor', outdoor: 'Outdoor', both: 'Indoor & Outdoor' };
    const cateringLabels = { included: 'Catering Included', preferred: 'Preferred Vendors', byob: 'Bring Your Own', na: 'N/A' };

    grid.innerHTML = venues.map((v) => {
      const costRange = v.costLow || v.costHigh
        ? (v.costLow && v.costHigh && v.costLow !== v.costHigh
          ? `${fmt(v.costLow)} – ${fmt(v.costHigh)}`
          : fmt(v.costHigh || v.costLow))
        : '';

      const prosArr = v.pros ? v.pros.split(',').map(s => s.trim()).filter(Boolean) : [];
      const consArr = v.cons ? v.cons.split(',').map(s => s.trim()).filter(Boolean) : [];

      const cardClass = v.status === 'favorite' ? 'is-favorite' : v.status === 'booked' ? 'is-booked' : '';

      return `
        <div class="venue-card ${cardClass}">
          <div class="venue-card-header">
            <h4>${escapeHtml(v.name)}</h4>
            <span class="venue-card-type">${escapeHtml(v.type)}</span>
          </div>

          <div class="venue-card-stats">
            ${v.capacity ? `<div class="venue-stat">👥 <strong>${v.capacity}</strong> guests</div>` : ''}
            ${costRange ? `<div class="venue-stat">💰 <strong>${costRange}</strong></div>` : ''}
            ${v.setting ? `<div class="venue-stat">${v.setting === 'outdoor' ? '🌿' : v.setting === 'indoor' ? '🏛' : '🏛🌿'} ${settingLabels[v.setting] || ''}</div>` : ''}
            ${v.catering ? `<div class="venue-stat">🍽 ${cateringLabels[v.catering] || ''}</div>` : ''}
          </div>

          <div class="venue-card-details">
            ${v.location ? `<span>📍 ${escapeHtml(v.location)}</span>` : ''}
            ${v.contact ? `<span>👤 ${escapeHtml(v.contact)}${v.phone ? ' — ' + escapeHtml(v.phone) : ''}</span>` : (v.phone ? `<span>📞 ${escapeHtml(v.phone)}</span>` : '')}
            ${v.website ? `<span>🔗 <a href="${escapeAttr(v.website)}" target="_blank" rel="noopener">Website</a></span>` : ''}
            ${v.availability ? `<span>📅 Available: ${fmtDate(v.availability)}</span>` : ''}
            ${v.rating ? `<span class="venue-rating-stars">${renderStars(v.rating)}</span>` : ''}
          </div>

          ${prosArr.length || consArr.length ? `
            <div class="venue-pros-cons">
              <div class="venue-pros">
                ${prosArr.length ? `<div class="venue-pros-label">Pros</div><ul>${prosArr.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>` : ''}
              </div>
              <div class="venue-cons">
                ${consArr.length ? `<div class="venue-cons-label">Cons</div><ul>${consArr.map(c => `<li>${escapeHtml(c)}</li>`).join('')}</ul>` : ''}
              </div>
            </div>
          ` : ''}

          ${v.notes ? `<div class="venue-card-notes">${escapeHtml(v.notes)}</div>` : ''}

          <div class="venue-card-footer">
            <span class="status-badge ${v.status}">${v.status}</span>
            <div class="vendor-actions">
              <button class="btn-icon" onclick="app.editVenue('${v.id}')" title="Edit">✏️</button>
              <button class="btn-icon" onclick="app.deleteVenue('${v.id}')" title="Delete">🗑️</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function deleteVenue(id) {
    state.venues = state.venues.filter(v => v.id !== id);
    saveState();
    renderVenues();
  }

  function editVenue(id) {
    const v = (state.venues || []).find(v => v.id === id);
    if (!v) return;

    const typeOpts = ['Venue','Catering','Photography','Videography','Florist','DJ / Band','Baker','Hair & Makeup','Officiant','Rentals','Planner','Other'];
    const settingOpts = [['','Setting...'],['indoor','Indoor'],['outdoor','Outdoor'],['both','Indoor & Outdoor']];
    const cateringOpts = [['','Catering...'],['included','Catering Included'],['preferred','Preferred Vendors'],['byob','Bring Your Own'],['na','N/A']];
    const ratingOpts = [[0,'Rating...'],[5,'5 — Love it'],[4,'4 — Really like'],[3,'3 — It\'s okay'],[2,'2 — Not great'],[1,'1 — No way']];
    const statusOpts = [['researching','Researching'],['toured','Toured / Met'],['favorite','Favorite'],['booked','Booked'],['passed','Passed']];

    openModal('Edit Venue / Vendor', `
      <div class="form-group"><label>Name</label><input type="text" id="edit-venue-name" value="${escapeAttr(v.name)}"></div>
      <div class="form-group"><label>Type</label><select id="edit-venue-type">
        ${typeOpts.map(t => `<option value="${t}" ${t === v.type ? 'selected' : ''}>${t}</option>`).join('')}
      </select></div>
      <div class="form-group"><label>Location</label><input type="text" id="edit-venue-location" value="${escapeAttr(v.location)}"></div>
      <div class="form-group"><label>Guest Capacity</label><input type="number" id="edit-venue-capacity" value="${v.capacity || ''}" min="1"></div>
      <div class="form-group"><label>Est. Cost (Low)</label><input type="number" id="edit-venue-cost-low" value="${v.costLow || ''}" min="0"></div>
      <div class="form-group"><label>Est. Cost (High)</label><input type="number" id="edit-venue-cost-high" value="${v.costHigh || ''}" min="0"></div>
      <div class="form-group"><label>Setting</label><select id="edit-venue-setting">
        ${settingOpts.map(([val, label]) => `<option value="${val}" ${val === v.setting ? 'selected' : ''}>${label}</option>`).join('')}
      </select></div>
      <div class="form-group"><label>Catering</label><select id="edit-venue-catering">
        ${cateringOpts.map(([val, label]) => `<option value="${val}" ${val === v.catering ? 'selected' : ''}>${label}</option>`).join('')}
      </select></div>
      <div class="form-group"><label>Website</label><input type="url" id="edit-venue-website" value="${escapeAttr(v.website)}"></div>
      <div class="form-group"><label>Phone</label><input type="tel" id="edit-venue-phone" value="${escapeAttr(v.phone)}"></div>
      <div class="form-group"><label>Contact</label><input type="text" id="edit-venue-contact" value="${escapeAttr(v.contact)}"></div>
      <div class="form-group"><label>Available Date</label><input type="date" id="edit-venue-avail" value="${v.availability || ''}"></div>
      <div class="form-group"><label>Rating</label><select id="edit-venue-rating">
        ${ratingOpts.map(([val, label]) => `<option value="${val}" ${val === v.rating ? 'selected' : ''}>${label}</option>`).join('')}
      </select></div>
      <div class="form-group"><label>Status</label><select id="edit-venue-status">
        ${statusOpts.map(([val, label]) => `<option value="${val}" ${val === v.status ? 'selected' : ''}>${label}</option>`).join('')}
      </select></div>
      <div class="form-group"><label>Pros (comma-separated)</label><input type="text" id="edit-venue-pros" value="${escapeAttr(v.pros)}"></div>
      <div class="form-group"><label>Cons (comma-separated)</label><input type="text" id="edit-venue-cons" value="${escapeAttr(v.cons)}"></div>
      <div class="form-group"><label>Notes</label><textarea id="edit-venue-notes" rows="3">${escapeHtml(v.notes)}</textarea></div>
    `, () => {
      v.name = document.getElementById('edit-venue-name').value.trim();
      v.type = document.getElementById('edit-venue-type').value;
      v.location = document.getElementById('edit-venue-location').value.trim();
      v.capacity = parseInt(document.getElementById('edit-venue-capacity').value, 10) || 0;
      v.costLow = parseFloat(document.getElementById('edit-venue-cost-low').value) || 0;
      v.costHigh = parseFloat(document.getElementById('edit-venue-cost-high').value) || 0;
      v.setting = document.getElementById('edit-venue-setting').value;
      v.catering = document.getElementById('edit-venue-catering').value;
      v.website = document.getElementById('edit-venue-website').value.trim();
      v.phone = document.getElementById('edit-venue-phone').value.trim();
      v.contact = document.getElementById('edit-venue-contact').value.trim();
      v.availability = document.getElementById('edit-venue-avail').value;
      v.rating = parseInt(document.getElementById('edit-venue-rating').value, 10) || 0;
      v.status = document.getElementById('edit-venue-status').value;
      v.pros = document.getElementById('edit-venue-pros').value.trim();
      v.cons = document.getElementById('edit-venue-cons').value.trim();
      v.notes = document.getElementById('edit-venue-notes').value.trim();
      saveState();
      renderVenues();
    });
  }

  // ═══════════════════════════════════════════
  // VENDORS
  // ═══════════════════════════════════════════
  const vendorForm = document.getElementById('vendor-form');

  vendorForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const vendor = {
      id: uid(),
      name: document.getElementById('vendor-name').value.trim(),
      category: document.getElementById('vendor-category').value,
      contact: document.getElementById('vendor-contact').value.trim(),
      phone: document.getElementById('vendor-phone').value.trim(),
      email: document.getElementById('vendor-email').value.trim(),
      website: document.getElementById('vendor-website').value.trim(),
      cost: parseFloat(document.getElementById('vendor-cost').value) || 0,
      status: document.getElementById('vendor-status').value,
      notes: document.getElementById('vendor-notes').value.trim(),
    };
    if (!vendor.name) return;
    state.vendors.push(vendor);
    saveState();
    vendorForm.reset();
    renderVendors();
  });

  function renderVendors() {
    const grid = document.getElementById('vendor-grid');
    const emptyMsg = document.getElementById('vendors-empty');
    if (state.vendors.length === 0) {
      grid.innerHTML = '';
      grid.appendChild(emptyMsg);
      emptyMsg.style.display = 'block';
      return;
    }
    emptyMsg.style.display = 'none';
    grid.innerHTML = state.vendors.map((v) => `
      <div class="vendor-card">
        <div class="vendor-card-header">
          <h4>${escapeHtml(v.name)}</h4>
          <span class="status-badge ${v.status}">${v.status}</span>
        </div>
        <div class="vendor-card-category">${escapeHtml(v.category)}</div>
        <div class="vendor-card-details">
          ${v.contact ? `<div class="vendor-detail"><span class="vendor-detail-icon">👤</span> ${escapeHtml(v.contact)}</div>` : ''}
          ${v.phone ? `<div class="vendor-detail"><span class="vendor-detail-icon">📞</span> ${escapeHtml(v.phone)}</div>` : ''}
          ${v.email ? `<div class="vendor-detail"><span class="vendor-detail-icon">✉️</span> <a href="mailto:${escapeAttr(v.email)}">${escapeHtml(v.email)}</a></div>` : ''}
          ${v.website ? `<div class="vendor-detail"><span class="vendor-detail-icon">🔗</span> <a href="${escapeAttr(v.website)}" target="_blank" rel="noopener">Website</a></div>` : ''}
        </div>
        ${v.notes ? `<div class="vendor-card-notes">${escapeHtml(v.notes)}</div>` : ''}
        <div class="vendor-card-footer">
          <span class="vendor-cost">${v.cost ? fmtFull(v.cost) : '—'}</span>
          <div class="vendor-actions">
            <button class="btn-icon" onclick="app.editVendor('${v.id}')" title="Edit">✏️</button>
            <button class="btn-icon" onclick="app.deleteVendor('${v.id}')" title="Delete">🗑️</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  function deleteVendor(id) {
    state.vendors = state.vendors.filter((v) => v.id !== id);
    saveState();
    renderVendors();
  }

  function editVendor(id) {
    const v = state.vendors.find((v) => v.id === id);
    if (!v) return;
    openModal('Edit Vendor', `
      <div class="form-group"><label>Name</label><input type="text" id="edit-vendor-name" value="${escapeAttr(v.name)}"></div>
      <div class="form-group"><label>Category</label><select id="edit-vendor-category">
        ${['Venue','Catering','Photography','Videography','Florist','DJ / Band','Baker','Hair & Makeup','Officiant','Rentals','Stationery','Transportation','Planner','Other']
          .map(c => `<option value="${c}" ${c === v.category ? 'selected' : ''}>${c}</option>`).join('')}
      </select></div>
      <div class="form-group"><label>Contact Person</label><input type="text" id="edit-vendor-contact" value="${escapeAttr(v.contact)}"></div>
      <div class="form-group"><label>Phone</label><input type="tel" id="edit-vendor-phone" value="${escapeAttr(v.phone)}"></div>
      <div class="form-group"><label>Email</label><input type="email" id="edit-vendor-email" value="${escapeAttr(v.email)}"></div>
      <div class="form-group"><label>Website</label><input type="url" id="edit-vendor-website" value="${escapeAttr(v.website)}"></div>
      <div class="form-group"><label>Quoted Cost</label><input type="number" id="edit-vendor-cost" value="${v.cost || ''}" min="0" step="0.01"></div>
      <div class="form-group"><label>Status</label><select id="edit-vendor-status">
        ${['researching','contacted','meeting','booked','declined']
          .map(s => `<option value="${s}" ${s === v.status ? 'selected' : ''}>${s}</option>`).join('')}
      </select></div>
      <div class="form-group"><label>Notes</label><textarea id="edit-vendor-notes" rows="3">${escapeHtml(v.notes)}</textarea></div>
    `, () => {
      v.name = document.getElementById('edit-vendor-name').value.trim();
      v.category = document.getElementById('edit-vendor-category').value;
      v.contact = document.getElementById('edit-vendor-contact').value.trim();
      v.phone = document.getElementById('edit-vendor-phone').value.trim();
      v.email = document.getElementById('edit-vendor-email').value.trim();
      v.website = document.getElementById('edit-vendor-website').value.trim();
      v.cost = parseFloat(document.getElementById('edit-vendor-cost').value) || 0;
      v.status = document.getElementById('edit-vendor-status').value;
      v.notes = document.getElementById('edit-vendor-notes').value.trim();
      saveState();
      renderVendors();
    });
  }

  // ═══════════════════════════════════════════
  // SEATING CHART
  // ═══════════════════════════════════════════
  const tableForm = document.getElementById('table-form');

  tableForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const table = {
      id: uid(),
      name: document.getElementById('table-name').value.trim(),
      capacity: parseInt(document.getElementById('table-capacity').value, 10) || 8,
      guestIds: [],
    };
    if (!table.name) return;
    state.tables.push(table);
    saveState();
    tableForm.reset();
    document.getElementById('table-capacity').value = 8;
    renderSeating();
  });

  function getUnseatedGuests() {
    const seatedIds = new Set();
    state.tables.forEach(t => t.guestIds.forEach(id => seatedIds.add(id)));
    return state.guests.filter(g => !seatedIds.has(g.id) && g.rsvp !== 'declined');
  }

  function getInitials(name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  function renderSeating() {
    const layout = document.getElementById('seating-layout');
    const emptyMsg = document.getElementById('seating-empty');

    if (state.tables.length === 0) {
      layout.innerHTML = '';
      layout.appendChild(emptyMsg);
      emptyMsg.style.display = 'block';
      return;
    }
    emptyMsg.style.display = 'none';

    const unseated = getUnseatedGuests();

    layout.innerHTML = state.tables.map((t) => {
      const seated = t.guestIds
        .map(id => state.guests.find(g => g.id === id))
        .filter(Boolean);
      const isFull = seated.length >= t.capacity;
      const totalSlots = t.capacity;
      const radius = 105;
      const angleStep = (2 * Math.PI) / totalSlots;
      const centerX = 120;
      const centerY = 120;

      const chairsHtml = [];
      for (let i = 0; i < totalSlots; i++) {
        const angle = angleStep * i - Math.PI / 2;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        const guest = seated[i];

        if (guest) {
          chairsHtml.push(`
            <div class="seating-chair" style="left:${x}px;top:${y}px" onclick="app.unseatGuest('${t.id}','${guest.id}')">
              <div class="seating-chair-avatar occupied" title="${escapeAttr(guest.name)}">
                ${escapeHtml(getInitials(guest.name))}
                <span class="seating-chair-tooltip">${escapeHtml(guest.name)}</span>
              </div>
            </div>
          `);
        } else {
          chairsHtml.push(`
            <div class="seating-chair" style="left:${x}px;top:${y}px">
              <div class="seating-chair-avatar empty-seat">+</div>
            </div>
          `);
        }
      }

      const tableNum = t.name.replace(/\D/g, '') || '#';

      return `
        <div class="seating-table-card">
          <div class="seating-round-visual">
            <div class="seating-round-table">
              <span class="table-number">${escapeHtml(tableNum)}</span>
              <span class="table-label">${escapeHtml(t.name)}</span>
            </div>
            ${chairsHtml.join('')}
          </div>
          <div class="seating-table-info">
            <span class="seating-capacity"><span class="count ${isFull ? 'full' : ''}">${seated.length}</span> / ${t.capacity} seats</span>
          </div>
          ${!isFull && unseated.length > 0 ? `
            <div class="seating-add-row">
              <select id="seat-select-${t.id}">
                <option value="">Assign a guest...</option>
                ${unseated.map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('')}
              </select>
              <button class="btn btn-primary" onclick="app.seatGuest('${t.id}')">Add</button>
            </div>
          ` : ''}
          <div class="seating-table-footer">
            <button class="btn-icon" onclick="app.editTable('${t.id}')" title="Edit table">✏️</button>
            <button class="btn-icon" onclick="app.deleteTable('${t.id}')" title="Delete table">🗑️</button>
          </div>
        </div>
      `;
    }).join('');
  }

  function seatGuest(tableId) {
    const sel = document.getElementById('seat-select-' + tableId);
    if (!sel || !sel.value) return;
    const table = state.tables.find(t => t.id === tableId);
    if (!table || table.guestIds.length >= table.capacity) return;
    table.guestIds.push(sel.value);
    saveState();
    renderSeating();
  }

  function unseatGuest(tableId, guestId) {
    const table = state.tables.find(t => t.id === tableId);
    if (!table) return;
    table.guestIds = table.guestIds.filter(id => id !== guestId);
    saveState();
    renderSeating();
  }

  function deleteTable(id) {
    state.tables = state.tables.filter(t => t.id !== id);
    saveState();
    renderSeating();
  }

  function editTable(id) {
    const t = state.tables.find(t => t.id === id);
    if (!t) return;
    openModal('Edit Table', `
      <div class="form-group"><label>Table Name</label><input type="text" id="edit-table-name" value="${escapeAttr(t.name)}"></div>
      <div class="form-group"><label>Capacity</label><input type="number" id="edit-table-capacity" value="${t.capacity}" min="1" max="50"></div>
    `, () => {
      t.name = document.getElementById('edit-table-name').value.trim();
      t.capacity = parseInt(document.getElementById('edit-table-capacity').value, 10) || 8;
      saveState();
      renderSeating();
    });
  }

  // ═══════════════════════════════════════════
  // TIMELINE
  // ═══════════════════════════════════════════
  const timelineForm = document.getElementById('timeline-form');

  timelineForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const evt = {
      id: uid(),
      time: document.getElementById('event-time').value,
      title: document.getElementById('event-title').value.trim(),
      location: document.getElementById('event-location').value.trim(),
      duration: parseInt(document.getElementById('event-duration').value, 10) || 0,
      notes: document.getElementById('event-notes').value.trim(),
    };
    if (!evt.title || !evt.time) return;
    state.timelineEvents.push(evt);
    saveState();
    timelineForm.reset();
    renderTimeline();
  });

  function renderTimeline() {
    const view = document.getElementById('timeline-view');
    const emptyMsg = document.getElementById('timeline-empty');

    if (state.timelineEvents.length === 0) {
      view.innerHTML = '';
      view.appendChild(emptyMsg);
      emptyMsg.style.display = 'block';
      return;
    }
    emptyMsg.style.display = 'none';

    const sorted = [...state.timelineEvents].sort((a, b) => a.time.localeCompare(b.time));

    view.innerHTML = sorted.map((evt) => `
      <div class="timeline-item">
        <div class="timeline-item-header">
          <div>
            <span class="timeline-time">${fmtTime(evt.time)}</span>
            <span class="timeline-title"> — ${escapeHtml(evt.title)}</span>
          </div>
          <div class="timeline-actions">
            <button class="btn-icon" onclick="app.editTimelineEvent('${evt.id}')" title="Edit">✏️</button>
            <button class="btn-icon" onclick="app.deleteTimelineEvent('${evt.id}')" title="Delete">🗑️</button>
          </div>
        </div>
        <div class="timeline-meta">
          ${evt.location ? `<span>📍 ${escapeHtml(evt.location)}</span>` : ''}
          ${evt.duration ? `<span>⏱ ${evt.duration} min</span>` : ''}
          ${evt.notes ? `<span>📝 ${escapeHtml(evt.notes)}</span>` : ''}
        </div>
      </div>
    `).join('');
  }

  function deleteTimelineEvent(id) {
    state.timelineEvents = state.timelineEvents.filter(e => e.id !== id);
    saveState();
    renderTimeline();
  }

  function editTimelineEvent(id) {
    const evt = state.timelineEvents.find(e => e.id === id);
    if (!evt) return;
    openModal('Edit Event', `
      <div class="form-group"><label>Time</label><input type="time" id="edit-event-time" value="${evt.time}"></div>
      <div class="form-group"><label>Title</label><input type="text" id="edit-event-title" value="${escapeAttr(evt.title)}"></div>
      <div class="form-group"><label>Location</label><input type="text" id="edit-event-location" value="${escapeAttr(evt.location)}"></div>
      <div class="form-group"><label>Duration (min)</label><input type="number" id="edit-event-duration" value="${evt.duration || ''}" min="1"></div>
      <div class="form-group"><label>Notes</label><input type="text" id="edit-event-notes" value="${escapeAttr(evt.notes)}"></div>
    `, () => {
      evt.time = document.getElementById('edit-event-time').value;
      evt.title = document.getElementById('edit-event-title').value.trim();
      evt.location = document.getElementById('edit-event-location').value.trim();
      evt.duration = parseInt(document.getElementById('edit-event-duration').value, 10) || 0;
      evt.notes = document.getElementById('edit-event-notes').value.trim();
      saveState();
      renderTimeline();
    });
  }

  // ═══════════════════════════════════════════
  // TO-DO
  // ═══════════════════════════════════════════
  const todoForm = document.getElementById('todo-form');
  const todoFilterBtns = document.querySelectorAll('.filter-btn');
  let todoFilter = 'all';

  todoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const todo = {
      id: uid(),
      title: document.getElementById('todo-title').value.trim(),
      category: document.getElementById('todo-category').value,
      priority: document.getElementById('todo-priority').value,
      due: document.getElementById('todo-due').value,
      completed: false,
    };
    if (!todo.title) return;
    state.todos.push(todo);
    saveState();
    todoForm.reset();
    renderTodos();
  });

  todoFilterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      todoFilterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      todoFilter = btn.dataset.filter;
      renderTodos();
    });
  });

  function renderTodos() {
    const list = document.getElementById('todo-list');
    const emptyMsg = document.getElementById('todos-empty');
    let todos = state.todos;
    if (todoFilter === 'active') todos = todos.filter((t) => !t.completed);
    if (todoFilter === 'completed') todos = todos.filter((t) => t.completed);

    if (todos.length === 0) {
      list.innerHTML = '';
      list.appendChild(emptyMsg);
      emptyMsg.style.display = 'block';
      return;
    }
    emptyMsg.style.display = 'none';

    const priorityOrder = { high: 0, medium: 1, low: 2 };
    todos.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    list.innerHTML = todos.map((t) => `
      <div class="todo-item ${t.completed ? 'completed' : ''}">
        <div class="todo-checkbox ${t.completed ? 'checked' : ''}" onclick="app.toggleTodo('${t.id}')">
          ${t.completed ? '✓' : ''}
        </div>
        <div class="todo-content">
          <div class="todo-title">${escapeHtml(t.title)}</div>
          <div class="todo-meta">
            <span class="todo-priority ${t.priority}">${t.priority}</span>
            <span>${escapeHtml(t.category)}</span>
            ${t.due ? `<span>Due: ${fmtDate(t.due)}</span>` : ''}
          </div>
        </div>
        <div class="todo-actions">
          <button class="btn-icon" onclick="app.editTodo('${t.id}')" title="Edit">✏️</button>
          <button class="btn-icon" onclick="app.deleteTodo('${t.id}')" title="Delete">🗑️</button>
        </div>
      </div>
    `).join('');
  }

  function toggleTodo(id) {
    const todo = state.todos.find((t) => t.id === id);
    if (todo) { todo.completed = !todo.completed; saveState(); renderTodos(); }
  }

  function deleteTodo(id) {
    state.todos = state.todos.filter((t) => t.id !== id);
    saveState();
    renderTodos();
  }

  function editTodo(id) {
    const t = state.todos.find((t) => t.id === id);
    if (!t) return;
    openModal('Edit Task', `
      <div class="form-group"><label>Task</label><input type="text" id="edit-todo-title" value="${escapeAttr(t.title)}"></div>
      <div class="form-group"><label>Category</label><select id="edit-todo-category">
        ${['Planning','Venue','Attire','Food & Drink','Decor','Music','Stationery','Beauty','Guests','Legal','Other']
          .map(c => `<option value="${c}" ${c === t.category ? 'selected' : ''}>${c}</option>`).join('')}
      </select></div>
      <div class="form-group"><label>Priority</label><select id="edit-todo-priority">
        <option value="low" ${t.priority === 'low' ? 'selected' : ''}>Low</option>
        <option value="medium" ${t.priority === 'medium' ? 'selected' : ''}>Medium</option>
        <option value="high" ${t.priority === 'high' ? 'selected' : ''}>High</option>
      </select></div>
      <div class="form-group"><label>Due Date</label><input type="date" id="edit-todo-due" value="${t.due || ''}"></div>
    `, () => {
      t.title = document.getElementById('edit-todo-title').value.trim();
      t.category = document.getElementById('edit-todo-category').value;
      t.priority = document.getElementById('edit-todo-priority').value;
      t.due = document.getElementById('edit-todo-due').value;
      saveState();
      renderTodos();
    });
  }

  // ═══════════════════════════════════════════
  // NOTES / INSPIRATION
  // ═══════════════════════════════════════════
  const noteForm = document.getElementById('note-form');

  noteForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const note = {
      id: uid(),
      title: document.getElementById('note-title').value.trim(),
      category: document.getElementById('note-category').value,
      color: document.getElementById('note-color').value,
      content: document.getElementById('note-content').value.trim(),
      createdAt: new Date().toISOString(),
    };
    if (!note.title || !note.content) return;
    state.notes.push(note);
    saveState();
    noteForm.reset();
    renderNotes();
  });

  function renderNotes() {
    const grid = document.getElementById('notes-grid');
    const emptyMsg = document.getElementById('notes-empty');

    if (state.notes.length === 0) {
      grid.innerHTML = '';
      grid.appendChild(emptyMsg);
      emptyMsg.style.display = 'block';
      return;
    }
    emptyMsg.style.display = 'none';

    grid.innerHTML = [...state.notes].reverse().map((n) => `
      <div class="note-card ${n.color || 'cream'}">
        <div class="note-card-header">
          <h4>${escapeHtml(n.title)}</h4>
          <span class="note-category-tag">${escapeHtml(n.category)}</span>
        </div>
        <div class="note-card-body">${escapeHtml(n.content)}</div>
        <div class="note-card-footer">
          <button class="btn-icon" onclick="app.editNote('${n.id}')" title="Edit">✏️</button>
          <button class="btn-icon" onclick="app.deleteNote('${n.id}')" title="Delete">🗑️</button>
        </div>
      </div>
    `).join('');
  }

  function deleteNote(id) {
    state.notes = state.notes.filter(n => n.id !== id);
    saveState();
    renderNotes();
  }

  function editNote(id) {
    const n = state.notes.find(n => n.id === id);
    if (!n) return;
    openModal('Edit Note', `
      <div class="form-group"><label>Title</label><input type="text" id="edit-note-title" value="${escapeAttr(n.title)}"></div>
      <div class="form-group"><label>Category</label><select id="edit-note-category">
        ${['Ideas','Colors','Theme','Flowers','Dress','Food','Music','Venue','Other']
          .map(c => `<option value="${c}" ${c === n.category ? 'selected' : ''}>${c}</option>`).join('')}
      </select></div>
      <div class="form-group"><label>Color</label><select id="edit-note-color">
        ${['cream','blush','sage','lavender','sky','peach','gold']
          .map(c => `<option value="${c}" ${c === n.color ? 'selected' : ''}>${c.charAt(0).toUpperCase() + c.slice(1)}</option>`).join('')}
      </select></div>
      <div class="form-group"><label>Content</label><textarea id="edit-note-content" rows="5">${escapeHtml(n.content)}</textarea></div>
    `, () => {
      n.title = document.getElementById('edit-note-title').value.trim();
      n.category = document.getElementById('edit-note-category').value;
      n.color = document.getElementById('edit-note-color').value;
      n.content = document.getElementById('edit-note-content').value.trim();
      saveState();
      renderNotes();
    });
  }

  // ═══════════════════════════════════════════
  // DASHBOARD
  // ═══════════════════════════════════════════
  function renderDashboard() {
    const spent = getTotalSpent();
    const remaining = state.totalBudget - spent;
    const bookedVendors = state.vendors.filter((v) => v.status === 'booked').length;
    const completedTasks = state.todos.filter((t) => t.completed).length;
    const totalTasks = state.todos.length;
    const totalGuests = state.guests.length;
    const rsvpIn = state.guests.filter(g => g.rsvp !== 'pending').length;

    document.getElementById('dash-budget').textContent = fmt(state.totalBudget);
    document.getElementById('dash-spent').textContent = fmt(spent);
    document.getElementById('dash-vendors').textContent = bookedVendors;
    document.getElementById('dash-tasks').textContent = `${completedTasks} / ${totalTasks}`;
    document.getElementById('dash-guests').textContent = totalGuests;
    document.getElementById('dash-rsvps').textContent = `${rsvpIn} / ${totalGuests}`;

    const barFill = document.getElementById('dash-budget-bar');
    const pct = state.totalBudget > 0 ? Math.min((spent / state.totalBudget) * 100, 100) : 0;
    barFill.style.width = pct + '%';
    barFill.classList.toggle('over-budget', spent > state.totalBudget);

    document.getElementById('dash-bar-spent').textContent = fmt(spent) + ' spent';
    document.getElementById('dash-bar-remaining').textContent = remaining >= 0 ? fmt(remaining) + ' remaining' : fmt(Math.abs(remaining)) + ' over budget';

    const breakdown = document.getElementById('dash-category-breakdown');
    const categoryTotals = {};
    state.expenses.forEach((e) => { categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount; });
    const sorted = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
    breakdown.innerHTML = sorted.map(([cat, amount]) => `
      <div class="category-row">
        <span class="category-dot" style="background:${CATEGORY_COLORS[cat] || '#8a8280'}"></span>
        <span class="category-name">${escapeHtml(cat)}</span>
        <span class="category-amount">${fmt(amount)}</span>
      </div>
    `).join('');

    const upcomingList = document.getElementById('dash-upcoming-tasks');
    const pendingTasks = state.todos
      .filter((t) => !t.completed)
      .sort((a, b) => {
        if (!a.due && !b.due) return 0;
        if (!a.due) return 1;
        if (!b.due) return -1;
        return new Date(a.due) - new Date(b.due);
      })
      .slice(0, 8);

    if (pendingTasks.length === 0) {
      upcomingList.innerHTML = '<p class="empty-state-small">No pending tasks yet</p>';
    } else {
      upcomingList.innerHTML = pendingTasks.map((t) => `
        <div class="upcoming-task-item">
          <span class="upcoming-task-priority ${t.priority}"></span>
          <span class="upcoming-task-title">${escapeHtml(t.title)}</span>
          ${t.due ? `<span class="upcoming-task-due">${fmtDate(t.due)}</span>` : ''}
        </div>
      `).join('');
    }
  }

  // ═══════════════════════════════════════════
  // MODAL
  // ═══════════════════════════════════════════
  const modalOverlay = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalSave = document.getElementById('modal-save');
  const modalCancel = document.getElementById('modal-cancel');
  const modalCloseBtn = document.getElementById('modal-close');
  let currentModalSave = null;

  function openModal(title, bodyHtml, onSave) {
    modalTitle.textContent = title;
    modalBody.innerHTML = bodyHtml;
    currentModalSave = onSave;
    modalOverlay.classList.add('active');
  }

  function closeModal() {
    modalOverlay.classList.remove('active');
    currentModalSave = null;
  }

  modalSave.addEventListener('click', () => { if (currentModalSave) currentModalSave(); closeModal(); });
  modalCancel.addEventListener('click', closeModal);
  modalCloseBtn.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  // ─── Public API ──────────────────────────
  window.app = {
    deleteExpense, editExpense,
    deleteVenue, editVenue,
    deleteVendor, editVendor,
    toggleTodo, deleteTodo, editTodo,
    deleteGuest, editGuest,
    seatGuest, unseatGuest, deleteTable, editTable,
    deleteTimelineEvent, editTimelineEvent,
    deleteNote, editNote,
  };

  // ─── Render All ─────────────────────────
  function refreshAll() {
    startCountdown();
    renderDashboard();
    renderBudget();
    renderGuests();
    renderVenues();
    renderVendors();
    renderSeating();
    renderTimeline();
    renderTodos();
    renderNotes();
  }

  // ─── Firebase Listener ─────────────────
  if (firebaseRef) {
    firebaseRef.on('value', (snapshot) => {
      if (Date.now() - lastSaveTimestamp < 2000) return;
      const data = snapshot.val();
      if (data) {
        state = normalizeState(Object.assign(defaultState(), data));
        localStorage.setItem('wedding-planner-state', JSON.stringify(state));
        refreshAll();
      }
    });
  }

  // ─── Initial Render ──────────────────────
  refreshAll();
})();
