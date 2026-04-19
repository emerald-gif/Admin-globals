// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyCuI_Nw4HMbDWa6wR3FhHJMHOUgx53E40c",
  authDomain: "globals-17bf7.firebaseapp.com",
  projectId: "globals-17bf7",
  storageBucket: "globals-17bf7.appspot.com",
  messagingSenderId: "603274362994",
  appId: "1:603274362994:web:c312c10cf0a42938e882eb",
  // Add this so Realtime Database knows where to go
  databaseURL: "https://globals-17bf7-default-rtdb.firebaseio.com/" 
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);


// ═══════════════════════════════════════════════════════════════════════
//  ADMIN AUTH GATE
//  All Firestore reads require isSignedIn() in the rules.
//  Without this, every db.collection() call fails before auth resolves.
//  window.onAdminReady() is called after sign-in is confirmed.
// ═══════════════════════════════════════════════════════════════════════
(function initAdminAuth() {
  const loginGate = document.getElementById('admin-login-gate');
  const adminApp  = document.getElementById('admin-app');
  const loginBtn  = document.getElementById('admin-login-btn');
  const emailInp  = document.getElementById('admin-email-input');
  const passInp   = document.getElementById('admin-pass-input');
  const errEl     = document.getElementById('admin-login-error');

  function showApp() {
    if (loginGate) loginGate.style.display = 'none';
    if (adminApp)  adminApp.style.display  = 'block';
  }
  function showLogin(msg) {
    if (loginGate) loginGate.style.display = 'flex';
    if (adminApp)  adminApp.style.display  = 'none';
    if (errEl && msg) errEl.textContent = msg;
  }

  firebase.auth().onAuthStateChanged(function(user) {
    if (user) {
      showApp();
      // Fire all data loads — defined at the bottom of this file
      if (typeof window.onAdminReady === 'function') window.onAdminReady();
    } else {
      showLogin('');
    }
  });

  if (loginBtn) {
    loginBtn.addEventListener('click', async function() {
      const email = emailInp ? emailInp.value.trim() : '';
      const pass  = passInp  ? passInp.value         : '';
      if (!email || !pass) { if(errEl) errEl.textContent = 'Enter email and password.'; return; }
      loginBtn.textContent = 'Signing in…';
      loginBtn.disabled    = true;
      try {
        await firebase.auth().signInWithEmailAndPassword(email, pass);
      } catch(e) {
        if(errEl) errEl.textContent = e.message.replace('Firebase: ','').replace(/ \(auth.*\)/,'');
        loginBtn.textContent = 'Sign In';
        loginBtn.disabled    = false;
      }
    });
    if (passInp) passInp.addEventListener('keydown', e => { if(e.key==='Enter') loginBtn.click(); });
  }
})();



// 2. Define 'firestore' for your User Data (Tasks, Users)
const db = firebase.firestore(); 

console.log("✅ Dual Database System Connected");





// --- Tab Switching Logic ---
function switchTab(tabId) {
  // Hide all tab and tab-section elements using inline style (compatible with DOMContentLoaded setup)
  document.querySelectorAll('.tab, .tab-section').forEach(el => {
    el.style.display = 'none';
  });
  // Show the target section
  const target = document.getElementById(tabId);
  if (target) {
    target.style.display = 'block';
    // Update topbar title from the active nav button
    const activeBtn = document.querySelector('.nav-btn.active');
    if (activeBtn) {
      const titleEl = document.getElementById('topbar-title');
      if (titleEl) titleEl.textContent = activeBtn.innerText.trim();
    }
  }
}





// --- Fetch Overview Stats ---
async function fetchStats() {
  try {
    const [usersSnap, tasksSnap, withdrawSnap, storesSnap, ludoTxSnap, billsSnap] = await Promise.all([
      db.collection('users').get(),
      db.collection('tasks').get(),
      db.collection('Withdraw').get(),
      db.collection('stores').get(),
      db.collection('ludo_transactions').get(),
      db.collection('bill_submissions').get(),
    ]);
    const _set = (id, v) => { const el = document.getElementById(id); if(el) el.innerText = v; };
    // Banner chips
    _set('user-count',       usersSnap.size);
    _set('task-count',       tasksSnap.size);
    _set('withdrawal-count', withdrawSnap.size);
    // Stat cards
    _set('user-count-card',       usersSnap.size);
    _set('task-count-card',       tasksSnap.size);
    _set('withdrawal-count-card', withdrawSnap.size);
    // Premium
    const premiumCount = usersSnap.docs.filter(d => d.data().is_Premium === true).length;
    _set('premium-count-overview', premiumCount);
    // Ludo payouts
    let ludoPayout = 0;
    ludoTxSnap.docs.forEach(d => { ludoPayout += Number(d.data().amount || 0); });
    _set('ludo-payout-overview', '₦' + ludoPayout.toLocaleString());
    // Stores
    _set('store-count-overview', storesSnap.size);
    // VTU
    _set('vtu-count-overview', billsSnap.size);
  } catch(e) { console.error('[fetchStats]', e); }
}








// ✅ GLOBALS MAINTENANCE ENGINE 

document.addEventListener("DOMContentLoaded", function () {

    const toggle = document.getElementById("maintenanceToggle");
    const statusText = document.getElementById("maintenanceStatus");

    if (!toggle) return;

    // Wait for auth before hitting Firestore (rules require isSignedIn)
    firebase.auth().onAuthStateChanged(function(user) {
      if (!user) return;

    const configRef = firebase.firestore().collection("system").doc("config");

    // Flag prevents programmatic toggle.checked changes from re-firing change
    let _updating = false;

    // Real-time sync
    configRef.onSnapshot((doc) => {
        if (!doc.exists) return;

        const mode = doc.data().maintenanceMode;

        _updating = true;
        toggle.checked = mode;
        _updating = false;

        statusText.textContent = mode ?
            "Maintenance Mode: ON" :
            "Maintenance Mode: OFF";

        statusText.style.color = mode ? "red" : "green";
    });

    // Update when toggled — only fires on genuine user interaction
    toggle.addEventListener("change", function () {
        if (_updating) return;
        configRef.update({
            maintenanceMode: toggle.checked
        });
    });
    }); // end onAuthStateChanged

});











     // ✅ GLOBALS GENERAL ALERT


(function(){
  const modal = document.getElementById("globalsModal");
  const titleEl = document.getElementById("globalsModalTitle");
  const msgEl = document.getElementById("globalsModalMessage");
  const actionsEl = document.getElementById("globalsModalActions");

  function openModal(title, message, buttons) {
    titleEl.textContent = title || "Notice";
    msgEl.textContent = message || "";
    actionsEl.innerHTML = "";
    buttons.forEach(btn => {
      const b = document.createElement("button");
      b.textContent = btn.label;
      b.style.cssText = `
        background: linear-gradient(135deg, #FFC107, #FF9800);
        border: none; color: #fff; font-weight: 600; border-radius: 10px;
        padding: 8px 18px; cursor: pointer; font-size: 14px;
        box-shadow: 0 3px 8px rgba(0,0,0,0.2);
      `;
      b.onclick = () => { modal.style.display="none"; btn.action(); };
      actionsEl.appendChild(b);
    });
    modal.style.display = "flex";
  }

  // Override default alert
  window.alert = function(message) {
    return new Promise(resolve => {
      openModal("Notice", message, [{label:"OK", action:resolve}]);
    });
  };

  // Override default confirm
  window.confirm = function(message) {
    return new Promise(resolve => {
      openModal("Confirm", message, [
        {label:"Cancel", action:()=>resolve(false)},
        {label:"OK", action:()=>resolve(true)}
      ]);
    });
  };

  // Override default prompt
  window.prompt = function(message, defaultValue="") {
    return new Promise(resolve => {
      msgEl.innerHTML = `<div style="margin-bottom:12px;">${message}</div>
        <input id='globalsPromptInput' value='${defaultValue}' style="
          width: 100%; padding: 8px; border:1px solid #ccc; border-radius:8px;" />`;
      actionsEl.innerHTML = "";
      const inputBox = () => document.getElementById("globalsPromptInput").value;
      actionsEl.appendChild(Object.assign(document.createElement("button"), {
        textContent: "Cancel",
        style: "background:#ccc;color:#000;padding:8px 18px;border:none;border-radius:8px;cursor:pointer;",
        onclick: ()=>{ modal.style.display="none"; resolve(null); }
      }));
      actionsEl.appendChild(Object.assign(document.createElement("button"), {
        textContent: "OK",
        style: "background: linear-gradient(135deg, #FFC107, #FF9800);color:#fff;padding:8px 18px;border:none;border-radius:8px;cursor:pointer;",
        onclick: ()=>{ modal.style.display="none"; resolve(inputBox()); }
      }));
      modal.style.display="flex";
    });
  };

})();












/* Users Admin Module (joinedAt version)
   - Paste after firebase init (db should be firebase.firestore())
   - Auto-inits when `db` exists and DOM is ready
   - Exposes window.startUsersModule() and window.stopUsersModule()
*/
(function UsersAdminModule(){
  // ----- config & state -----
  let allUsersCache = []; // raw user objects { id, ...data }
  let unsubscribe = null;
  let searchTimer = null;
  const DEBOUNCE_MS = 220;

  // ----- helpers -----
  function safeEl(id) { return document.getElementById(id); }

  function toDateVal(v) {
    if (!v) return null;
    if (typeof v.toDate === 'function') return v.toDate();
    if (v._seconds || v.seconds) {
      const secs = v._seconds || v.seconds;
      return new Date(secs * 1000);
    }
    if (typeof v === 'number') {
      if (v > 1e12) return new Date(v);
      return new Date(v * 1000);
    }
    if (typeof v === 'string') {
      const p = Date.parse(v);
      return isNaN(p) ? null : new Date(p);
    }
    return null;
  }

  function formatDate(d) {
    if (!d) return 'N/A';
    try { return d.toLocaleString(); } catch(e) { return String(d); }
  }

  function emitConsole(...args) {
    console.debug('[UsersAdmin]', ...args);
  }

  // ----- rendering -----
  function renderUsers(users) {
    const container = safeEl('user-list');
    if (!container) return;
    container.innerHTML = '';

    if (!users || users.length === 0) {
      container.innerHTML = `<p class="text-center text-gray-400">No users found</p>`;
      return;
    }

    users.forEach(u => {
      const joinedDate = toDateVal(u.joinedAt);
      const html = document.createElement('div');
      html.className = "bg-white p-4 rounded-lg shadow-md border hover:shadow-lg transition";
      html.innerHTML = `
        <div class="flex items-start justify-between">
          <div>
            <div class="font-semibold text-blue-600"> ${escapeHtml(u.fullName || u.displayName || 'Unnamed')}</div>
            <div class="text-xs text-slate-400">${escapeHtml(u.email || '—')}</div>
            <div class="text-xs text-gray-500 mt-1">UID: <span class="font-mono">${escapeHtml(u.id)}</span></div>
            <div class="text-xs text-gray-400 mt-1">Joined: ${formatDate(joinedDate)}</div>
          </div>
          <div class="text-right">
            <div class="${u.is_Premium ? 'text-purple-600 font-bold' : 'text-gray-500'} text-sm">
              ${u.is_Premium ? 'Premium' : 'Free'}
            </div>
            <div class="text-xs text-slate-300 mt-3">Username: <span class="font-medium">${escapeHtml(u.username || '—')}</span></div>
          </div>
        </div>
      `;
      container.appendChild(html);
    });
  }

  // ----- search + filter logic -----
  function applyTimeFilter(users, filterKey) {
    if (!filterKey || filterKey === 'all') return users.slice();
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startYesterday = new Date(startToday.getTime() - 86400000);
    const start7 = new Date(now.getTime() - 7 * 86400000);
    const start30 = new Date(now.getTime() - 30 * 86400000);
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return users.filter(u => {
      const d = toDateVal(u.joinedAt);
      if (!d) return false;
      if (filterKey === 'today') return d >= startToday;
      if (filterKey === 'yesterday') return (d >= startYesterday && d < startToday);
      if (filterKey === '7days') return d >= start7;
      if (filterKey === '30days') return d >= start30;
      if (filterKey === 'month') return d >= startMonth;
      return true;
    });
  }

  function applySearch(users, q) {
    if (!q) return users.slice();
    const s = q.trim().toLowerCase();
    return users.filter(u => {
      if (!u) return false;
      const fields = [
        (u.username || ''),
        (u.email || ''),
        (u.fullName || u.displayName || ''),
        (u.id || '')
      ];
      return fields.some(f => String(f).toLowerCase().includes(s));
    });
  }

  function renderUsersFromCache() {
    const qEl = safeEl('user-search');
    const timeEl = safeEl('time-filter');
    const q = qEl ? qEl.value || '' : '';
    const timeKey = timeEl ? timeEl.value : 'all';
    let result = applyTimeFilter(allUsersCache, timeKey);
    result = applySearch(result, q);
    renderUsers(result);

    const statsContainer = safeEl('total-users');
    if (statsContainer) statsContainer.innerText = allUsersCache.length;
  }

  // ----- aggregate stats -----
  function updateUserStats(users) {
    const totalEl = safeEl('total-users');
    const premiumEl = safeEl('premium-users');
    const todayEl = safeEl('joined-today');
    const weekEl = safeEl('joined-week');

    if (!totalEl || !premiumEl || !todayEl || !weekEl) return;

    const total = users.length;
    const premium = users.filter(u => !!u.is_Premium).length;

    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start7 = new Date(now.getTime() - 7 * 86400000);

    const joinedToday = users.filter(u => {
      const d = toDateVal(u.joinedAt);
      return d && d >= startToday;
    }).length;

    const joinedWeek = users.filter(u => {
      const d = toDateVal(u.joinedAt);
      return d && d >= start7;
    }).length;

    totalEl.innerText = total;
    premiumEl.innerText = premium;
    todayEl.innerText = joinedToday;
    weekEl.innerText = joinedWeek;
  }

  // ----- snapshot / loading -----
  async function attachRealtime() {
    if (typeof db === 'undefined') {
      emitConsole('db not ready for realtime');
      return fallbackLoad();
    }
    try {
      const q = db.collection('users').orderBy('joinedAt','desc');
      unsubscribe = q.onSnapshot(handleSnapshot, (err) => {
        console.warn('Realtime users snapshot error, falling back to once-off load:', err);
        fallbackLoad();
      });
      emitConsole('attached realtime users listener');
    } catch (err) {
      console.warn('attachRealtime error, fallback to get():', err);
      return fallbackLoad();
    }
  }

  async function fallbackLoad() {
    try {
      const snap = await db.collection('users').get();
      handleSnapshot(snap);
      emitConsole('loaded users via fallback get()');
    } catch (e) {
      console.error('fallbackLoad error', e);
    }
  }

  function handleSnapshot(snap) {
    const docs = snap.docs || [];
    allUsersCache = docs.map(d => {
      const data = d.data ? d.data() : d;
      const out = Object.assign({}, data);
      out.id = d.id || data.id || out.uid || out.userId || null;
      return out;
    });
    updateUserStats(allUsersCache);
    renderUsersFromCache();
  }

  function stopRealtime() {
    if (unsubscribe) {
      try { unsubscribe(); } catch (e) {}
      unsubscribe = null;
      emitConsole('realtime listener detached');
    }
  }

  // ----- UI wiring -----
  function wireUI() {
    const searchEl = safeEl('user-search');
    const timeEl = safeEl('time-filter');
    const exportBtn = safeEl('export-users-csv');

    if (searchEl) {
      searchEl.addEventListener('input', (e) => {
        if (searchTimer) clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          renderUsersFromCache();
        }, DEBOUNCE_MS);
      });
    }

    if (timeEl) {
      timeEl.addEventListener('change', () => renderUsersFromCache());
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        exportUsersCSV(allUsersCache);
      });
    }
  }

  // ----- CSV export -----
  function exportUsersCSV(users) {
    if (!users || users.length === 0) return alert('No users to export');
    const header = ['uid','fullName','username','email','is_Premium','joinedAt'];
    const rows = users.map(u => [
      u.id || '',
      (u.fullName || u.displayName || '').replace(/"/g,'""'),
      (u.username || '').replace(/"/g,'""'),
      (u.email || '').replace(/"/g,'""'),
      !!u.is_Premium,
      (toDateVal(u.joinedAt) ? toDateVal(u.joinedAt).toISOString() : '')
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c)}"`).join(',')).join('\n');
    const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-export-${(new Date()).toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ----- safe escape -----
  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, function (m) {
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m];
    });
  }

  // ----- public control -----
  async function startUsersModule() {
    wireUI();
    if (typeof db === 'undefined') {
      let tries = 0;
      const waitForDB = () => {
        return new Promise((resolve) => {
          const t = setInterval(() => {
            if (typeof db !== 'undefined') {
              clearInterval(t);
              resolve(true);
            }
            tries++;
            if (tries > 40) { clearInterval(t); resolve(false); }
          }, 150);
        });
      };
      const ok = await waitForDB();
      if (!ok) {
        console.error('UsersAdminModule: db not found, aborting.');
        return;
      }
    }
    attachRealtime();
  }

  function stopUsersModule() {
    stopRealtime();
  }

  // called from onAdminReady after auth
  window.startUsersModule = startUsersModule;
  window.stopUsersModule = stopUsersModule;

})();











async function fetchPendingJobsForAdmin() {
  const pendingContainer = document.getElementById("adminPendingJobs");
  pendingContainer.innerHTML = "<p class='text-gray-500'>Loading pending jobs...</p>";

  try {
    const pendingJobs = [];

    // Fetch pending tasks
    const taskSnap = await db.collection("tasks").where("status", "==", "on review").get();
    taskSnap.forEach(doc => {
      const data = doc.data();
      data.id = doc.id;
      data.type = "task";
      pendingJobs.push(data);
    });

    // Fetch pending affiliate jobs
    const affiliateSnap = await db.collection("affiliateJobs").where("status", "==", "on review").get();
    affiliateSnap.forEach(doc => {
      const data = doc.data();
      data.id = doc.id;
      data.type = "affiliate";
      pendingJobs.push(data);
    });

    // Render jobs
    if (pendingJobs.length === 0) {
      pendingContainer.innerHTML = "<p class='text-gray-500'>No jobs pending review.</p>";
      return;
    }

    pendingContainer.innerHTML = "";
    pendingJobs.forEach(job => {
      pendingContainer.innerHTML += renderJobCard(job);
    });

  } catch (error) {
    console.error("🔥 Error loading pending jobs:", error);
    pendingContainer.innerHTML = "<p class='text-red-600'>Error loading jobs.</p>";
  }
}

/* ---------- NEW: Generic renderer for a job card (used across panels) ---------- */
function renderJobCard(job) {
  // make numbers safe
  const total = Number(job.total || 0).toLocaleString();
  const poster = job.postedBy?.name || "Unknown";
  const tagClass = job.type === "task" ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600";

  return `
    <div class="p-4 border border-gray-200 shadow-sm rounded-2xl bg-white hover:shadow-md transition">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-800">${escapeHtml(job.title || "No title")}</h3>
        <span class="px-2 py-1 text-xs rounded-full ${tagClass}">${job.type || "job"}</span>
      </div>

      <p class="mt-2 text-gray-600"><strong>By:</strong> ${escapeHtml(poster)}</p>
      <p class="text-gray-600"><strong>Total:</strong> ₦${total}</p>
      <p class="text-gray-500 text-sm mt-1">Status: ${escapeHtml(job.status || "")}</p>

      <div class="mt-4 flex gap-2">
        <button onclick="openJobModal('${job.id}', '${job.type}')" class="bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 text-sm">View</button>
        <button onclick="approveJob('${job.id}', '${job.type}')" class="bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 text-sm">Approve</button>
        <button onclick="rejectJob('${job.id}', '${job.type}')" class="bg-red-600 text-white px-3 py-1 rounded-lg hover:bg-red-700 text-sm">Reject</button>
      </div>
    </div>
  `;
}

/* ---------- Escape helper to avoid injection when inserting strings into HTML ---------- */

function escapeHtml(str){
  if (str == null) return "";
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

/* ---------- Focused fetch: Tasks (pending + history) ---------- */
async function fetchTasksPanel() {
  const pendingEl = document.getElementById("tasksPending");
  const historyEl = document.getElementById("tasksHistory");

  pendingEl.innerHTML = "<p class='text-gray-500'>Loading...</p>";
  historyEl.innerHTML = "<p class='text-gray-500'>Loading...</p>";

  try {
    // pending
    const pendingSnap = await db.collection("tasks").where("status", "==", "on review").get();
    const pending = [];
    pendingSnap.forEach(d => { const data = d.data(); data.id = d.id; data.type="task"; pending.push(data); });

    // history (approved or rejected)
    const historySnap = await db.collection("tasks").where("status", "in", ["approved","rejected"]).orderBy("postedAt","desc").limit(50).get();
    const history = [];
    historySnap.forEach(d => { const data = d.data(); data.id = d.id; data.type="task"; history.push(data); });

    pendingEl.innerHTML = pending.length ? pending.map(renderJobCard).join("") : "<p class='text-gray-500'>No pending tasks.</p>";
    historyEl.innerHTML = history.length ? history.map(renderJobCard).join("") : "<p class='text-gray-500'>No task history.</p>";
  } catch (err) {
    console.error("Error fetching tasks:", err);
    pendingEl.innerHTML = "<p class='text-red-600'>Failed to load.</p>";
    historyEl.innerHTML = "<p class='text-red-600'>Failed to load.</p>";
  }
}

/* ---------- Focused fetch: Affiliates (pending + history) ---------- */
async function fetchAffiliatesPanel() {
  const pendingEl = document.getElementById("affiliatesPending");
  const historyEl = document.getElementById("affiliatesHistory");

  pendingEl.innerHTML = "<p class='text-gray-500'>Loading...</p>";
  historyEl.innerHTML = "<p class='text-gray-500'>Loading...</p>";

  try {
    const pendingSnap = await db.collection("affiliateJobs").where("status", "==", "on review").get();
    const pending = [];
    pendingSnap.forEach(d => { const data = d.data(); data.id = d.id; data.type="affiliate"; pending.push(data); });

    const historySnap = await db.collection("affiliateJobs").where("status", "in", ["approved","rejected"]).orderBy("postedAt","desc").limit(50).get();
    const history = [];
    historySnap.forEach(d => { const data = d.data(); data.id = d.id; data.type="affiliate"; history.push(data); });

    pendingEl.innerHTML = pending.length ? pending.map(renderJobCard).join("") : "<p class='text-gray-500'>No pending affiliates.</p>";
    historyEl.innerHTML = history.length ? history.map(renderJobCard).join("") : "<p class='text-gray-500'>No affiliate history.</p>";
  } catch (err) {
    console.error("Error fetching affiliates:", err);
    pendingEl.innerHTML = "<p class='text-red-600'>Failed to load.</p>";
    historyEl.innerHTML = "<p class='text-red-600'>Failed to load.</p>";
  }
}

/* ---------- Approve / Reject (kept behavior from your original functions) ---------- */
function approveJob(jobId, jobType) {
  const collectionName = jobType === "affiliate" ? "affiliateJobs" : "tasks";
  firebase.firestore().collection(collectionName).doc(jobId).update({
    status: 'approved'
  }).then(() => {
    alert('✅ Job approved successfully');
    closeJobModal();
    // refresh currently visible panel
    refreshCurrentPanel();
  }).catch((error) => {
    console.error('❌ Error approving job:', error);
    alert("Error approving job: " + error.message);
  });
}

async function rejectJob(jobId, jobType) {
  const collectionName = jobType === "affiliate" ? "affiliateJobs" : "tasks";
  try {
    await db.collection(collectionName).doc(jobId).update({ status: "rejected" });
    alert("🚫 Job rejected.");
    closeJobModal();
    refreshCurrentPanel();
  } catch (err) {
    console.error("Error rejecting job:", err);
    alert("❌ Failed to reject job.");
  }
}

/* ---------- Shared Modal logic (enhanced; shows postedBy block) ---------- */
async function openJobModal(jobId, jobType) {
  const modal = document.getElementById("jobDetailsModal");
  const content = document.getElementById("jobDetailsContent");
  const headerTitle = document.getElementById("jobDetailsTitle");
  const headerMeta = document.getElementById("jobDetailsMeta");
  const posterPhoto = document.getElementById("posterPhoto");
  const approveBtn = document.getElementById("approveBtnModal");
  const rejectBtn = document.getElementById("rejectBtnModal");

  const collectionName = jobType === "affiliate" ? "affiliateJobs" : "tasks";
  const docSnap = await db.collection(collectionName).doc(jobId).get();
  const job = docSnap.data();

  if (!job) return alert("Job not found.");

  // header
  headerTitle.textContent = job.title || "No title";
  headerMeta.textContent = `${job.type || jobType} • ${job.postedBy?.name || "Unknown"}`;

  if (job.postedBy?.photo) {
    posterPhoto.src = job.postedBy.photo;
    posterPhoto.classList.remove("hidden");
  } else {
    posterPhoto.classList.add("hidden");
  }

  // body content (type-specific)
  let html = "";
  if (jobType === "task") {
    html = `
      <p><strong>Category:</strong> ${escapeHtml(job.category || "")} ${job.subCategory ? " / " + escapeHtml(job.subCategory) : ""}</p>
      <p><strong>Description:</strong> ${escapeHtml(job.description || "—")}</p>
      <p><strong>Workers:</strong> ${escapeHtml(job.numWorkers || "0")}</p>
      <p><strong>Worker Earn:</strong> ₦${Number(job.workerEarn||0).toLocaleString()}</p>
      <p><strong>Total:</strong> ₦${Number(job.total||0).toLocaleString()}</p>
      ${job.screenshotURL ? `<img src="${job.screenshotURL}" class="w-full mt-2 rounded-lg">` : ""}
      <p class="mt-2"><strong>Proof:</strong> ${escapeHtml(job.proof || "—")}</p>
      <hr class="my-2">
      <p class="text-xs text-gray-500">Posted: ${job.postedAt ? new Date(job.postedAt.seconds * 1000).toLocaleString() : "Unknown"}</p>
    `;
  } else {
    html = `
      <p><strong>Category:</strong> ${escapeHtml(job.category || "")}</p>
      <p><strong>Instructions:</strong> ${escapeHtml(job.instructions || "—")}</p>
      <p><strong>Target Link:</strong> ${job.targetLink ? `<a href="${job.targetLink}" target="_blank" class="text-blue-600 underline">${escapeHtml(job.targetLink)}</a>` : "—"}</p>
      <p><strong>Workers:</strong> ${escapeHtml(job.numWorkers || "0")}</p>
      <p><strong>Worker Pay:</strong> ₦${Number(job.workerPay||0).toLocaleString()}</p>
      <p><strong>Total:</strong> ₦${Number(job.total||0).toLocaleString()}</p>
      ${job.campaignLogoURL ? `<img src="${job.campaignLogoURL}" class="w-full mt-2 rounded-lg">` : ""}
      <p class="mt-2"><strong>Proof Required:</strong> ${escapeHtml(job.proofRequired ? job.proofRequired.toString() : "—")}</p>
      <hr class="my-2">
      <p class="text-xs text-gray-500">Posted: ${job.postedAt ? new Date(job.postedAt.seconds * 1000).toLocaleString() : "Unknown"}</p>
    `;
  }

  content.innerHTML = html;
  modal.classList.remove("hidden");

  // Attach actions
  approveBtn.onclick = () => approveJob(jobId, jobType);
  rejectBtn.onclick = () => rejectJob(jobId, jobType);
}

function closeJobModal() {
  document.getElementById("jobDetailsModal").classList.add("hidden");
}

/* ---------- Tab switching + refresh helpers ---------- */
function hideAllPanels() {
  document.getElementById("panelAll").classList.add("hidden");
  document.getElementById("panelTasks").classList.add("hidden");
  document.getElementById("panelAffiliates").classList.add("hidden");
}

function refreshCurrentPanel() {
  if (!document.getElementById("panelAll").classList.contains("hidden")) {
    fetchPendingJobsForAdmin();
  } else if (!document.getElementById("panelTasks").classList.contains("hidden")) {
    fetchTasksPanel();
  } else if (!document.getElementById("panelAffiliates").classList.contains("hidden")) {
    fetchAffiliatesPanel();
  }
}

/* ---------- Init: wire UI + default loads ---------- */
document.getElementById("tabAll").addEventListener("click", () => {
  hideAllPanels();
  document.getElementById("panelAll").classList.remove("hidden");
  // visual active styles
  setActiveTab("tabAll");
  fetchPendingJobsForAdmin();
});

document.getElementById("tabTasks").addEventListener("click", () => {
  hideAllPanels();
  document.getElementById("panelTasks").classList.remove("hidden");
  setActiveTab("tabTasks");
  fetchTasksPanel();
});

document.getElementById("tabAffiliates").addEventListener("click", () => {
  hideAllPanels();
  document.getElementById("panelAffiliates").classList.remove("hidden");
  setActiveTab("tabAffiliates");
  fetchAffiliatesPanel();
});

document.getElementById("refreshTasksBtn").addEventListener("click", fetchTasksPanel);
document.getElementById("refreshAffiliatesBtn").addEventListener("click", fetchAffiliatesPanel);

function setActiveTab(tabId) {
  ["tabAll","tabTasks","tabAffiliates"].forEach(id => {
    const el = document.getElementById(id);
    if (id === tabId) {
      el.classList.add("bg-gray-100");
    } else {
      el.classList.remove("bg-gray-100");
    }
  });
}

/* ---------- Initial load (show All by default) ---------- */
setActiveTab("tabAll");
fetchPendingJobsForAdmin();








async function loadTaskSubmissions() {
  const container = document.getElementById("task-submissions-list");
  container.innerHTML = "Loading submissions...";

  const snap = await db.collection("task_submissions").where("status", "==", "on review").get();

  if (snap.empty) {
    container.innerHTML = "<p>No task submissions to review.</p>";
    return;
  }

  container.innerHTML = "";

  for (const doc of snap.docs) {
    const submission = doc.data();
    const id = doc.id;

    const taskRef = await db.collection("tasks").doc(submission.taskId).get();
    const task = taskRef.data();

    const div = document.createElement("div");
    div.className = "bg-white border p-4 rounded-lg shadow mb-4";
	
    
div.innerHTML = `
  <p><strong>Task:</strong> ${task?.title || "Unknown Task"}</p>
  <p><strong>User ID:</strong> ${submission.userId}</p>
  <p><strong>Proof:</strong> ${submission.proofText}</p>
  <div>${(submission.proofImages || []).map(url => `<img src="${url}" class="w-32 mt-2 rounded border" />`).join("")}</div>
  <div class="mt-4 flex flex-wrap gap-3">
    <button onclick="reviewSubmission('${id}', '${submission.taskId}')" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow">👁️ Review Task</button>
    <button onclick="approveSubmission('${id}', '${submission.userId}', ${submission.workerEarn})" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow">✅ Approve</button>
    <button onclick="rejectSubmission('${id}')" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg shadow">❌ Reject</button>
  </div>
`;


	
    container.appendChild(div);
  }
}







async function reviewSubmission(submissionId, taskId) {
  document.getElementById("task-submissions-list").classList.add("hidden");
  document.getElementById("review-section").classList.remove("hidden");

  const subDoc = await db.collection("task_submissions").doc(submissionId).get();
  const submission = subDoc.data();

  const taskDoc = await db.collection("tasks").doc(taskId).get();
  const task = taskDoc.data();

  const review = document.getElementById("review-content");
  review.innerHTML = `
    <h2 class="text-2xl font-bold mb-4 text-gray-800">📝 Task Submission Review</h2>

    <!-- Advertiser Info -->
    <div class="mb-6 border-b pb-4">
      <h3 class="text-xl font-semibold text-gray-700 mb-2">📢 Advertiser's Task Info</h3>
      <p><strong>Task Title:</strong> ${task?.title}</p>
      <p><strong>Description:</strong> ${task?.description}</p>
      <p><strong>Proof Required:</strong> ${task?.proof || "No proof instruction provided."}</p>
      ${task?.screenshotURL ? `<img src="${task.screenshotURL}" class="w-full h-64 object-cover rounded-lg border mt-3" />` : ""}
    </div>

    <!-- Worker Submission -->
    <div>
      <h3 class="text-xl font-semibold text-gray-700 mb-2">👤 Worker Submission</h3>
      <p><strong>Submitted By:</strong> ${submission.userId}</p>
      <p><strong>Text Proof:</strong> ${submission.proofText || "None provided"}</p>

      <div class="flex flex-wrap gap-4 mt-3">
        ${(submission.proofImages || []).map(url => `<img src="${url}" class="w-40 h-40 object-cover rounded-lg border shadow" />`).join("")}
      </div>

      <p class="mt-4"><strong>Status:</strong> ${submission.status}</p>
      <p><strong>Amount To Earn:</strong> ₦${submission.workerEarn}</p>
    </div>
  `;
}





function backToSubmissions() {
  document.getElementById("review-section").classList.add("hidden");
  document.getElementById("task-submissions-list").classList.remove("hidden");
}







async function approveSubmission(submissionId, userId, amount) {
  const userRef = db.collection("users").doc(userId);

  await db.runTransaction(async (t) => {
    const userDoc = await t.get(userRef);
    const currentBalance = userDoc.data().balance || 0;
    t.update(userRef, { balance: currentBalance + amount });

    const submissionRef = db.collection("task_submissions").doc(submissionId);
    t.update(submissionRef, { status: "approved" });
  });

  alert("✅ Submission approved and user credited.");
  loadTaskSubmissions();
}

async function rejectSubmission(submissionId) {
  await db.collection("task_submissions").doc(submissionId).update({
    status: "rejected"
  });
  alert("❌ Submission rejected.");
  loadTaskSubmissions();
}







// --- Upload to Cloudinary helper ---
async function uploadToCloudinary(file) {
  const url = `https://api.cloudinary.com/v1_1/dyquovrg3/image/upload`;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", "globals_tasks_proofs");
  const res = await fetch(url, { method: "POST", body: formData });
  const data = await res.json();
  if (!data.secure_url) throw new Error("Upload failed");
  return data.secure_url;
}

// --- Submit Admin Job ---
async function submitAdminJob() {
  const category = document.getElementById("adminJobCategory").value.trim();
  const title = document.getElementById("adminJobTitle").value.trim();
  const instructions = document.getElementById("adminJobInstructions").value.trim();
  const targetLink = document.getElementById("adminJobTargetLink").value.trim();
  const proofRequired = document.getElementById("adminJobProofRequired").value.trim();
  const numWorkers = parseInt(document.getElementById("adminJobNumWorkers").value);
  const workerPay = parseInt(document.getElementById("adminJobWorkerPay").value);
  const proofFileCount = parseInt(document.getElementById("adminJobProofFileCount").value || "1");
  const campaignLogoFile = document.getElementById("adminJobLogoFile").files[0];

  if (!category || !title || !instructions || !targetLink || !proofRequired || !numWorkers || !workerPay) {
    alert("⚠️ Please fill in all required fields.");
    return;
  }

  let campaignLogoURL = "";
  if (campaignLogoFile) {
    try {
      campaignLogoURL = await uploadToCloudinary(campaignLogoFile);
    } catch (err) {
      console.error("Logo upload failed:", err);
      alert("❌ Logo upload failed.");
      return;
    }
  }

  const jobData = {
    jobType: "admin",
    category,
    title,
    instructions,
    targetLink,
    proofRequired,
    numWorkers,
    workerPay,
    proofFileCount,
    campaignLogoURL,
    status: "active",
    postedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    await db.collection("adminJobs").add(jobData);
    alert("✅ Admin job posted!");
    // clear form
    document.querySelectorAll("#adminPostJob input, #adminPostJob textarea").forEach(el => el.value = "");
  } catch (error) {
    console.error(error);
    alert("❌ Failed to post job.");
  }
}









                       // Switch tabs (TikTok / WhatsApp / Telegram)




/* ------------------ Configuration (edit if your naming differs) ------------------ */
const USERS_COLLECTION = "users";            // change if your users collection has a different name
const TRANSACTIONS_COLLECTION = "transactions"; // where to record transaction logs
const PAGE_SIZE = 12;
const REWARDS = { TiktokInstagram: 2000, Whatsapp: 300, Telegram: 300 };

/* ------------------ State ------------------ */

let currentCollection = "TiktokInstagram";
let statusFilter = "pending"; // pending | approved | rejected | all
let sortOrder = "newest"; // newest | oldest
let searchQuery = "";
let startDate = null;
let endDate = null;
let lastVisible = null;
let moreAvailable = false;
let loading = false;
let debounceTimer = null;

/* ------------------ Helpers ------------------ */
function formatTimestamp(ts) {
  try {
    if (!ts) return "N/A";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString();
  } catch(e) { return "N/A"; }
}

function filterStatusValue(f) { return f === "pending" ? "on review" : f; }

/* ------------------ UI small helpers ------------------ */
function setActiveCollectionBtn(el) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  if (el) el.classList.add("active");
}
function setActiveFilterBtn(el) {
  document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
  if (el) el.classList.add("active");
}

/* ------------------ Public UI functions (used by HTML) ------------------ */
function setCollection(col, el) {
  currentCollection = col;
  setActiveCollectionBtn(el);
  resetAndLoad(true);
}
function setStatusFilter(f, el) {
  statusFilter = f;
  setActiveFilterBtn(el);
  resetAndLoad(true);
}
function setSort(val) {
  sortOrder = val;
  resetAndLoad(true);
}
function setDateRange() {
  const s = document.getElementById("startDate").value;
  const e = document.getElementById("endDate").value;
  startDate = s ? new Date(s) : null;
  endDate = e ? new Date(e) : null;
  // normalize endDate to include full day
  if (endDate) { endDate.setHours(23,59,59,999); }
  resetAndLoad(true);
}
document.getElementById("searchInput").addEventListener("input", (ev) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    searchQuery = ev.target.value.trim().toLowerCase();
    resetAndLoad(true);
  }, 350);
});
document.getElementById("refreshBtn").addEventListener("click", () => resetAndLoad(true));
document.getElementById("loadMoreBtn").addEventListener("click", () => loadTasks(false));

/* ------------------ Image modal ------------------ */
function openImageModal(src) {
  document.getElementById("imageModalImg").src = src;
  document.getElementById("imageModal").classList.remove("hidden");
}
function closeImageModal() {
  document.getElementById("imageModalImg").src = "";
  document.getElementById("imageModal").classList.add("hidden");
}

/* ------------------ Confirm modal ------------------ */
let confirmParams = null;
function openConfirmModal({title, text, isReject=false, onConfirm}) {
  confirmParams = { onConfirm, isReject };
  document.getElementById("confirmTitle").innerText = title;
  document.getElementById("confirmText").innerText = text;
  document.getElementById("rejectReasonWrap").classList.toggle("hidden", !isReject);
  document.getElementById("rejectReason").value = "";
  document.getElementById("confirmActionBtn").innerText = isReject ? "Reject" : "Approve";
  document.getElementById("confirmActionBtn").classList.toggle("bg-red-500", isReject);
  document.getElementById("confirmActionBtn").classList.toggle("bg-green-500", !isReject);
  document.getElementById("confirmModal").classList.remove("hidden");
}
function closeConfirmModal() {
  confirmParams = null;
  document.getElementById("confirmModal").classList.add("hidden");
}
document.getElementById("confirmActionBtn").addEventListener("click", async () => {
  if (!confirmParams) return closeConfirmModal();
  const reason = document.getElementById("rejectReason").value.trim();
  try {
    await confirmParams.onConfirm(reason);
  } catch (e) {
    console.error(e);
    alert("Action failed: " + (e?.message || e));
  } finally {
    closeConfirmModal();
  }
});

/* ------------------ Load stats ------------------ */
async function loadTaskStats(collectionName) {
  try {
    const base = db.collection(collectionName);
    const [pendingSnap, approvedSnap, rejectedSnap] = await Promise.all([
      base.where("status", "==", "on review").get(),
      base.where("status", "==", "approved").get(),
      base.where("status", "==", "rejected").get()
    ]);
    document.getElementById("pendingCount").innerText = pendingSnap.size;
    document.getElementById("approvedCount").innerText = approvedSnap.size;
    document.getElementById("rejectedCount").innerText = rejectedSnap.size;
  } catch (err) {
    console.error("Stats load error:", err);
  }
}

/* ------------------ Render helper ------------------ */
function renderTasks(tasks, reset = true, showLoadMore = false) {
  const container = document.getElementById("tasksContainer");
  if (reset) container.innerHTML = "";
  if (!tasks || tasks.length === 0) {
    if (reset) container.innerHTML = `<div class="col-span-full text-center text-gray-400">😕 No tasks found</div>`;
    document.getElementById("loadMoreBtn").classList.add("hidden");
    return;
  }

  tasks.forEach(task => {
    const card = document.createElement("div");
    card.className = "task-card";

    // status badge
    let badgeClass = "task-badge badge-pending";
    if (task.status === "approved") badgeClass = "task-badge badge-approved";
    if (task.status === "rejected") badgeClass = "task-badge badge-rejected";

    // images (proofs)
    let imgsHtml = "";
    if (task.screenshot) imgsHtml += `<img src="${task.screenshot}" onclick="openImageModal('${task.screenshot}')" class="task-thumb" />`;
    if (task.proofs && Array.isArray(task.proofs)) {
      task.proofs.forEach(url => imgsHtml += `<img src="${url}" onclick="openImageModal('${url}')" class="task-thumb" />`);
    }

    // group links
    const groupsHtml = task.groupLinks ? `<p class="task-meta"><b>Groups:</b> ${task.groupLinks.join(", ")}</p>` : "";

    card.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div style="flex:1;">
          <p class="task-meta"><b>User ID:</b> <a href="/admin/users/${task.submittedBy}" target="_blank" class="text-blue-600 underline">${task.submittedBy || "N/A"}</a></p>
          <p class="task-meta"><b>Status:</b> <span class="${badgeClass}">${task.status}</span></p>
          ${task.username ? `<p class="task-meta"><b>Username:</b> ${task.username}</p>`: ""}
          ${task.whatsappNumber ? `<p class="task-meta"><b>WhatsApp:</b> ${task.whatsappNumber}</p>`: ""}
          ${task.profileLink ? `<p class="task-meta"><b>Profile:</b> <a href="${task.profileLink}" target="_blank" class="text-blue-600 underline">Open</a></p>` : ""}
          ${task.videoLink ? `<p class="task-meta"><b>Video:</b> <a href="${task.videoLink}" target="_blank" class="text-blue-600 underline">Watch</a></p>` : ""}
          ${groupsHtml}
          <p class="task-meta"><b>Submitted At:</b> ${formatTimestamp(task.submittedAt)}</p>
          <p class="task-meta"><b>Doc ID:</b> ${task.id}</p>
        </div>
        <div style="min-width:120px; text-align:right;">
          <div>${imgsHtml}</div>
        </div>
      </div>
    `;

    // action buttons (only if on review/pending)
    if (task.status === "on review") {
      const actionsWrap = document.createElement("div");
      actionsWrap.className = "flex gap-2 mt-4";

      const approveBtn = document.createElement("button");
      approveBtn.className = "action-btn approve-btn";
      approveBtn.innerText = "✅ Approve";
      approveBtn.onclick = () => {
        openConfirmModal({
          title: "Approve Task",
          text: `Approve this task and credit user ${task.submittedBy} with ${REWARDS[currentCollection] || 0} units?`,
          isReject: false,
          onConfirm: async () => await reviewTaskTransaction(task.id, true, task)
        });
      };

      const rejectBtn = document.createElement("button");
      rejectBtn.className = "action-btn reject-btn";
      rejectBtn.innerText = "❌ Reject";
      rejectBtn.onclick = () => {
        openConfirmModal({
          title: "Reject Task",
          text: `Reject this task? Optionally provide a reason below.`,
          isReject: true,
          onConfirm: async (reason) => await reviewTaskTransaction(task.id, false, task, reason)
        });
      };

      actionsWrap.appendChild(approveBtn);
      actionsWrap.appendChild(rejectBtn);
      card.appendChild(actionsWrap);
    }

    document.getElementById("tasksContainer").appendChild(card);
  });

  // load more visibility
  const loadMoreBtn = document.getElementById("loadMoreBtn");
  if (showLoadMore && moreAvailable) loadMoreBtn.classList.remove("hidden");
  else loadMoreBtn.classList.add("hidden");
}

/* ------------------ Main loader (with basic client-side search & date filtering) ------------------ */
async function loadTasks(reset = true) {
  if (loading) return;
  loading = true;
  const container = document.getElementById("tasksContainer");
  if (reset) {
    container.innerHTML = `<div class="col-span-full text-center text-gray-500">⏳ Loading tasks...</div>`;
    lastVisible = null;
    moreAvailable = false;
  } else {
    document.getElementById("loadMoreBtn").innerText = "Loading...";
  }

  try {
    await loadTaskStats(currentCollection);

    // Build base query
    let q = db.collection(currentCollection);
    if (statusFilter !== "all") q = q.where("status", "==", filterStatusValue(statusFilter));
    // order
    q = q.orderBy("submittedAt", sortOrder === "newest" ? "desc" : "asc");

    // Pagination: if no search & no date filters, we paginate server-side
    const useServerPagination = !searchQuery && !startDate && !endDate;

    let snap;
    if (useServerPagination) {
      if (lastVisible) q = q.startAfter(lastVisible);
      q = q.limit(PAGE_SIZE);
      snap = await q.get();
      if (snap.docs.length > 0) lastVisible = snap.docs[snap.docs.length - 1];
      moreAvailable = snap.docs.length === PAGE_SIZE;
    } else {
      // search/date present -> fetch larger set and filter client-side
      const MAX_FETCH = 400;
      q = q.limit(MAX_FETCH);
      snap = await q.get();
      moreAvailable = false;
    }

    const docs = (snap && !snap.empty) ? snap.docs.map(d => ({ id: d.id, ...d.data() })) : [];

    // client-side filtering for search & date range (works even when server-side pagination used;
    // for server pagination we only receive PAGE_SIZE docs though)
    let filtered = docs.filter(doc => {
      // date filter
      if (startDate || endDate) {
        const t = doc.submittedAt ? (doc.submittedAt.toDate ? doc.submittedAt.toDate() : new Date(doc.submittedAt)) : null;
        if (startDate && (!t || t < startDate)) return false;
        if (endDate && (!t || t > endDate)) return false;
      }
      // search filter
      if (searchQuery) {
        const hay = [
          doc.submittedBy || "",
          doc.username || "",
          doc.profileLink || "",
          doc.videoLink || "",
          (doc.groupLinks || []).join(" ")
        ].join(" ").toLowerCase();
        if (!hay.includes(searchQuery)) return false;
      }
      return true;
    });

    // If we fetched more than PAGE_SIZE because of search/filters, slice results
    let toShow = filtered;
    if (useServerPagination) {
      // server pagination case: show what we have (docs already limited)
      toShow = filtered;
    } else {
      toShow = filtered.slice(0, PAGE_SIZE);
      moreAvailable = filtered.length > PAGE_SIZE;
      // if filtered results are less than PAGE_SIZE but less than original snap, we can show all filtered
    }

    renderTasks(toShow, reset, moreAvailable);
  } catch (err) {
    console.error("Error loading tasks:", err);
    document.getElementById("tasksContainer").innerHTML = `<div class="text-red-500">⚠️ Failed to load tasks</div>`;
  } finally {
    loading = false;
    document.getElementById("loadMoreBtn").innerText = "Load more";
  }
}

/* ------------------ Approve/Reject safe transaction ------------------ */
async function reviewTaskTransaction(docId, approve = true, taskDoc = null, rejectReason = "") {
  // run a firestore transaction to avoid double crediting
  const rewardAmount = approve ? (REWARDS[currentCollection] || 0) : 0;
  const adminUid = (firebase.auth().currentUser && firebase.auth().currentUser.uid) ? firebase.auth().currentUser.uid : "admin";

  try {
    await db.runTransaction(async tx => {
      const taskRef = db.collection(currentCollection).doc(docId);
      const taskSnap = await tx.get(taskRef);
      if (!taskSnap.exists) throw new Error("Task not found");

      const task = taskSnap.data();
      // already finalised?
      if (task.status === "approved" && approve) throw new Error("Task already approved");
      if (task.status === "rejected" && !approve) throw new Error("Task already rejected");

      // update task doc
      const updatePayload = {
        status: approve ? "approved" : "rejected",
        reviewedBy: adminUid,
        reviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
        reviewReason: rejectReason || "",
        reward: approve ? rewardAmount : 0
      };
      tx.update(taskRef, updatePayload);

      if (approve) {
        // credit user balance (assumes users collection and 'balance' numeric field)
        if (!task.submittedBy) throw new Error("Task missing submittedBy");
        const userRef = db.collection(USERS_COLLECTION).doc(task.submittedBy);
        tx.update(userRef, { balance: firebase.firestore.FieldValue.increment(rewardAmount) });

        // create a transaction record
        const txnRef = db.collection(TRANSACTIONS_COLLECTION).doc();
        tx.set(txnRef, {
          userId: task.submittedBy,
          amount: rewardAmount,
          type: "social_task_reward",
          collection: currentCollection,
          taskId: docId,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          note: `Reward for ${currentCollection} task approved by admin ${adminUid}`
        });
      }
    });

    alert(approve ? "✅ Task approved and user credited." : "❌ Task rejected.");
    // refresh
    await loadTaskStats(currentCollection);
    // reload the list fresh
    resetAndLoad(true);
  } catch (err) {
    console.error("Transaction error:", err);
    alert("⚠️ Action failed: " + (err?.message || err));
    // if error mentions already approved, still refresh to reflect actual state
    resetAndLoad(true);
  }
}

/* ------------------ reset helper ------------------ */
function resetAndLoad(reset = true) {
  lastVisible = null;
  moreAvailable = false;
  loadTasks(reset);
}

/* ------------------ initial load — auth-gated ------------------ */
// loadTasks is called when the user opens the manage-jobs tab after sign-in.
// It must NOT fire on DOMContentLoaded because auth isn't confirmed yet.
// The switchTab() handler or the nav-btn click will trigger it instead.
// We keep setCollection/setStatusFilter (pure UI, no Firestore) here.
document.addEventListener("DOMContentLoaded", () => {
  setCollection(currentCollection, document.querySelector(".tab-btn"));
  setStatusFilter(statusFilter, document.querySelector(".filter-btn"));
  // loadTasks(true) removed — called on tab open after auth
});



 








// ===== Airtime/Data Admin Review =====

        
// ═══════════════════════════════════════════════════
//  VTU BILLS MODULE — all 6 service types
// ═══════════════════════════════════════════════════════════════════
//  VTU BILLS MODULE
//  VTPass auto-processes all orders. No approve/reject needed.
//  Status values: 'processing' | 'success' | 'failed'
// ═══════════════════════════════════════════════════════════════════
let currentBillType   = 'airtime';
let currentBillStatus = 'processing';   // matches VTPass status values
let billsUnsub        = null;

const BILL_TYPE_LABELS = {
  airtime:'📱 Airtime', data:'📶 Data', electricity:'⚡ Electricity',
  tv:'📺 TV', betting:'🎰 Betting', education:'🎓 Education',
};
const BILL_TAB_IDS  = ['tab-airtime','tab-data','tab-electricity','tab-tv','tab-betting','tab-education'];
const BILL_TYPES_AR = ['airtime','data','electricity','tv','betting','education'];

function switchBillType(type)   { currentBillType   = type;   updateBillTabs();    loadBillsAdmin(); }
function switchBillStatus(status){ currentBillStatus = status; updateBillSubtabs(); loadBillsAdmin(); }

function updateBillTabs() {
  BILL_TYPES_AR.forEach((t,i) => {
    const el = document.getElementById(BILL_TAB_IDS[i]); if (!el) return;
    el.className = t === currentBillType
      ? 'px-4 py-2 font-medium text-blue-600 border-b-2 border-blue-600'
      : 'px-4 py-2 font-medium text-gray-500 hover:text-blue-600';
  });
  const ttl = document.getElementById('bills-section-title');
  if (ttl) ttl.textContent = (BILL_TYPE_LABELS[currentBillType]||currentBillType) + ' Transactions';
}

function updateBillSubtabs() {
  const styles = {
    processing: 'px-5 py-2 text-sm font-medium rounded-full bg-yellow-500 text-white shadow-md',
    success:    'px-5 py-2 text-sm font-medium rounded-full bg-green-600 text-white shadow-md',
    failed:     'px-5 py-2 text-sm font-medium rounded-full bg-red-600 text-white shadow-md',
  };
  const inactive = 'px-5 py-2 text-sm font-medium rounded-full text-gray-600 hover:text-blue-600';
  ['processing','success','failed'].forEach(s => {
    const id = s === 'processing' ? 'subtab-pending' : `subtab-${s}`;
    const el = document.getElementById(id); if (!el) return;
    el.className = s === currentBillStatus ? (styles[s]||inactive) : inactive;
  });
}

function _billExtraFields(data) {
  const t = (data.type||'').toLowerCase();
  if (t === 'electricity') return `
    ${data.meterNumber  ? `<p><b>🔌 Meter:</b> ${data.meterNumber}</p>`  : ''}
    ${data.meterName    ? `<p><b>👤 Name:</b> ${data.meterName}</p>`     : ''}
    ${data.meterType    ? `<p><b>🔧 Type:</b> ${data.meterType}</p>`     : ''}
    ${data.serviceID    ? `<p><b>🏢 Provider:</b> ${data.serviceID}</p>` : ''}`;
  if (t === 'tv') return `
    ${data.smartcard    ? `<p><b>📺 Smartcard:</b> ${data.smartcard}</p>`  : ''}
    ${data.customerName ? `<p><b>👤 Name:</b> ${data.customerName}</p>`   : ''}
    ${data.planName     ? `<p><b>📦 Plan:</b> ${data.planName}</p>`       : ''}
    ${data.serviceID    ? `<p><b>🏢 Provider:</b> ${data.serviceID}</p>`  : ''}`;
  if (t === 'betting') return `
    ${data.customerId   ? `<p><b>🆔 ID:</b> ${data.customerId}</p>`       : ''}
    ${data.customerName ? `<p><b>👤 Name:</b> ${data.customerName}</p>`   : ''}
    ${data.serviceID    ? `<p><b>🏢 Platform:</b> ${data.serviceID}</p>`  : ''}`;
  if (t === 'education') return `
    ${data.phone     ? `<p><b>📱 Phone:</b> ${data.phone}</p>`            : ''}
    ${data.serviceID ? `<p><b>🎓 Exam:</b> ${data.serviceID.toUpperCase()}</p>` : ''}
    ${data.variationCode ? `<p><b>📋 Variation:</b> ${data.variationCode}</p>` : ''}`;
  return `
    ${(data.phone||data.phoneNumber) ? `<p><b>📱 Phone:</b> ${data.phone||data.phoneNumber}</p>` : ''}
    ${(data.network||data.networkLabel) ? `<p><b>🌐 Network:</b> ${data.network||data.networkLabel}</p>` : ''}
    ${data.planLabel ? `<p><b>📦 Plan:</b> ${data.planLabel}</p>` : ''}`;
}

function _fmtDate(ts) {
  if (!ts) return 'N/A';
  try { return (ts.toDate ? ts.toDate() : new Date(ts)).toLocaleString('en-NG'); } catch { return 'N/A'; }
}

function loadBillsAdmin() {
  const container = document.getElementById('billsContainer');
  if (!container) return;
  container.innerHTML = '<div class="text-center py-12 text-gray-500 animate-pulse">Loading…</div>';
  if (billsUnsub) { billsUnsub(); billsUnsub = null; }

  // Query by status directly — VTPass sets 'processing'/'success'/'failed'
  // bill_submissions uses 'createdAt' as timestamp field
  let q = db.collection('bill_submissions').orderBy('createdAt','desc').limit(150);

  billsUnsub = q.onSnapshot(snap => {
    container.innerHTML = '';
    const docs = snap.docs.filter(doc => {
      const d = doc.data();
      const raw = (d.type||'').toLowerCase();
      const docType = ['electricity','tv','betting','education','data'].includes(raw) ? raw : 'airtime';
      if (docType !== currentBillType) return false;
      // status filter — 'processing' also catches legacy 'pending' status
      const st = (d.status||'processing').toLowerCase();
      if (currentBillStatus === 'processing') return st === 'processing' || st === 'pending';
      if (currentBillStatus === 'success')    return st === 'success' || st === 'successful';
      if (currentBillStatus === 'failed')     return st === 'failed';
      return true;
    });

    if (!docs.length) {
      container.innerHTML = `<div class="text-center py-16 text-gray-400">📭 No ${BILL_TYPE_LABELS[currentBillType]||currentBillType} ${currentBillStatus} transactions</div>`;
      return;
    }

    docs.forEach(doc => {
      const d = doc.data();
      const st = (d.status||'processing').toLowerCase();
      const raw = (d.type||'').toLowerCase();
      const docType = ['electricity','tv','betting','education','data'].includes(raw) ? raw : 'airtime';

      const badge = (st === 'success' || st === 'successful')
        ? '<span class="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">✅ Delivered</span>'
        : st === 'failed'
          ? '<span class="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">❌ Failed</span>'
          : '<span class="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">⏳ Processing</span>';

      const card = document.createElement('div');
      card.className = 'rounded-2xl bg-white shadow-md hover:shadow-lg transition p-5';
      card.id = `bill-${doc.id}`;
      card.innerHTML = `
        <div class="flex items-center justify-between mb-3">
          <span class="text-sm font-semibold uppercase tracking-wide text-gray-500">${BILL_TYPE_LABELS[docType]||docType}</span>
          ${badge}
        </div>
        <h3 class="text-lg font-bold text-gray-800 mb-2">₦${Number(d.amount||0).toLocaleString()}</h3>
        <div class="space-y-1 text-sm text-gray-600">
          ${_billExtraFields(d)}
          <p><b>👤 User ID:</b> <span class="font-mono text-xs">${d.userId||'N/A'}</span></p>
          <p><b>🕒 Date:</b> ${_fmtDate(d.createdAt)}</p>
          ${d.requestId ? `<p><b>🔑 Ref:</b> <span class="font-mono text-xs">${d.requestId}</span></p>` : ''}
          ${d.vtpassRef ? `<p><b>📡 VTPass Ref:</b> <span class="font-mono text-xs">${d.vtpassRef}</span></p>` : ''}
          ${d.failReason ? `<p class="text-red-600"><b>⚠️ Reason:</b> ${d.failReason}</p>` : ''}
        </div>`;
      container.appendChild(card);
    });
  }, err => {
    console.error('[VTU bills]', err);
    container.innerHTML = `<div class="text-center py-8 text-red-500">Error loading: ${err.message}</div>`;
  });
}

// ── Requery stuck processing orders via server ──────────────────────
async function vtuRequeryStuck() {
  const btn = document.getElementById('vtu-requery-btn');
  const status = document.getElementById('vtu-requery-status');
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = '⏳ Querying…';
  if (status) status.textContent = '';

  try {
    // Get all processing orders older than 3 minutes
    const cutoff = new Date(Date.now() - 3 * 60 * 1000);
    const snap = await db.collection('bill_submissions')
      .where('status','==','processing')
      .orderBy('createdAt','asc')
      .limit(20)
      .get();

    if (snap.empty) {
      if (status) status.textContent = '✅ No stuck orders found.';
      btn.disabled = false; btn.textContent = '🔁 Requery Stuck Orders';
      return;
    }

    let resolved = 0;
    for (const doc of snap.docs) {
      const d = doc.data();
      const requestId = d.requestId || doc.id;
      try {
        // Call server requery endpoint
        const user = firebase.auth().currentUser;
        if (!user) continue;
        const token = await user.getIdToken();
        const res = await fetch('/api/vtu/requery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({ requestId }),
        });
        const data = await res.json();
        if (data.status === 'success') resolved++;
      } catch(e) { console.warn('[requery]', requestId, e.message); }
    }

    if (status) status.textContent = `✅ Queried ${snap.size} orders, ${resolved} resolved.`;
    loadBillsAdmin(); // refresh view
  } catch(e) {
    console.error('[vtuRequeryStuck]', e);
    if (status) status.textContent = '❌ Error: ' + e.message;
  }
  btn.disabled = false;
  btn.textContent = '🔁 Requery Stuck Orders';
}
window.vtuRequeryStuck = vtuRequeryStuck;

// REFERRAL FUNCTION 



/*
 Admin Referral Module (single-block)
 - Paste after firebase init
 - Exposes window.startAdminReferrals() and window.stopAdminReferrals()
 - Non-scattered; all logic contained here
*/
(function AdminReferralModule(){
  // ---------- CONFIG ----------
  const REWARD_AMOUNT = 500; // must match your payment logic
  const QUICK_SCAN_LIMIT = 1000; // quick scan cap
  let allUsersCache = []; // cached user docs (objects with id & fields)
  let referrerUserCache = new Map(); // username => userDoc (to get uid/displayName quickly)
  let pollingInterval = null;
  let realtimeEnabled = false;

  // ---------- HELPERS ----------
  function money(n){ return '₦' + Number(n || 0).toLocaleString(); }
  function safeEl(id){ return document.getElementById(id); }

  function toDateVal(v){
    if (!v) return null;
    if (typeof v.toDate === 'function') return v.toDate();
    if (v._seconds || v.seconds) { const s = v._seconds || v.seconds; return new Date(s * 1000); }
    if (typeof v === 'number') { return v > 1e12 ? new Date(v) : new Date(v * 1000); }
    if (typeof v === 'string') { const p = Date.parse(v); return isNaN(p) ? null : new Date(p); }
    return null;
  }

  function escapeHtml(s){ if (s===null||s===undefined) return ''; return String(s).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]); }

  // ---------- RENDER: Summary ----------
  function renderSummary(stats){
    safeEl('ref-total-referred').innerText = stats.totalReferred;
    safeEl('ref-total-awarded').innerText = money(stats.totalAwarded);
    safeEl('ref-total-pending').innerText = money(stats.totalPending);
    safeEl('ref-total-referrers').innerText = stats.totalReferrers;
  }

  // ---------- RENDER: Top referrers ----------
  function renderTop(list){
    const box = safeEl('ref-top-list');
    box.innerHTML = '';
    (list.slice(0,6)).forEach(r => {
      const div = document.createElement('div');
      div.className = 'p-3 rounded-xl bg-white/5 flex items-center justify-between';
      div.innerHTML = `
        <div>
          <div class="font-semibold">${escapeHtml(r.username)}</div>
          <div class="text-xs text-slate-300">${escapeHtml(r.displayName || r.email || '')}</div>
        </div>
        <div class="text-right">
          <div class="font-bold">${r.totalReferred}</div>
          <div class="text-xs text-gray-400">${money(r.totalRewards)}</div>
        </div>
      `;
      box.appendChild(div);
    });
  }

  // ---------- RENDER: Table ----------
  function renderTable(refMapArr){
    const tbody = safeEl('ref-table-body');
    tbody.innerHTML = '';
    if (refMapArr.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="p-6 text-center text-gray-400">No referrers found</td></tr>';
      return;
    }
    refMapArr.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="px-3 py-2"><div class="font-mono text-xs">${escapeHtml(r.username)}</div></td>
        <td class="px-3 py-2"><div class="font-medium">${escapeHtml(r.displayName || '')}</div><div class="text-xs text-slate-300">${escapeHtml(r.email || '')}</div></td>
        <td class="px-3 py-2"><div class="font-semibold">${r.totalReferred}</div></td>
        <td class="px-3 py-2">${r.awardedCount}</td>
        <td class="px-3 py-2">${r.pendingCount}</td>
        <td class="px-3 py-2 font-bold">${money(r.totalRewards)}</td>
        <td class="px-3 py-2">
          <button class="px-3 py-1 rounded-lg bg-white/6" data-ref="${escapeHtml(r.username)}">Details</button>
        </td>
      `;
      tbody.appendChild(tr);
      // wire details button
      tr.querySelector('button')?.addEventListener('click', () => showReferrerDetails(r.username));
    });
  }

  // ---------- AGGREGATION LOGIC ----------
  async function aggregateFromUsers(users){
    // users: array of docs with fields including .referrer (username), .is_Premium, .referralBonusCredited
    const map = new Map(); // username => stats
    let totalReferred = 0, totalAwarded = 0, totalPending = 0;
    for (const u of users){
      const ref = u.referrer || null;
      if (!ref) continue;
      totalReferred++;
      const isPremium = !!u.is_Premium;
      const credited = !!u.referralBonusCredited;
      if (!map.has(ref)) map.set(ref, { username: ref, totalReferred: 0, awardedCount:0, pendingCount:0, totalRewards:0, displayName:'', email:'', uidOfReferrer:null });
      const ent = map.get(ref);
      ent.totalReferred += 1;
      if (isPremium && credited) {
        ent.awardedCount += 1;
        ent.totalRewards += REWARD_AMOUNT;
        totalAwarded += REWARD_AMOUNT;
      } else if (isPremium && !credited) {
        ent.pendingCount += 1;
        totalPending += REWARD_AMOUNT;
      }
    }

    // Enrich stats with referrer profile (uid/displayName/email) if possible by looking up users with that username
    const usernames = Array.from(map.keys()).slice(0, 1000); // batch limit to avoid too many queries
    // Build a cache of username->userDoc if not present
    const missing = usernames.filter(u => !referrerUserCache.has(u));
    if (missing.length) {
      // we will query users where username in missing (Firestore doesn't allow 'in' > 10) -> batch in groups of 10
      const BATCH = 10;
      for (let i = 0; i < missing.length; i += BATCH) {
        const batch = missing.slice(i, i + BATCH);
        try {
          const q = db.collection('users').where('username','in', batch).get();
          const snap = await q;
          snap.forEach(d => {
            const data = d.data(); data.id = d.id;
            referrerUserCache.set(data.username, data);
          });
        } catch (e) {
          // fallback: try single reads (slower)
          for (const uname of batch) {
            try {
              const q2 = await db.collection('users').where('username','==', uname).limit(1).get();
              if (!q2.empty) {
                const d = q2.docs[0]; const dt = d.data(); dt.id = d.id;
                referrerUserCache.set(uname, dt);
              }
            } catch(_) {}
          }
        }
      }
    }

    // attach displayName/email/uid to map entries
    for (const [uname, stat] of map.entries()){
      const rdoc = referrerUserCache.get(uname);
      if (rdoc) {
        stat.displayName = rdoc.fullName || rdoc.displayName || '';
        stat.email = rdoc.email || '';
        stat.uidOfReferrer = rdoc.id || null;
      }
    }

    // convert to array sorted by totalReferred desc
    const arr = Array.from(map.values()).sort((a,b) => b.totalReferred - a.totalReferred);

    return {
      arr,
      totals: {
        totalReferred,
        totalAwarded,
        totalPending,
        totalReferrers: map.size
      }
    };
  }

  // ---------- DATA LOADING ----------
  // Quick scan (first N) vs full paginated scan
  async function quickScanUsers(limit = QUICK_SCAN_LIMIT){
    const snap = await db.collection('users').limit(limit).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async function fullScanUsers(){
    // paginated scan - be careful, this will read whole collection (costly)
    const results = [];
    let q = db.collection('users').orderBy('joinedAt','desc').limit(1000);
    let snap = await q.get();
    while (!snap.empty) {
      snap.docs.forEach(d => results.push({ id: d.id, ...d.data() }));
      if (snap.size < 1000) break;
      const last = snap.docs[snap.docs.length - 1];
      snap = await db.collection('users').orderBy('joinedAt','desc').startAfter(last).limit(1000).get();
    }
    return results;
  }

  // Main refresh function (by default quick)
  async function refreshData({ fullScan=false } = {}){
    try {
      safeEl('ref-refresh').disabled = true;
      safeEl('ref-refresh').innerText = 'Loading…';
      allUsersCache = fullScan ? await fullScanUsers() : await quickScanUsers();
      const { arr, totals } = await aggregateFromUsers(allUsersCache);
      // render
      renderSummary({ totalReferred: totals.totalReferred, totalAwarded: totals.totalAwarded, totalPending: totals.totalPending, totalReferrers: totals.totalReferrers });
      renderTop(arr);
      renderTable(arr);
    } catch (e) {
      console.error('refreshData error', e);
      alert('Failed to load referral data. Check console.');
    } finally {
      safeEl('ref-refresh').disabled = false;
      safeEl('ref-refresh').innerText = 'Refresh';
    }
  }

  // ---------- DETAILS modal ----------
  async function showReferrerDetails(refUsername){
    // fetch referred users where referrer == refUsername (limit large)
    const snap = await db.collection('users').where('referrer','==', refUsername).orderBy('joinedAt','desc').get();
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // modal content
    const content = safeEl('ref-modal-content');
    const title = safeEl('ref-modal-title');
    title.innerText = `Referrer: ${refUsername} — ${rows.length} referred`;
    content.innerHTML = '';
    if (rows.length === 0) {
      content.innerHTML = '<p class="text-gray-400">No referrals for this user.</p>';
    } else {
      rows.forEach(r => {
        const div = document.createElement('div');
        div.className = 'p-3 rounded-xl bg-white/5 flex items-center justify-between';
        const joined = toDateVal(r.joinedAt);
        div.innerHTML = `
          <div>
            <div class="font-semibold">${escapeHtml(r.username || r.fullName || '—')}</div>
            <div class="text-xs text-slate-300">${escapeHtml(r.email || '—')}</div>
            <div class="text-xs text-gray-400">Joined: ${joined ? joined.toLocaleString() : '—'}</div>
          </div>
          <div class="text-right">
            <div class="text-sm ${r.is_Premium ? 'text-green-400 font-bold' : 'text-gray-400'}">${r.is_Premium ? 'Premium' : 'Free'}</div>
            <div class="text-xs ${r.referralBonusCredited ? 'text-slate-300' : 'text-yellow-300'}">${r.referralBonusCredited ? 'Credited' : (r.is_Premium ? 'Pending credit' : 'No credit')}</div>
            <div class="mt-2">
              ${ r.is_Premium && !r.referralBonusCredited ? `<button class="px-3 py-1 rounded-lg bg-emerald-500 text-black" data-credit="${r.id}">Mark as credited</button>` : '' }
            </div>
          </div>
        `;
        content.appendChild(div);
        // wire admin credit button
        const btn = div.querySelector('button[data-credit]');
        if (btn) {
          btn.addEventListener('click', async () => {
            btn.disabled = true;
            btn.innerText = 'Processing…';
            try {
              // perform transactional credit
              await adminCreditReferral(r.id, refUsername);
              // update UI
              btn.innerText = 'Credited';
              await refreshData({ fullScan: false }); // refresh caches
              showReferrerDetails(refUsername); // re-open / refresh modal (or update)
            } catch (e) {
              console.error(e);
              alert('Credit failed: see console');
              btn.disabled = false;
              btn.innerText = 'Mark as credited';
            }
          });
        }
      });
    }
    // show modal
    safeEl('ref-modal').classList.remove('hidden');
  }

  // close modal wiring
  document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'ref-modal-close') {
      safeEl('ref-modal').classList.add('hidden');
    }
  });

  // ---------- ADMIN TRANSACTION: mark referred user as credited ----------
  // Mirrors your processReferralCreditTx but resolves referrer UID via username
  async function adminCreditReferral(referredUserId, referrerUsername){
    // find referrer UID
    let refDoc = referrerUserCache.get(referrerUsername);
    if (!refDoc) {
      // try to fetch
      const q = await db.collection('users').where('username','==', referrerUsername).limit(1).get();
      if (!q.empty) {
        const d = q.docs[0]; refDoc = { id: d.id, ...d.data() }; referrerUserCache.set(referrerUsername, refDoc);
      } else {
        throw new Error('Referrer user not found for username: ' + referrerUsername);
      }
    }
    const referrerUid = refDoc.id;
    // transaction: check referred is premium & not credited; update both docs atomically
    return db.runTransaction(async tx => {
      const referredRef = db.collection('users').doc(referredUserId);
      const referrerRef = db.collection('users').doc(referrerUid);
      const [rSnap, refSnap] = await Promise.all([tx.get(referredRef), tx.get(referrerRef)]);
      if (!rSnap.exists) throw new Error('Referred user doc missing');
      const rData = rSnap.data();
      if (!rData.is_Premium) throw new Error('Referred user is not premium');
      if (rData.referralBonusCredited) return; // already
      const cur = (refSnap.exists && (refSnap.data().balance || 0)) || 0;
      const curNum = (typeof cur === 'number' && isFinite(cur)) ? cur : Number(cur) || 0;
      tx.update(referrerRef, { balance: curNum + REWARD_AMOUNT });
      tx.update(referredRef, { referralBonusCredited: true });
    });
  }

  // ---------- EXPORT ----------
  function exportReferrersCSV(arr){
    // arr: array of aggregated referrer stats
    if (!arr || arr.length === 0) return alert('Nothing to export');
    const header = ['username','displayName','email','totalReferred','awardedCount','pendingCount','totalRewards'];
    const rows = arr.map(r => [r.username, r.displayName||'', r.email||'', r.totalReferred, r.awardedCount, r.pendingCount, r.totalRewards]);
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `referrers-${(new Date()).toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  // ---------- UI wiring ----------
  function wireUI(){
    safeEl('ref-refresh').addEventListener('click', () => refreshData({ fullScan: false }));
    safeEl('ref-scan-all').addEventListener('click', async () => {
      if (!confirm('This will scan ALL users (can be expensive). Continue?')) return;
      await refreshData({ fullScan: true });
    });
    safeEl('ref-export-agg').addEventListener('click', async () => {
      // rebuild arr quickly from current cache
      const agg = await aggregateFromUsers(allUsersCache);
      exportReferrersCSV(agg.arr);
    });
    safeEl('ref-realtime-toggle').addEventListener('change', (e) => {
      realtimeEnabled = !!e.target.checked;
      if (realtimeEnabled) {
        startPolling();
      } else {
        stopPolling();
      }
    });
    // search + time filter
    const searchEl = safeEl('ref-search'), timeEl = safeEl('ref-time-filter');
    let searchTimer = null;
    if (searchEl) {
      searchEl.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => applyClientFilter(), 250);
      });
    }
    if (timeEl) timeEl.addEventListener('change', () => applyClientFilter());
  }

  // client-side filter on aggregated array (we maintain lastAgg array)
  let lastAggArray = [];
  function applyClientFilter(){
    const q = safeEl('ref-search').value.trim().toLowerCase();
    const timeKey = safeEl('ref-time-filter').value;
    // filter by username/displayName/email matches
    let arr = lastAggArray.slice();
    if (q) arr = arr.filter(r => (r.username||'').toLowerCase().includes(q) || (r.displayName||'').toLowerCase().includes(q) || (r.email||'').toLowerCase().includes(q));
    // time filter: filter referrers who have referred users within timeframe (we will scan allUsersCache to check dates)
    if (timeKey && timeKey !== 'all') {
      const now = new Date();
      const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startY = new Date(startToday.getTime() - 86400000);
      const start7 = new Date(now.getTime() - 7 * 86400000);
      const start30 = new Date(now.getTime() - 30 * 86400000);
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      // precompute map of referrer -> hasRecent
      const hasRecent = new Set();
      for (const u of allUsersCache) {
        const d = toDateVal(u.joinedAt);
        if (!d) continue;
        let ok = false;
        if (timeKey === 'today' && d >= startToday) ok = true;
        if (timeKey === 'yesterday' && d >= startY && d < startToday) ok = true;
        if (timeKey === '7days' && d >= start7) ok = true;
        if (timeKey === '30days' && d >= start30) ok = true;
        if (timeKey === 'month' && d >= startMonth) ok = true;
        if (ok && u.referrer) hasRecent.add(u.referrer);
      }
      arr = arr.filter(r => hasRecent.has(r.username));
    }
    renderTop(arr);
    renderTable(arr);
  }

  // ---------- POLLING for realtime-ish ----------
  function startPolling(){
    stopPolling();
    pollingInterval = setInterval(() => refreshData({ fullScan: false }), 8000);
  }
  function stopPolling(){ if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; } }

  // ---------- PUBLIC START ----------
  async function startAdminReferrals(){
    wireUI();
    // initial quick load
    await refreshData({ fullScan: false });
    // set lastAggArray from last refresh
    // unfortunately aggregateFromUsers returns arr only inside refreshData; to keep it simple, call refreshData again to populate lastAggArray
    try {
      const { arr } = await aggregateFromUsers(allUsersCache);
      lastAggArray = arr;
    } catch(e){}
  }

  function stopAdminReferrals(){
    stopPolling();
  }

  // expose
  window.startAdminReferrals = startAdminReferrals;
  window.stopAdminReferrals = stopAdminReferrals;

  // auto-init if admin-referrals element is present and db exists
  function tryAutoInit(){
    if (!document.getElementById('admin-referrals')) return;
    if (typeof db === 'undefined') {
      // wait for db
      const t = setInterval(() => {
        if (typeof db !== 'undefined') {
          clearInterval(t);
          startAdminReferrals().catch(e => console.error(e));
        }
      }, 250);
    } else {
      startAdminReferrals().catch(e => console.error(e));
    }
  }
  // called from onAdminReady after auth

})();











                                          // ADMIN PREMIUM OVERVIEW FUNCTION 

/*
  Premium Admin Module (single-block)
  - Paste after firebase init (db should be firebase.firestore())
  - Exposes startAdminPremium() and stopAdminPremium()
  - All functions inside this IIFE (no scattering)
*/
(function PremiumAdminModule(){
  // ======= CONFIG =======
  const QUICK_SCAN_LIMIT = 1000;
  const PREMIUM_PRICE = 1000; // official price (₦), used for revenue calculations
  const EVENTS_COLLECTION = 'premiumEvents'; // audit trail
  const USERS_COLLECTION = 'users';
  let allUsersCache = [];
  let lastAggArray = [];
  let pollingInterval = null;
  let realtime = false;

  // ======= HELPERS =======
  function safeEl(id){ return document.getElementById(id); }
  function money(n){ return '₦' + Number(n || 0).toLocaleString(); }
  function nowDate(){ return new Date(); }

  function toDateVal(v){
    if (!v) return null;
    if (typeof v.toDate === 'function') return v.toDate();
    if (v._seconds || v.seconds) { const s = v._seconds || v.seconds; return new Date(s * 1000); }
    if (typeof v === 'number') return v > 1e12 ? new Date(v) : new Date(v * 1000);
    if (typeof v === 'string') { const p = Date.parse(v); return isNaN(p) ? null : new Date(p); }
    return null;
  }

  function escapeHtml(s){ if (s === null || s === undefined) return ''; return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]); }

  // ======= RENDER: summary =======
  function renderSummary(stats){
    safeEl('pm-total-users').innerText = stats.totalUsers;
    safeEl('pm-total-premium').innerText = stats.totalPremium;
    safeEl('pm-upgrades-today').innerText = stats.upgradesToday;
    safeEl('pm-revenue').innerText = money(stats.revenue);
  }

  // ======= AGGREGATE =======
  function aggregateUsers(users){
    const totalUsers = users.length;
    let totalPremium = 0;
    let upgradesToday = 0;
    let revenue = 0;

    const todayStart = new Date(); todayStart.setHours(0,0,0,0);

    users.forEach(u => {
      if (u.is_Premium) totalPremium++;
      const pu = toDateVal(u.premiumUpgradedAt) || toDateVal(u.joinedAt); // if no upgradedAt, maybe joinedAt used
      if (pu && pu >= todayStart && u.is_Premium) upgradesToday++;
    });

    // revenue: read premiumEvents if available in cache, otherwise estimate = totalPremium * PREMIUM_PRICE (less accurate)
    // We'll query events for accurate revenue when needed; for quick summary, try to compute from events cache if present.
    // For now use estimate: events revenue not stored locally =>  estimate = number of events of type 'purchase' * PREMIUM_PRICE
    // We'll set revenue = totalPremium * PREMIUM_PRICE as baseline (safe).
    revenue = totalPremium * PREMIUM_PRICE;

    return { totalUsers, totalPremium, upgradesToday, revenue };
  }

  // ======= RENDER: table =======
  function renderTable(users){
    const tbody = safeEl('pm-table-body');
    tbody.innerHTML = '';
    if (!users || users.length === 0){
      tbody.innerHTML = '<tr><td colspan="7" class="p-6 text-center text-gray-400">No users found</td></tr>';
      return;
    }

    users.forEach(u => {
      const joined = toDateVal(u.joinedAt);
      const upgraded = toDateVal(u.premiumUpgradedAt);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="px-3 py-2 font-mono text-xs">${escapeHtml(u.id)}</td>
        <td class="px-3 py-2">
          <div class="font-medium">${escapeHtml(u.fullName || u.displayName || '')}</div>
          <div class="text-xs text-slate-300">${escapeHtml(u.email || '')}</div>
        </td>
        <td class="px-3 py-2">
          ${ u.is_Premium ? '<span class="px-2 py-1 rounded-full bg-emerald-600 text-black text-xs font-semibold">Premium</span>' : '<span class="px-2 py-1 rounded-full bg-white/6 text-xs">Free</span>' }
        </td>
        <td class="px-3 py-2 text-xs">${joined ? joined.toLocaleString() : '—'}</td>
        <td class="px-3 py-2 font-semibold">${money(u.balance || 0)}</td>
        <td class="px-3 py-2 text-xs">${upgraded ? upgraded.toLocaleString() : '—'}</td>
        <td class="px-3 py-2">
          <div class="flex items-center gap-2">
            <button class="pm-btn-details px-2 py-1 rounded-lg bg-white/6 text-sm" data-uid="${escapeHtml(u.id)}">History</button>
            <button class="pm-btn-toggle px-2 py-1 rounded-lg bg-amber-500 text-black text-sm" data-uid="${escapeHtml(u.id)}" data-prem="${u.is_Premium ? '1' : '0'}">${u.is_Premium ? 'Revoke' : 'Grant'}</button>
            <button class="pm-btn-adjust px-2 py-1 rounded-lg bg-white/6 text-sm" data-uid="${escapeHtml(u.id)}">Adjust</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // wire buttons
    tbody.querySelectorAll('.pm-btn-details').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const uid = btn.dataset.uid;
        openPremiumModal(uid);
      });
    });
    tbody.querySelectorAll('.pm-btn-toggle').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const uid = btn.dataset.uid;
        const isNow = btn.dataset.prem === '1';
        try {
          btn.disabled = true;
          btn.innerText = 'Processing…';
          await adminTogglePremium(uid, !isNow); // flip
          await refreshData({ fullScan: false });
        } catch (err) {
          console.error(err);
          alert('Action failed — see console');
        } finally {
          btn.disabled = false;
          btn.innerText = isNow ? 'Revoke' : 'Grant';
        }
      });
    });
    tbody.querySelectorAll('.pm-btn-adjust').forEach(btn => {
      btn.addEventListener('click', async () => {
        const uid = btn.dataset.uid;
        const input = prompt('Enter amount to ADD (positive) or SUBTRACT (negative) from user balance (₦). Use numbers only. Example: 500 or -200');
        if (input === null) return;
        const amt = Number(input);
        if (isNaN(amt)) { alert('Invalid amount'); return; }
        try {
          await adminAdjustBalance(uid, amt);
          await refreshData({ fullScan: false });
        } catch (e) {
          console.error(e);
          alert('Adjust failed');
        }
      });
    });
  }

  // ======= MODAL: premium events for user =======
  async function openPremiumModal(uid){
    safeEl('pm-modal').classList.remove('hidden');
    safeEl('pm-modal-title').innerText = `Premium Events — ${uid}`;
    const content = safeEl('pm-modal-content');
    content.innerHTML = `<div class="text-sm text-slate-400">Loading…</div>`;
    try {
      const snap = await db.collection(EVENTS_COLLECTION).where('userUid','==', uid).orderBy('createdAt','desc').get();
      if (snap.empty) {
        content.innerHTML = `<div class="text-sm text-gray-400">No premium events for this user.</div>`;
        return;
      }
      content.innerHTML = '';
      snap.docs.forEach(d => {
        const dd = d.data();
        const created = toDateVal(dd.createdAt);
        const row = document.createElement('div');
        row.className = 'p-3 rounded-xl bg-white/5 flex items-center justify-between';
        row.innerHTML = `
          <div>
            <div class="font-semibold">${escapeHtml(dd.type || 'event')}</div>
            <div class="text-xs text-slate-300">${escapeHtml(dd.note || '')}</div>
            <div class="text-xs text-gray-400 mt-1">By: ${escapeHtml(dd.adminUid || dd.triggeredBy || 'system')} · ${created ? created.toLocaleString() : ''}</div>
          </div>
          <div class="text-right">
            <div class="font-bold">${money(dd.amount || 0)}</div>
            <div class="text-xs text-slate-300">${escapeHtml(dd.status || '')}</div>
          </div>
        `;
        content.appendChild(row);
      });

      // add export button inside modal
      const exportBtn = document.createElement('button');
      exportBtn.className = 'mt-3 px-3 py-1 rounded-xl bg-gradient-to-r from-indigo-500 to-pink-500 text-white';
      exportBtn.innerText = 'Export Events CSV';
      exportBtn.addEventListener('click', async () => {
        await exportPremiumEventsCSV(uid);
      });
      content.appendChild(exportBtn);
    } catch (e) {
      console.error(e);
      content.innerHTML = `<div class="text-sm text-red-400">Failed to load events</div>`;
    }
  }

  // modal close
  document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'pm-modal-close') {
      safeEl('pm-modal').classList.add('hidden');
    }
  });

  // ======= ADMIN ACTIONS (transactional) =======
  // Admin toggles premium status (grant or revoke). When granting, admin may decide to deduct cost or not.
  async function adminTogglePremium(userUid, makePremium, { deduct = PREMIUM_PRICE, note = 'Admin action' } = {}){
    // adminUID for event
    const adminUser = firebase.auth().currentUser;
    const adminUid = adminUser ? adminUser.uid : null;
    const userRef = db.collection(USERS_COLLECTION).doc(userUid);
    const eventsRef = db.collection(EVENTS_COLLECTION).doc(); // auto id

    return db.runTransaction(async tx => {
      const snap = await tx.get(userRef);
      if (!snap.exists) throw new Error('User not found');
      const user = snap.data();

      if (makePremium) {
        // already premium => no-op
        if (user.is_Premium) return;
        // compute balance after deduction (if deduct truthy)
        let curBal = user.balance || 0;
        curBal = (typeof curBal === 'number' && isFinite(curBal)) ? curBal : Number(curBal) || 0;

        // If admin wants to force grant without deduct, pass deduct = 0
        const newBal = curBal - (deduct || 0);

        tx.update(userRef, {
          is_Premium: true,
          premiumUpgradedAt: firebase.firestore.FieldValue.serverTimestamp(),
          balance: newBal
        });

        tx.set(eventsRef, {
          userUid,
          type: (deduct ? 'purchase' : 'admin_grant'),
          amount: deduct || 0,
          adminUid,
          note,
          status: 'awarded',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      } else {
        // revoke premium
        if (!user.is_Premium) return;
        tx.update(userRef, {
          is_Premium: false,
          // keep premiumUpgradedAt for history; optionally set revokedAt
          revokedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        tx.set(eventsRef, {
          userUid,
          type: 'revoked',
          amount: 0,
          adminUid,
          note,
          status: 'revoked',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    });
  }

  // Admin adjust balance (positive/negative)
  async function adminAdjustBalance(userUid, amount, note = 'Admin balance adjustment'){
    const adminUser = firebase.auth().currentUser;
    const adminUid = adminUser ? adminUser.uid : null;
    const userRef = db.collection(USERS_COLLECTION).doc(userUid);
    const eventsRef = db.collection(EVENTS_COLLECTION).doc();
    return db.runTransaction(async tx => {
      const s = await tx.get(userRef);
      if (!s.exists) throw new Error('User not found');
      const data = s.data();
      let cur = data.balance || 0;
      cur = (typeof cur === 'number' && isFinite(cur)) ? cur : Number(cur) || 0;
      const newBal = cur + Number(amount || 0);
      tx.update(userRef, { balance: newBal });
      tx.set(eventsRef, {
        userUid,
        type: 'adjust_balance',
        amount: amount,
        adminUid,
        note,
        status: 'ok',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    });
  }

  // ======= EXPORT: Premium events CSV for a user =======
  async function exportPremiumEventsCSV(userUid){
    const snap = await db.collection(EVENTS_COLLECTION).where('userUid','==', userUid).orderBy('createdAt','desc').get();
    if (snap.empty) return alert('No events to export');
    const rows = [['id','type','amount','adminUid','note','status','createdAt']];
    snap.docs.forEach(d => {
      const o = d.data();
      rows.push([d.id, o.type || '', o.amount || 0, o.adminUid || '', (o.note || '').replace(/"/g,'""'), o.status || '', (toDateVal(o.createdAt) || '').toString()]);
    });
    const csv = rows.map(r => r.map(c => `"${String(c)}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `premium-events-${userUid}-${(new Date()).toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  // ======= DATA LOADING: quick & full =======
  async function quickScan(limit = QUICK_SCAN_LIMIT){
    const snap = await db.collection(USERS_COLLECTION).orderBy('joinedAt','desc').limit(limit).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async function fullScan(){
    const results = [];
    let q = db.collection(USERS_COLLECTION).orderBy('joinedAt','desc').limit(1000);
    let snap = await q.get();
    while (!snap.empty) {
      snap.docs.forEach(d => results.push({ id: d.id, ...d.data() }));
      if (snap.size < 1000) break;
      const last = snap.docs[snap.docs.length - 1];
      snap = await db.collection(USERS_COLLECTION).orderBy('joinedAt','desc').startAfter(last).limit(1000).get();
    }
    return results;
  }

  // ======= REFRESH (main) =======
  async function refreshData({ fullScan: doFull = false } = {}){
    try {
      safeEl('pm-refresh').disabled = true;
      safeEl('pm-refresh').innerText = 'Loading…';
      allUsersCache = doFull ? await fullScan() : await quickScan();
      const stats = aggregateUsers(allUsersCache);
      renderSummary(stats);
      // client-side filters & search will be applied based on UI state; store lastAggArray as initial sorted by joined
      lastAggArray = allUsersCache.slice().sort((a,b) => {
        const da = toDateVal(a.joinedAt) || 0;
        const dbv = toDateVal(b.joinedAt) || 0;
        return dbv - da;
      });
      // apply filter + search and render
      applyClientFilter();
    } catch (e) {
      console.error('refreshData error', e);
      alert('Failed to load users. See console.');
    } finally {
      safeEl('pm-refresh').disabled = false;
      safeEl('pm-refresh').innerText = 'Refresh';
    }
  }

  // ======= Client filter (search + time) =======
  function applyClientFilter(){
    const q = (safeEl('pm-search')?.value || '').trim().toLowerCase();
    const timeKey = safeEl('pm-time-filter')?.value || 'all';
    let arr = lastAggArray.slice();

    // time filter: build set of uids that match timeframe
    if (timeKey && timeKey !== 'all') {
      const now = new Date();
      const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startY = new Date(startToday.getTime() - 86400000);
      const start7 = new Date(now.getTime() - 7 * 86400000);
      const start30 = new Date(now.getTime() - 30 * 86400000);
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // compute uids with referred or joinedAt in timeframe (we're filtering users directly)
      arr = arr.filter(u => {
        const d = toDateVal(u.joinedAt);
        if (!d) return false;
        if (timeKey === 'today') return d >= startToday;
        if (timeKey === 'yesterday') return d >= startY && d < startToday;
        if (timeKey === '7days') return d >= start7;
        if (timeKey === '30days') return d >= start30;
        if (timeKey === 'month') return d >= startMonth;
        return true;
      });
    }

    // search filter
    if (q) {
      arr = arr.filter(u => {
        return (u.id && u.id.toLowerCase().includes(q)) ||
               (u.username && u.username.toLowerCase().includes(q)) ||
               (u.email && u.email.toLowerCase().includes(q)) ||
               ((u.fullName || u.displayName || '').toLowerCase().includes(q));
      });
    }

    // Render filtered results
    renderTable(arr);
  }

  // ======= EXPORT USERS CSV (current cache) =======
  function exportUsersCSV(){
    if (!allUsersCache || allUsersCache.length === 0) return alert('No users to export');
    const header = ['uid','fullName','username','email','is_Premium','balance','joinedAt','premiumUpgradedAt'];
    const rows = allUsersCache.map(u => [
      u.id || '',
      (u.fullName || u.displayName || '').replace(/"/g,'""'),
      (u.username || '').replace(/"/g,'""'),
      (u.email || '').replace(/"/g,'""'),
      !!u.is_Premium,
      u.balance || 0,
      (toDateVal(u.joinedAt) ? toDateVal(u.joinedAt).toISOString() : ''),
      (toDateVal(u.premiumUpgradedAt) ? toDateVal(u.premiumUpgradedAt).toISOString() : '')
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c)}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `users-${(new Date()).toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  // ======= EXPORT ALL EVENTS CSV =======
  async function exportAllEventsCSV(){
    // careful: may be expensive for many events. We'll only export last 5000 events as safe default.
    const snap = await db.collection(EVENTS_COLLECTION).orderBy('createdAt','desc').limit(5000).get();
    if (snap.empty) return alert('No events to export');
    const rows = [['id','userUid','type','amount','adminUid','note','status','createdAt']];
    snap.docs.forEach(d => {
      const o = d.data();
      rows.push([d.id, o.userUid || '', o.type || '', o.amount || 0, o.adminUid || '', (o.note||'').replace(/"/g,'""'), o.status || '', (toDateVal(o.createdAt) || '').toString()]);
    });
    const csv = rows.map(r => r.map(c => `"${String(c)}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `premium-events-${(new Date()).toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  // ======= POLLING =======
  function startPolling(){ stopPolling(); pollingInterval = setInterval(() => refreshData({ fullScan: false }), 8000); }
  function stopPolling(){ if (pollingInterval) clearInterval(pollingInterval); pollingInterval = null; }

  // ======= UI wiring =======
  function wireUI(){
    safeEl('pm-refresh').addEventListener('click', () => refreshData({ fullScan: false }));
    safeEl('premium-scan-all').addEventListener('click', async () => {
      if (!confirm('This will scan ALL users (can be expensive). Continue?')) return;
      await refreshData({ fullScan: true });
    });
    safeEl('premium-export-users').addEventListener('click', exportUsersCSV);
    safeEl('premium-export-events').addEventListener('click', exportAllEventsCSV);
    safeEl('premium-realtime-toggle').addEventListener('change', (e) => {
      realtime = !!e.target.checked;
      if (realtime) startPolling(); else stopPolling();
    });
    // search + time filter
    const searchEl = safeEl('pm-search');
    let sT = null;
    if (searchEl) {
      searchEl.addEventListener('input', () => {
        clearTimeout(sT);
        sT = setTimeout(() => applyClientFilter(), 250);
      });
    }
    const timeEl = safeEl('pm-time-filter');
    if (timeEl) timeEl.addEventListener('change', () => applyClientFilter());
  }

  // ======= PUBLIC START / STOP =======
  async function startAdminPremium(){
    wireUI();
    // wait for db if missing
    if (typeof db === 'undefined') {
      let tries = 0;
      const ok = await new Promise((resolve) => {
        const t = setInterval(() => {
          if (typeof db !== 'undefined') { clearInterval(t); resolve(true); }
          tries++; if (tries > 40) { clearInterval(t); resolve(false); }
        }, 150);
      });
      if (!ok) { console.error('db not found'); return; }
    }
    await refreshData({ fullScan: false });
  }

  function stopAdminPremium(){
    stopPolling();
  }

  // auto-init if present
  function tryAutoInit(){
    if (!document.getElementById('admin-premium')) return;
    if (typeof db === 'undefined') {
      const t = setInterval(() => {
        if (typeof db !== 'undefined') { clearInterval(t); startAdminPremium().catch(e => console.error(e)); }
      }, 250);
    } else {
      startAdminPremium().catch(e => console.error(e));
    }
  }
  // called from onAdminReady after auth
  window.startAdminPremium = startAdminPremium;
  window.stopAdminPremium = stopAdminPremium;

})(); /* End PremiumAdminModule */



















// --- CHECK IN FUNCTION 


/* Admin Check-in Module
   - Exposes startAdminCheckin() on window
   - Uses:
     - db (firebase.firestore())
     - users collection for user metadata
     - checkins/{uid}/cycles for cycles (matches your structure)
*/
(function adminCheckinModule () {
  const CYCLE_LENGTH = 7;
  const REWARD_DAY = 50;
  const REWARD_LAST = 300;

  // ----- helpers -----
  function todayStrLocal() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  function dayDiff(startDateStr, dateStr) {
    if (!startDateStr) return 9999;
    const [sy, sm, sd] = String(startDateStr).split('-').map(Number);
    const [ty, tm, td] = String(dateStr).split('-').map(Number);
    const s = new Date(sy, sm - 1, sd);
    const t = new Date(ty, tm - 1, td);
    return Math.floor((t - s) / (1000 * 60 * 60 * 24));
  }
  function fmtNaira(n) { return '₦' + Number(n || 0).toLocaleString(); }
  function cyclesRef(uid) { return db.collection('checkins').doc(uid).collection('cycles'); }

  // ----- DOM refs -----
  const el = {
    totalUsers: document.getElementById('sum-total-users'),
    checkedToday: document.getElementById('sum-checked-today'),
    totalCheckins: document.getElementById('sum-total-checkins'),
    totalRewards: document.getElementById('sum-total-rewards'),
    tableBody: document.getElementById('admin-table-body'),
    search: document.getElementById('admin-search'),
    viewSelect: document.getElementById('admin-view-select'),
    filterBtn: document.getElementById('admin-filter-btn'),
    fromDate: document.getElementById('admin-from'),
    toDate: document.getElementById('admin-to'),
    realtimeToggle: document.getElementById('admin-realtime-toggle'),
    exportCsvBtn: document.getElementById('admin-export-csv'),
    scanAllBtn: document.getElementById('admin-scan-all'),
    modal: document.getElementById('admin-user-modal'),
    modalUid: document.getElementById('modal-uid'),
    modalContent: document.getElementById('modal-content')
  };

  let usersCache = []; // { uid, name, email }
  let statsCache = []; // computed per-user stats

  // ----- compute stats for a single user (reads their cycles subcollection) -----
  async function computeUserStats(uid, userDoc) {
    const today = todayStrLocal();
    const cyclesSnap = await cyclesRef(uid).get();
    let totalCheckins = 0;
    let completedCycles = 0;
    let totalRewards = 0;
    let lastCheckinTS = null;
    let checkedToday = false;

    cyclesSnap.forEach(cDoc => {
      const d = cDoc.data();
      const days = Array.isArray(d.days) ? d.days : [];
      // total checkins for this cycle
      const cnt = days.filter(Boolean).length;
      totalCheckins += cnt;

      // completed cycles and rewards
      if (d.status === 'received') {
        completedCycles += 1;
        totalRewards += Number(d.rewardAmount || REWARD_LAST);
      }

      // last checked day in this cycle
      for (let i = days.length - 1; i >= 0; i--) {
        if (days[i]) {
          // compute timestamp of that day
          try {
            const s = new Date((d.cycleStartDate || today) + 'T00:00:00');
            const dt = new Date(s.getTime() + (i * 24 * 60 * 60 * 1000));
            if (!lastCheckinTS || dt > lastCheckinTS) lastCheckinTS = dt;
          } catch (e) { /* ignore bad date formats */ }
          break;
        }
      }

      // check if user checked in today (for latest cycle position)
      const diff = dayDiff(d.cycleStartDate || today, today);
      if (diff >= 0 && diff < CYCLE_LENGTH && days[diff]) checkedToday = true;
    });

    return {
      uid,
      displayName: (userDoc && userDoc.data && (userDoc.data().displayName || userDoc.data().name)) || ((userDoc && userDoc.data && userDoc.data().email) ? userDoc.data().email.split('@')[0] : '—'),
      email: (userDoc && userDoc.data && userDoc.data().email) || '—',
      checkedToday,
      totalCheckins,
      completedCycles,
      totalRewards,
      lastCheckin: lastCheckinTS ? lastCheckinTS.toLocaleString() : '—'
    };
  }

  // ----- fetch users list from users collection -----
  async function loadAllUsers(limit = 500) {
    usersCache = [];
    const snap = await db.collection('users').limit(limit).get();
    snap.forEach(d => usersCache.push({ uid: d.id, doc: d }));
    return usersCache;
  }

  // ----- build table row for a stats object -----
  function renderUserRow(s) {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-white/3';

    const td = (txt, classes = '') => {
      const e = document.createElement('td');
      e.className = 'px-3 py-2 ' + classes;
      e.innerHTML = txt;
      return e;
    };

    const todayBadge = s.checkedToday ? '<span class="px-2 py-1 rounded-full bg-green-600 text-black text-xs font-semibold">YES</span>' : '<span class="px-2 py-1 rounded-full bg-white/6 text-xs">NO</span>';

    tr.appendChild(td(`<div class="text-xs font-mono">${s.uid}</div>`));
    tr.appendChild(td(`<div class="font-medium">${escapeHtml(s.displayName)}</div><div class="text-xs text-slate-300">${escapeHtml(s.email)}</div>`));
    tr.appendChild(td(todayBadge));
    tr.appendChild(td(`<div class="font-semibold">${s.totalCheckins}</div>`));
    tr.appendChild(td(`<div class="">${s.completedCycles}</div>`));
    tr.appendChild(td(`<div class="font-bold">${fmtNaira(s.totalRewards)}</div>`));
    tr.appendChild(td(`<div class="text-xs text-slate-300">${s.lastCheckin}</div>`));

    const viewBtn = document.createElement('button');
    viewBtn.className = 'px-3 py-1 bg-white/6 rounded-lg';
    viewBtn.innerText = 'Details';
    viewBtn.onclick = () => showUserDetails(s.uid);

    const actionTd = document.createElement('td');
    actionTd.className = 'px-3 py-2';
    actionTd.appendChild(viewBtn);
    tr.appendChild(actionTd);

    return tr;
  }

  // ----- render table with optional client-side filters -----
  function renderTable(data) {
    statsCache = data;
    el.tableBody.innerHTML = '';
    const query = (el.search && el.search.value || '').trim().toLowerCase();
    const view = el.viewSelect.value;

    let filtered = data.filter(s => {
      if (query) {
        return (s.uid + ' ' + s.displayName + ' ' + s.email).toLowerCase().includes(query);
      }
      return true;
    });

    if (view === 'today') filtered = filtered.filter(s => s.checkedToday);
    if (view === 'completed') filtered = filtered.filter(s => s.completedCycles > 0);

    filtered.forEach(s => el.tableBody.appendChild(renderUserRow(s)));
  }

  // ----- show per-user modal details -----
  async function showUserDetails(uid) {
    el.modalUid.textContent = 'User: ' + uid;
    el.modalContent.innerHTML = '<div class="text-sm text-slate-400">Loading cycles…</div>';
    el.modal.classList.remove('hidden');

    const userDoc = await db.collection('users').doc(uid).get();
    const cyclesSnap = await cyclesRef(uid).orderBy('createdAt','desc').get();
    if (cyclesSnap.empty) {
      el.modalContent.innerHTML = '<div class="text-sm text-slate-400">No cycles found for this user.</div>';
      return;
    }

    const container = document.createElement('div');
    container.className = 'space-y-4';

    cyclesSnap.forEach(doc => {
      const d = doc.data();
      const wrap = document.createElement('div');
      wrap.className = 'p-3 rounded-xl bg-white/5 border border-white/6';
      const header = document.createElement('div');
      header.className = 'flex items-center justify-between mb-2';
      header.innerHTML = `<div class="font-semibold">${d.cycleStartDate || '—'}</div><div class="text-xs text-slate-300">${d.status || '—'}</div>`;
      wrap.appendChild(header);

      // days visualization
      const daysRow = document.createElement('div');
      daysRow.className = 'flex gap-2 flex-wrap';
      const days = Array.isArray(d.days) ? d.days : [];
      for (let i = 0; i < Math.max(CYCLE_LENGTH, days.length); i++) {
        const pill = document.createElement('div');
        pill.className = 'text-xs w-12 text-center py-2 rounded-lg';
        const checked = !!days[i];
        pill.textContent = `${i + 1}d`;
        if (checked) {
          pill.className += ' bg-green-600 text-black';
        } else {
          pill.className += ' bg-white/6';
        }
        daysRow.appendChild(pill);
      }
      wrap.appendChild(daysRow);

      const footer = document.createElement('div');
      footer.className = 'mt-3 flex items-center justify-between text-sm';
      footer.innerHTML = `<div>Reward: <span class="font-semibold">${fmtNaira(d.rewardAmount || REWARD_LAST)}</span></div><div class="text-slate-300">${d.updatedAt && d.updatedAt.toDate ? d.updatedAt.toDate().toLocaleString() : ''}</div>`;
      wrap.appendChild(footer);

      container.appendChild(wrap);
    });

    el.modalContent.innerHTML = '';
    el.modalContent.appendChild(container);
  }

  // ----- summary scan using collectionGroup('cycles') -----
  async function recalcSummaryScan() {
    // NOTE: collectionGroup('cycles') returns all cycles across users.
    // If you have tens of thousands of cycles this will be heavy — consider a Cloud Function aggregator.
    el.totalUsers && (el.totalUsers.textContent = '…');
    el.checkedToday && (el.checkedToday.textContent = '…');
    el.totalCheckins && (el.totalCheckins.textContent = '…');
    el.totalRewards && (el.totalRewards.textContent = '…');

    const today = todayStrLocal();
    let totalRewardsGiven = 0;
    let totalCheckinsAll = 0;
    let totalCheckinsToday = 0;
    const usersCheckedToday = new Set();

    const q = db.collectionGroup('cycles');
    // paginate to avoid memory spike — this example fetches up to 10k docs in pages of 1000.
    let page = await q.limit(1000).get();
    while (page.size > 0) {
      page.forEach(doc => {
        const d = doc.data();
        if (d.status === 'received') totalRewardsGiven += Number(d.rewardAmount || REWARD_LAST);
        const days = Array.isArray(d.days) ? d.days : [];
        totalCheckinsAll += days.filter(Boolean).length;
        const diff = dayDiff(d.cycleStartDate || today, today);
        if (diff >= 0 && diff < CYCLE_LENGTH && days[diff]) {
          totalCheckinsToday += 1;
          // parent parent id is uid: checkins/{uid}/cycles/{cycleDoc}
          try { usersCheckedToday.add(doc.ref.parent.parent.id); } catch (e) {}
        }
      });

      if (!page.docs.length || page.size < 1000) break;
      const last = page.docs[page.docs.length - 1];
      page = await q.startAfter(last).limit(1000).get();
    }

    // total users from users collection
    const usersSnap = await db.collection('users').get();
    el.totalUsers.textContent = usersSnap.size;
    el.checkedToday.textContent = usersCheckedToday.size;
    el.totalCheckins.textContent = totalCheckinsAll;
    el.totalRewards.textContent = fmtNaira(totalRewardsGiven);
  }

  // ----- load table by enumerating users and computing per-user stats -----
  async function loadAdminTable() {
    el.tableBody.innerHTML = '<tr><td colspan="8" class="p-6 text-slate-400">Loading users & stats…</td></tr>';
    const users = await loadAllUsers(1000);
    if (users.length === 0) {
      el.tableBody.innerHTML = '<tr><td colspan="8" class="p-6 text-slate-400">No users found.</td></tr>';
      return;
    }

    // compute stats in parallel but batch to avoid too many concurrent reads
    const BATCH = 20;
    const results = [];
    for (let i = 0; i < users.length; i += BATCH) {
      const batch = users.slice(i, i + BATCH);
      const prom = batch.map(u => computeUserStats(u.uid, u.doc));
      const res = await Promise.all(prom);
      results.push(...res);
    }

    // update summary quick counts (fast approximate)
    const totalUsers = users.length;
    const checkedToday = results.filter(r => r.checkedToday).length;
    const totalCheckins = results.reduce((s, r) => s + r.totalCheckins, 0);
    const totalRewards = results.reduce((s, r) => s + Number(r.totalRewards || 0), 0);

    el.totalUsers.textContent = totalUsers;
    el.checkedToday.textContent = checkedToday;
    el.totalCheckins.textContent = totalCheckins;
    el.totalRewards.textContent = fmtNaira(totalRewards);

    // store & render
    renderTable(results);
  }

  // ----- export CSV (current cache) -----
  function exportCSV() {
    const rows = [
      ['uid','displayName','email','checkedToday','totalCheckins','completedCycles','totalRewards','lastCheckin']
    ];
    statsCache.forEach(s => rows.push([s.uid, s.displayName, s.email, s.checkedToday ? 'YES' : 'NO', s.totalCheckins, s.completedCycles, s.totalRewards, s.lastCheckin]));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `checkin-stats-${todayStrLocal()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ----- simple XSS-safe text helper -----
  function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, function (m) {
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m];
    });
  }

  // ----- wire UI events -----
  function wireUI() {
    el.search.addEventListener('input', () => renderTable(statsCache));
    el.viewSelect.addEventListener('change', () => renderTable(statsCache));
    el.filterBtn.addEventListener('click', async () => {
      // basic date range client-side filter (on lastCheckin)
      const from = el.fromDate.value;
      const to = el.toDate.value;
      if (!from && !to) { renderTable(statsCache); return; }
      const filtered = statsCache.filter(s => {
        if (!s.lastCheckin || s.lastCheckin === '—') return false;
        try {
          const dt = new Date(s.lastCheckin);
          if (from && dt < new Date(from + 'T00:00:00')) return false;
          if (to && dt > new Date(to + 'T23:59:59')) return false;
          return true;
        } catch (e) { return false; }
      });
      renderTable(filtered);
    });

    el.exportCsvBtn.addEventListener('click', () => exportCSV());
    el.scanAllBtn.addEventListener('click', async () => {
      try {
        el.scanAllBtn.textContent = 'Scanning…';
        await recalcSummaryScan();
      } finally { el.scanAllBtn.textContent = 'Recalculate totals (scan all)'; }
    });

    el.realtimeToggle.addEventListener('change', () => {
      if (el.realtimeToggle.checked) {
        // basic real-time: re-run table every 8s (safe alternative to many listeners)
        window._admin_realtime_interval = setInterval(() => loadAdminTable(), 8000);
        showToast('Realtime polling enabled (every 8s)');
      } else {
        clearInterval(window._admin_realtime_interval);
        showToast('Realtime polling disabled');
      }
    });
  }

  // ----- toast -----
  function showToast(msg) {
    let t = document.getElementById('admin-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'admin-toast';
      t.className = 'fixed left-1/2 -translate-x-1/2 bottom-6 z-50 px-4 py-2 rounded-full';
      t.style.background = 'rgba(10,11,13,0.9)';
      t.style.color = 'white';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    setTimeout(() => { t.style.opacity = '0'; }, 2000);
  }

  // ----- public start function -----
  async function startAdminCheckin() {
    wireUI();
    await loadAdminTable();
    // also run a fast summary scan using per-user results (quick)
    // and a full scan can be done via the Recalculate button (collectionGroup).
    try { await recalcSummaryScan(); } catch (e) { console.warn('Summary scan failed (will still show per-user):', e); }
    showToast('Admin check-in dashboard loaded');
  }

  // expose
  window.startAdminCheckin = startAdminCheckin;

  // called from onAdminReady after auth

})();















/* ===== PAYMENTS SECTION FINAL FIX (DOM guaranteed) ===== */



/* ===== DEPOSITS MODULE ===== */
(function () {
  if (typeof firebase === "undefined" || !firebase.firestore) {
    console.error("Firebase not initialized.");
    return;
  }

  const db = firebase.firestore();

  // DOM elements
  const tbody = document.getElementById("p-deposits-tbody");
  const elToday = document.getElementById("p-deposits-today");
  const elYesterday = document.getElementById("p-deposits-yesterday");
  const elTotal = document.getElementById("p-deposits-total");

  function money(n) {
    return "₦" + Number(n || 0).toLocaleString();
  }
  function formatDate(ts) {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString();
  }
  function isSameDay(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }
  function subDays(date, n) {
    const x = new Date(date);
    x.setDate(x.getDate() - n);
    return x;
  }

  function startDepositsListener() {
    db.collection("Deposit")
    .orderBy("createdAt", "desc")
    .onSnapshot((snap) => {
      const deposits = [];
      snap.forEach((d) => deposits.push({ id: d.id, ...d.data() }));

      const now = new Date();
      const today = deposits.filter((d) => {
        const dt = d.createdAt?.toDate?.() || new Date(d.createdAt);
        return isSameDay(dt, now);
      }).length;
      const yesterday = deposits.filter((d) => {
        const dt = d.createdAt?.toDate?.() || new Date(d.createdAt);
        return isSameDay(dt, subDays(now, 1));
      }).length;

      elToday.textContent = today;
      elYesterday.textContent = yesterday;
      elTotal.textContent = deposits.length;

      tbody.innerHTML = "";
      if (deposits.length === 0) {
        tbody.innerHTML =
          '<tr><td colspan="6" class="py-3 text-center text-gray-400 text-sm">No deposits yet</td></tr>';
        return;
      }

      deposits.forEach((d) => {
        const tr = document.createElement("tr");
        tr.className = "border-t";
        tr.innerHTML = `
          <td class="py-3">${d.username || "-"}</td>
          <td>${d.userId || "-"}</td>
          <td>${money(d.amount)}</td>
          <td>${d.reference || "-"}</td>
          <td>${formatDate(d.createdAt)}</td>
          <td><span class="text-xs font-semibold ${
            d.status === "successful" ? "text-green-700" : "text-yellow-600"
          }">${d.status || ""}</span></td>
        `;
        tbody.appendChild(tr);
      });
    });
  } // end startDepositsListener
  window.startDepositsListener = startDepositsListener;
})();






			  
				
		  
/* ===== WITHDRAW (from Transaction collection, using "failed" instead of "rejected") ===== */
(function () {
  if (typeof firebase === "undefined" || !firebase.firestore) {
    console.error("Firebase not initialized.");
    return;
  }
  const db = firebase.firestore();

  const tbody = document.getElementById("p-withdraw-tbody");
  const elProc = document.getElementById("p-withdraw-processing");
  const elSucc = document.getElementById("p-withdraw-success");
  const elFail = document.getElementById("p-withdraw-failed");
  const filterSel = document.getElementById("p-withdraw-filter");

  function money(n) {
    return "₦" + Number(n || 0).toLocaleString();
  }

  function formatDate(ts) {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString();
  }

  function updateCounts(list) {
    elProc.textContent = list.filter((x) => x.status === "processing").length;
    elSucc.textContent = list.filter((x) => x.status === "successful").length;
    elFail.textContent = list.filter((x) => x.status === "failed").length;
  }

  function render(withdraws) {
    const filter = filterSel.value || "processing";
    let filtered = withdraws;
    if (filter === "processing")
      filtered = withdraws.filter((x) => x.status === "processing");
    else if (filter === "completed")
      filtered = withdraws.filter((x) =>
        ["successful", "failed"].includes(x.status)
      );

    tbody.innerHTML = "";
    if (filtered.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="8" class="py-3 text-center text-gray-400 text-sm">No data</td></tr>';
      return;
    }

    filtered.forEach((w) => {
      const tr = document.createElement("tr");
      tr.className = "border-t";
      tr.innerHTML = `
        <td>${w.userId || ""}</td>
        <td>${w.account_name || ""}</td>
        <td>${w.accNum || ""}</td>
        <td>${w.bankName || ""}</td>
        <td>${money(w.amount)}</td>
        <td>${formatDate(w.timestamp)}</td>
        <td>
          <span class="text-xs font-semibold ${
            w.status === "processing"
              ? "text-yellow-600"
              : w.status === "successful"
              ? "text-green-700"
              : "text-red-700"
          }">${w.status}</span>
        </td>
        <td>
          ${
            w.status === "processing"
              ? `
                <button class="bg-green-100 text-green-700 px-2 py-1 rounded text-xs mr-1" 
                  onclick="markTxSuccess('${w.id}')">✅</button>
                <button class="bg-red-100 text-red-700 px-2 py-1 rounded text-xs" 
                  onclick="markTxFailed('${w.id}','${w.userId}',${w.amount})">❌</button>`
              : `<span class="text-gray-400 text-xs">Done</span>`
          }
        </td>`;
      tbody.appendChild(tr);
    });
  }

  function startWithdrawalsListener() {
    db.collection("Transaction")
      .where("type", "==", "Withdraw")
      .orderBy("timestamp", "desc")
      .onSnapshot((snap) => {
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        render(list);
        updateCounts(list);
      });
  }
  window.startWithdrawalsListener = startWithdrawalsListener;

  filterSel.addEventListener("change", () => {
    db.collection("Transaction")
      .where("type", "==", "Withdraw")
      .orderBy("timestamp", "desc")
      .get()
      .then((snap) => {
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        render(list);
      });
  });

  // --- ACTIONS ---

  // ✅ Mark Successful
  window.markTxSuccess = async function (txId) {
    if (!confirm("Mark this withdrawal as successful?")) return;
    try {
      await db.collection("Transaction").doc(txId).update({ status: "successful" });
      alert("✅ Withdrawal marked as successful");
    } catch (e) {
      console.error("markTxSuccess err", e);
      alert("Error marking successful: " + e.message);
    }
  };

  // ❌ Mark Failed + Refund
  window.markTxFailed = async function (txId, userId, amount) {
    if (!confirm("Mark this withdrawal as failed and refund the user?")) return;
    try {
      await db.collection("Transaction").doc(txId).update({ status: "failed" });

      if (!userId) {
        alert("⚠️ userId missing — refund skipped");
        return;
      }

      const userRef = db.collection("users").doc(userId);
      const userSnap = await userRef.get();

      if (!userSnap.exists) {
        alert("⚠️ User not found — refund skipped");
        console.warn("No user document for", userId);
        return;
      }

      const data = userSnap.data();
      const current = Number(data.balance || 0);
      const amt = Number(amount) || 0;

      if (isNaN(current)) {
        await userRef.update({ balance: amt });
        console.log("Created balance field:", amt);
      } else {
        await userRef.update({
          balance: firebase.firestore.FieldValue.increment(amt),
        });
        console.log("Refunded ₦" + amt + " to user:", userId);
      }

      alert("❌ Withdrawal marked as failed and user refunded.");
    } catch (e) {
      console.error("markTxFailed err", e);
      alert("Refund failed: " + e.message);
    }
  };
})();







// EDIT JOB FUNCTION
  const jobListEl = document.getElementById("jobList");
  const jobSearchEl = document.getElementById("jobSearch");
  const refreshBtn = document.getElementById("refreshJobsBtn");

  
  let allJobs = [];

  // 🟢 Fetch all jobs from "tasks" & "affiliateJobs"
  async function fetchAllJobs() {
    jobListEl.innerHTML = `<p class="text-gray-500 text-center col-span-full">Fetching jobs...</p>`;
    allJobs = [];

    const collections = ["tasks", "affiliateJobs"];
    for (const coll of collections) {
      const snapshot = await db.collection(coll).get();
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        allJobs.push({
          id: docSnap.id,
          from: coll,
          ...data,
        });
      });
    }

    renderJobs(allJobs);
  }

  // 🎨 Render jobs beautifully
  function renderJobs(jobs) {
    if (!jobs.length) {
      jobListEl.innerHTML = `<p class="text-gray-500 text-center col-span-full">No jobs found.</p>`;
      return;
    }

    jobListEl.innerHTML = jobs
      .map(
        (job) => `
      <div class="bg-white rounded-2xl p-5 shadow-md hover:shadow-xl transition duration-300 border border-gray-100 relative overflow-hidden">

        <div class="absolute right-0 top-0 bg-gradient-to-l from-blue-600 text-white text-xs px-3 py-1 rounded-bl-2xl">
          ${job.from === "tasks" ? "Task Job" : "Affiliate Job"}
        </div>

        <div class="flex justify-between items-start mb-3">
          <div class="flex-1">
            <h3 class="text-lg font-semibold text-gray-900 leading-snug">${job.title || "Untitled Job"}</h3>
            <p class="text-sm text-gray-600 mt-1">${job.category || "General"} • Status: <span class="text-blue-600 capitalize">${job.status || "N/A"}</span></p>
          </div>
          <button onclick="deleteJob('${job.from}','${job.id}')"
            class="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm shadow-sm transition duration-200">
            Delete
          </button>
        </div>

        ${
          job.screenshotURL || job.campaignLogoURL
            ? `<img src="${job.screenshotURL || job.campaignLogoURL}" class="w-full h-40 object-cover rounded-xl mb-3 border border-gray-100">`
            : ""
        }

        <div class="text-sm text-gray-600 space-y-1">
          <p><span class="font-medium">Workers:</span> ${job.numWorkers || 0}</p>
          <p><span class="font-medium">Earnings per Worker:</span> ₦${job.workerPay || job.workerEarn || 0}</p>
          <p><span class="font-medium">Total Cost:</span> ₦${job.total || 0}</p>
        </div>

        <div class="mt-4 text-xs text-gray-400 flex justify-between items-center">
          <span>Posted: ${job.postedAt ? new Date(job.postedAt.seconds * 1000).toLocaleString() : "N/A"}</span>
          <span class="italic">${job.postedBy?.email || "Unknown"}</span>
        </div>
      </div>`
      )
      .join("");
  }

  // 🗑️ Delete job function
  async function deleteJob(collectionName, jobId) {
    if (!confirm("Are you sure you want to delete this job?")) return;
    try {
      await db.collection(collectionName).doc(jobId).delete();
      allJobs = allJobs.filter((j) => !(j.id === jobId && j.from === collectionName));
      renderJobs(allJobs);
      alert("✅ Job deleted successfully!");
    } catch (err) {
      console.error("Error deleting job:", err);
      alert("❌ Failed to delete job.");
    }
  }

  window.deleteJob = deleteJob;

  // 🔍 Search Filter
  jobSearchEl.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allJobs.filter((j) => j.title?.toLowerCase().includes(term));
    renderJobs(filtered);
  });

  refreshBtn.addEventListener("click", fetchAllJobs);
  // fetchAllJobs called on tab open after auth (removed DOMContentLoaded to avoid pre-auth read)










  //DEDUCTION SYSTEM

function initDeductionPanel() {
  // DOM elements
  const deductAllBtn = document.getElementById('deductAllBtn');
  const historyContainer = document.getElementById('deductionHistory');
  const totalUsersElem = document.getElementById('totalUsersAffected');
  const totalMoneyElem = document.getElementById('totalMoneyDeducted');
  const deductionCanvas = document.getElementById('deductionChart');

  if (!deductAllBtn || !historyContainer || !totalUsersElem || !totalMoneyElem || !deductionCanvas) {
    console.warn("Some admin deduction elements are missing. Deduction panel may not work fully.");
    return;
  }

  let deductionChart;

  // ========================
  // Load deduction history & chart
  // ========================
  async function loadDeductionHistory() {
    try {
      const snapshot = await db.collection('deduction_logs').orderBy('timestamp', 'asc').get();

      // Reset if no deductions
      if (snapshot.empty) {
        historyContainer.innerHTML = '<p class="text-gray-400 text-sm">No deductions yet.</p>';
        totalUsersElem.textContent = 0;
        totalMoneyElem.textContent = 0;
        if (deductionChart) deductionChart.destroy();
        deductionCanvas.getContext('2d').clearRect(0, 0, deductionCanvas.width, deductionCanvas.height);
        return;
      }

      let totalUsers = 0;
      let totalMoney = 0;
      const chartLabels = [];
      const chartData = [];
      historyContainer.innerHTML = '';

      snapshot.forEach(doc => {
        const log = doc.data();
        const date = log.timestamp?.toDate().toLocaleString() || 'Unknown';
        const users = log.affectedUsers || 0;
        const totalDeducted = log.totalDeducted || (log.amount * users);

        totalUsers += users;
        totalMoney += totalDeducted;

        chartLabels.push(date);
        chartData.push(totalDeducted);

        const div = document.createElement('div');
        div.className = "p-2 mb-2 border-b border-gray-200 bg-white rounded";
        div.innerHTML = `
          <p><strong>Date:</strong> ${date}</p>
          <p><strong>Amount Deducted per User:</strong> ₦${log.amount}</p>
          <p><strong>Condition:</strong> Balance > ₦${log.condition}</p>
          <p><strong>Users Affected:</strong> ${users}</p>
          <p><strong>Total Deducted:</strong> ₦${totalDeducted}</p>
        `;
        historyContainer.appendChild(div);
      });

      totalUsersElem.textContent = totalUsers;
      totalMoneyElem.textContent = totalMoney;

      // Only render chart if data exists
      if (chartLabels.length > 0 && chartData.length > 0) {
        if (deductionChart) deductionChart.destroy();
        const ctx = deductionCanvas.getContext('2d');
        if (ctx) {
          deductionChart = new Chart(ctx, {
            type: 'line',
            data: {
              labels: chartLabels,
              datasets: [{
                label: 'Total Deducted (₦)',
                data: chartData,
                fill: true,
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                borderColor: 'rgba(59, 130, 246, 1)',
                tension: 0.3
              }]
            },
            options: {
              responsive: true,
              plugins: { legend: { display: true }, tooltip: { mode: 'index', intersect: false } },
              scales: {
                x: { title: { display: true, text: 'Date/Time' } },
                y: { title: { display: true, text: 'Total Deducted (₦)' }, beginAtZero: true }
              }
            }
          });
        }
      } else {
        if (deductionChart) deductionChart.destroy();
        deductionCanvas.getContext('2d').clearRect(0, 0, deductionCanvas.width, deductionCanvas.height);
      }

    } catch (err) {
      console.warn("Error loading deduction history:", err);
      historyContainer.innerHTML = '<p class="text-red-500 text-sm">Error loading deduction history.</p>';
    }
  }

  // Initial load
  loadDeductionHistory();

  // ========================
  // Deduction button click
  // ========================
  deductAllBtn.addEventListener('click', async () => {
    const amount = parseFloat(document.getElementById('deductAmount').value);
    const condition = parseFloat(document.getElementById('balanceCondition').value);

    if (!amount || amount <= 0) {
      alert("Please enter a valid deduction amount!");
      return;
    }

    if (!confirm(`Are you sure you want to deduct ₦${amount} from users with balance greater than ₦${condition}?`)) return;

    try {
      const usersSnapshot = await db.collection('users').get();
      if (usersSnapshot.empty) {
        alert("No users found in the database.");
        return;
      }

      const batch = db.batch();
      let affectedUsers = 0;
      let totalDeducted = 0;

      usersSnapshot.forEach(doc => {
        const userRef = db.collection('users').doc(doc.id);
        const currentBalance = doc.data().balance || 0;

        if (currentBalance > condition) {
          const deduction = currentBalance - amount >= 0 ? amount : currentBalance;
          const newBalance = currentBalance - deduction;
          batch.update(userRef, { balance: newBalance });
          affectedUsers++;
          totalDeducted += deduction;
        }
      });

      if (affectedUsers === 0) {
        alert("No users met the condition. Nothing was deducted.");
        return;
      }

      await batch.commit();

      // Safe admin ID
      const adminId = firebase.auth().currentUser?.uid || "unknown";

      await db.collection('deduction_logs').add({
        amount: amount,
        condition: condition,
        affectedUsers: affectedUsers,
        totalDeducted: totalDeducted,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        adminId: adminId
      });

      alert(`Deduction complete! ₦${totalDeducted} deducted from ${affectedUsers} users.`);

      loadDeductionHistory();

    } catch (error) {
      console.warn("Deduction failed:", error);
      alert("Deduction failed. Check your console logs when possible.");
    }
  });
}
window.initDeductionPanel = initDeductionPanel;

// DASHBOARD NOTIFICATION ONLY
async function sendDashboardNotification() {
  const title = document.getElementById("notifTitle").value.trim();
  const message = document.getElementById("notifMessage").value.trim();

  if (!title || !message) {
    alert("Please enter both title and message.");
    return;
  }

  try {
    await firebase.firestore().collection("notifications").add({
      title,
      message,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert("Dashboard notification sent!");
  } catch (error) {
    console.error("Error sending dashboard notification:", error);
    alert("Error sending dashboard notification.");
  }
}




// LOAD NOTIFICATION HISTORY
async function loadNotificationHistory() {
  const list = document.getElementById("notifList");
  list.innerHTML = "<p class='text-gray-500'>Loading...</p>";

  const snapshot = await firebase.firestore()
    .collection("notifications")
    .orderBy("timestamp", "desc")
    .get();

  list.innerHTML = "";

  if (snapshot.empty) {
    list.innerHTML = "<p class='text-gray-500'>No notifications sent yet.</p>";
    return;
  }

  snapshot.forEach(doc => {
    const data = doc.data();
    const time = data.timestamp?.toDate().toLocaleString() || "No date";

    const item = document.createElement("div");
    item.className =
      "p-4 border rounded bg-white shadow flex justify-between items-start";

    item.innerHTML = `
      <div>
        <h3 class="font-bold text-lg text-gray-700">${data.title}</h3>
        <p class="text-gray-600">${data.message}</p>
        <p class="text-xs text-gray-400 mt-1">${time}</p>
      </div>

      <button onclick="deleteNotification('${doc.id}')" 
        class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded">
        Delete
      </button>
    `;

    list.appendChild(item);
  });
}





// DELETE ONLY DASHBOARD NOTIFICATION
async function deleteNotification(id) {
  if (!confirm("Are you sure you want to delete this notification?")) return;

  try {
    await firebase.firestore().collection("notifications").doc(id).delete();
    alert("Notification deleted!");

    loadNotificationHistory(); // refresh list
  } catch (error) {
    console.error("Error deleting notification:", error);
    alert("Failed to delete. Check console.");
  }
}






// Default email template
const defaultEmailTemplate = `

<div style="font-family: 'Segoe UI', system-ui, sans-serif; font-size: 16px; background-color: #f4f9ff; padding: 24px; border-radius: 12px; max-width: 600px; margin: auto; color: #333;">  
  <div style="text-align: center; margin-bottom: 20px;">  
    <a href="https://globalsplatform.com" target="_blank" style="text-decoration: none;">  
      <img src="cid:logo.png" alt="Globals Logo" style="height: 50px;" />  
    </a>  
  </div>  
  <p style="font-size: 18px; color: #1d4ed8; font-weight: 600;">Hello {{name}},</p>  
  <p style="margin: 16px 0; line-height: 1.6;">  
    You're One Step Away from Earning More Today!  
    <strong>"{{title}}"</strong>    
  </p>  
  <p style="margin-bottom: 16px;">  
    {{message}}  
  </p>  
  <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;" />  
  <p style="font-size: 14px; color: #777;">  
    Thank you for using <strong>Globals</strong> 💙 <br />  
    <a href="https://globals-myzv.onrender.com/" style="color: #3b82f6; text-decoration: none;">Visit your dashboard</a> |  
    <a href="mailto:sglobalsplatform@gmail.com" style="color: #3b82f6; text-decoration: none;">Contact Support</a>  
  </p>  
</div>  
`; // Load saved template on admin page open
window.addEventListener("DOMContentLoaded", () => {
const savedTemplate = localStorage.getItem("emailTemplate");
document.getElementById("emailTemplateEditor").value = savedTemplate || defaultEmailTemplate;
});

// Save template
function saveEmailTemplate() {
const template = document.getElementById("emailTemplateEditor").value;
localStorage.setItem("emailTemplate", template);
alert("✅ Email template saved!");
}

// Reset template
function resetEmailTemplate() {
document.getElementById("emailTemplateEditor").value = defaultEmailTemplate;
localStorage.removeItem("emailTemplate");
alert("🔄 Template reset to default.");
}


async function sendEmailNotification() {
    const title = document.getElementById("notifTitle").value;
    const message = document.getElementById("notifMessage").value;

    if (!title || !message) {
        alert("⚠️ Please enter both a title and a message");
        return;
    }

    try {
        const res = await fetch("https://admin-globals.onrender.com/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, message })
        });

        const data = await res.json();
        if (data.success) {
            alert(`✅ ${data.message}`);
        } else {
            alert("❌ Failed to send email: " + data.error);
        }
    } catch (err) {
        console.error(err);
        alert("❌ An error occurred while sending email.");
    }
}






// --- Load Everything — fires ONLY after Firebase Auth confirms sign-in ---
// onAdminReady() is called by the auth gate in initAdminAuth() above.
window.onAdminReady = function () {
  // ── Core data loads ──────────────────────────────────────────────
  fetchStats();
  startUsersModule();
  fetchPendingJobsForAdmin();
  loadNotificationHistory();
  loadTaskSubmissions();

  // ── Modules that previously auto-fired before auth ───────────────
  if (typeof startAdminReferrals  === 'function') startAdminReferrals().catch(console.error);
  if (typeof startAdminPremium    === 'function') startAdminPremium().catch(console.error);
  if (typeof startAdminCheckin    === 'function') startAdminCheckin().catch(console.error);
  if (typeof startDepositsListener    === 'function') startDepositsListener();
  if (typeof startWithdrawalsListener === 'function') startWithdrawalsListener();
  if (typeof initDeductionPanel   === 'function') initDeductionPanel();

  // ── Bills ─────────────────────────────────────────────────────────
  switchBillType('airtime');
  switchBillStatus('processing');

  // ── Lazy-load tabs on first click ─────────────────────────────────
  const tabActions = {
    'admin-ludo':     () => { if (typeof ludoAdminLoad     === 'function') ludoAdminLoad();     },
    'admin-survey':   () => { if (typeof surveyAdminLoad   === 'function') surveyAdminLoad();   },
    'admin-edustore': () => { if (typeof edustoreAdminLoad === 'function') edustoreAdminLoad(); },
    'admin-rateus':   () => { if (typeof rateusLoad        === 'function') rateusLoad();        },
    'admin-ai-logs':  () => { if (typeof aiLogsLoad        === 'function') aiLogsLoad();        },
  };
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const m = (btn.getAttribute('onclick')||'').match(/switchTab\('([^']+)'/);
      if (m && tabActions[m[1]]) tabActions[m[1]]();
    });
  });
};

// ✅ Expose functions globally
window.loadBillsAdmin   = loadBillsAdmin;
window.reviewBill       = reviewBill;
window.switchBillType   = switchBillType;
window.switchBillStatus = switchBillStatus;




























































// ═══════════════════════════════════════════════════════════════════════
//  LUDO ARENA ADMIN MODULE
// ═══════════════════════════════════════════════════════════════════════
(function LudoAdminModule() {
  function _s(id,v){const el=document.getElementById(id);if(el)el.textContent=v;}
  function _m(n){'₦'+Number(n||0).toLocaleString();}
  function money(n){return '₦'+Number(n||0).toLocaleString();}
  function fmt(ts){if(!ts)return'—';try{return(ts.toDate?ts.toDate():new Date(ts)).toLocaleString('en-NG',{dateStyle:'short',timeStyle:'short'});}catch{return'—';}}

  async function ludoAdminLoad(){
    _s('ludo-active-rooms','…');_s('ludo-bet-rooms-count','…');
    _s('ludo-total-payouts','…');_s('ludo-win-count','…');
    try{
      const [roomsSnap,betSnap,txSnap]=await Promise.all([
        db.collection('ludo_rooms').get(),
        db.collection('ludo_bet_rooms').get(),
        db.collection('ludo_transactions').orderBy('timestamp','desc').limit(50).get(),
      ]);
      const active=roomsSnap.docs.filter(d=>d.data().status!=='finished').length;
      _s('ludo-active-rooms',active);
      _s('ludo-bet-rooms-count',betSnap.size);
      let total=0; txSnap.docs.forEach(d=>{total+=Number(d.data().amount||0);});
      _s('ludo-total-payouts',money(total));
      _s('ludo-win-count',txSnap.size);
      const ovEl=document.getElementById('ludo-payout-overview');
      if(ovEl)ovEl.textContent=money(total);
      // Bet rooms list
      const bl=document.getElementById('ludo-bet-rooms-list');
      if(bl){
        if(!betSnap.size){bl.innerHTML='<div style="color:rgba(255,255,255,.3);text-align:center;padding:24px;">No bet rooms yet</div>';}
        else{bl.innerHTML=betSnap.docs.slice(0,30).map(doc=>{
          const d=doc.data();
          const sc=d.status==='finished'?'#34d399':d.status==='playing'?'#f97316':'#60a5fa';
          return `<div style="background:rgba(255,255,255,.05);border-radius:10px;padding:12px;margin-bottom:8px;font-size:.8rem;">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
              <span style="font-weight:700;">${doc.id.slice(0,12)}…</span>
              <span style="color:${sc};font-weight:600;font-size:.72rem;text-transform:uppercase;">${d.status||'unknown'}</span>
            </div>
            <div style="color:rgba(255,255,255,.55);display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:.78rem;">
              <span>Stake: <b style="color:#f97316">${money(d.stake)}</b></span>
              <span>Win: <b style="color:#34d399">${money(d.winAmount)}</b></span>
              ${d.winner?`<span style="grid-column:1/-1;color:#fbbf24;">🏆 Winner: ${d.winner.slice(0,14)}</span>`:''}
            </div>
          </div>`;
        }).join('');}
      }
      // Tx list
      const tl=document.getElementById('ludo-tx-list');
      if(tl){
        if(!txSnap.size){tl.innerHTML='<div style="color:rgba(255,255,255,.3);text-align:center;padding:24px;">No transactions yet</div>';}
        else{tl.innerHTML=`<table style="width:100%;border-collapse:collapse;font-size:.78rem;">
          <thead><tr style="color:rgba(255,255,255,.4);text-align:left;border-bottom:1px solid rgba(255,255,255,.08);">
            <th style="padding:6px 8px;">Type</th><th style="padding:6px 8px;">Amount</th><th style="padding:6px 8px;">UID</th><th style="padding:6px 8px;">Date</th>
          </tr></thead>
          <tbody>${txSnap.docs.map(doc=>{const d=doc.data();const c=d.type==='ludo_win'?'#34d399':'#f97316';
            return`<tr style="border-bottom:1px solid rgba(255,255,255,.05);color:rgba(255,255,255,.8);">
              <td style="padding:6px 8px;color:${c};font-weight:600;">${d.type||'—'}</td>
              <td style="padding:6px 8px;font-weight:700;">${money(d.amount)}</td>
              <td style="padding:6px 8px;font-size:.7rem;opacity:.6;">${(d.uid||'—').slice(0,14)}</td>
              <td style="padding:6px 8px;opacity:.5;">${fmt(d.timestamp)}</td>
            </tr>`;}).join('')}</tbody>
        </table>`;}
      }
    }catch(e){console.error('[Ludo Admin]',e);}
  }
  window.ludoAdminLoad=ludoAdminLoad;
})();


// ═══════════════════════════════════════════════════════════════════════
//  SURVEY ADMIN MODULE
// ═══════════════════════════════════════════════════════════════════════
(function SurveyAdminModule(){
  'use strict';
  let _allTx = [], _filter = 'all';

  function _s(id,v){ const el=document.getElementById(id); if(el) el.textContent=v; }
  function money(n){ return '₦'+Number(n||0).toLocaleString(); }
  // Server writes 'timestamp' on earn records, 'timestamp' on withdraw records
  function fmt(ts){
    if(!ts) return '—';
    try{ return (ts.toDate?ts.toDate():new Date(ts)).toLocaleString('en-NG',{dateStyle:'short',timeStyle:'short'}); }
    catch{ return '—'; }
  }

  async function surveyAdminLoad(){
    _s('survey-total-usd','…'); _s('survey-total-naira','…');
    _s('survey-earners-count','…'); _s('survey-completed-count','…');
    const tbody = document.getElementById('survey-tx-body');
    if(tbody) tbody.innerHTML='<tr><td colspan="6" style="text-align:center;padding:24px;color:rgba(255,255,255,.4);" class="animate-pulse">Loading…</td></tr>';

    try{
      // Use 'timestamp' — that's what server actually writes on all survey_transactions docs
      const txSnap = await db.collection('survey_transactions')
        .orderBy('timestamp','desc').limit(300).get();

      _allTx = txSnap.docs.map(d => ({ id:d.id, ...d.data() }));

      let usd=0, naira=0, earnCount=0;
      const earnerUids = new Set();

      _allTx.forEach(d => {
        // earn records
        if(d.type === 'earn'){
          usd += Number(d.usdAmount || 0);
          earnCount++;
          if(d.userId) earnerUids.add(d.userId);
        }
        // withdraw records
        if(d.type === 'withdraw'){
          naira += Number(d.nairaAmount || 0);
          if(d.userId) earnerUids.add(d.userId);
        }
      });

      _s('survey-total-usd', '$'+usd.toFixed(2));
      _s('survey-total-naira', money(naira));
      _s('survey-earners-count', earnerUids.size);
      _s('survey-completed-count', earnCount);

      surveyFilterType(_filter);
    } catch(e){
      console.error('[Survey Admin]', e);
      const tbody2 = document.getElementById('survey-tx-body');
      if(tbody2) tbody2.innerHTML=`<tr><td colspan="6" style="text-align:center;padding:24px;color:#f87171;">Error: ${e.message}<br><small>If index missing, go to Firebase Console → Firestore → Indexes and create: survey_transactions | timestamp DESC</small></td></tr>`;
    }
  }

  function surveyFilterType(type){
    _filter = type;
    ['all','earn','withdraw'].forEach(t => {
      const el = document.getElementById(`survey-filter-${t}`); if(!el) return;
      el.style.background = t===type ? '#14b8a6' : 'rgba(255,255,255,.08)';
      el.style.color       = t===type ? '#fff'   : 'rgba(255,255,255,.7)';
    });
    const rows = type==='all' ? _allTx : _allTx.filter(d => d.type === type);
    const tbody = document.getElementById('survey-tx-body'); if(!tbody) return;
    if(!rows.length){
      tbody.innerHTML='<tr><td colspan="6" style="text-align:center;padding:24px;color:rgba(255,255,255,.3);">No transactions found</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(d => {
      const isEarn = d.type==='earn';
      const c = isEarn ? '#34d399' : '#f87171';
      return `<tr style="border-bottom:1px solid rgba(255,255,255,.06);">
        <td style="padding:8px 10px;color:${c};font-weight:600;">${isEarn?'💰 Earn':'💸 Withdraw'}</td>
        <td style="padding:8px 10px;font-size:.72rem;opacity:.6;">${(d.userId||'—').slice(0,16)}</td>
        <td style="padding:8px 10px;font-weight:700;">$${Number(d.usdAmount||0).toFixed(2)}</td>
        <td style="padding:8px 10px;">${d.nairaAmount ? money(d.nairaAmount) : '—'}</td>
        <td style="padding:8px 10px;opacity:.7;">${d.providerName||d.provider||'—'}</td>
        <td style="padding:8px 10px;opacity:.5;font-size:.72rem;">${fmt(d.timestamp||d.createdAt)}</td>
      </tr>`;
    }).join('');
  }

  window.surveyAdminLoad  = surveyAdminLoad;
  window.surveyFilterType = surveyFilterType;
})();


(function EduStoreAdminModule(){
  function _s(id,v){const el=document.getElementById(id);if(el)el.textContent=v;}
  function money(n){return '₦'+Number(n||0).toLocaleString();}
  function fmt(ts){if(!ts)return'—';try{return(ts.toDate?ts.toDate():new Date(ts)).toLocaleString('en-NG',{dateStyle:'short',timeStyle:'short'});}catch{return'—';}}
  function esc(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]);}

  async function edustoreAdminLoad(){
    _s('edu-store-count','…');_s('edu-tx-count','…');
    _s('edu-merchant-rev','…');_s('edu-merchant-profit','…');
    try{
      const [storesSnap,txSnap]=await Promise.all([
        db.collection('stores').get(),
        db.collection('store_transactions').orderBy('timestamp','desc').limit(100).get(),
      ]);
      let rev=0,profit=0;
      txSnap.docs.forEach(d=>{rev+=Number(d.data().merchantPrice||0);profit+=Number(d.data().merchantProfit||0);});
      _s('edu-store-count',storesSnap.size);
      _s('edu-tx-count',txSnap.size);
      _s('edu-merchant-rev',money(rev));
      _s('edu-merchant-profit',money(profit));
      const ovEl=document.getElementById('store-count-overview');if(ovEl)ovEl.textContent=storesSnap.size;

      // Stores list
      const sl=document.getElementById('edu-stores-list');
      if(sl){
        if(!storesSnap.size){sl.innerHTML='<div style="color:rgba(255,255,255,.3);text-align:center;padding:24px;">No stores yet</div>';}
        else{sl.innerHTML=storesSnap.docs.map(doc=>{
          const d=doc.data();
          const svcs=Object.entries(d.services||{}).filter(([,v])=>v.enabled).map(([k])=>k.toUpperCase()).join(', ');
          const sc=d.status==='active'?'#34d399':'#f87171';
          return`<div style="background:rgba(255,255,255,.05);border-radius:10px;padding:14px;margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
              <div><div style="font-weight:700;font-size:.9rem;">${esc(d.businessName||doc.id)}</div>
              <div style="font-size:.72rem;opacity:.5;">/${esc(doc.id)}.globalstasks.name.ng</div></div>
              <span style="color:${sc};font-size:.72rem;font-weight:600;text-transform:uppercase;">${d.status||'active'}</span>
            </div>
            <div style="font-size:.78rem;color:rgba(255,255,255,.55);display:grid;grid-template-columns:1fr 1fr;gap:4px;">
              <span>Services: <b style="color:#fb923c">${esc(svcs||'—')}</b></span>
              <span>Txns: <b style="color:#60a5fa">${d.totalTransactions||0}</b></span>
              <span>Revenue: <b style="color:#34d399">${money(d.totalRevenue)}</b></span>
              <span style="font-size:.7rem;opacity:.5;">Created: ${fmt(d.createdAt)}</span>
            </div>
          </div>`;
        }).join('');}
      }

      // Tx list
      const tl=document.getElementById('edu-tx-list');
      if(tl){
        if(!txSnap.size){tl.innerHTML='<div style="color:rgba(255,255,255,.3);text-align:center;padding:24px;">No transactions yet</div>';}
        else{tl.innerHTML=`<table style="width:100%;border-collapse:collapse;font-size:.78rem;">
          <thead><tr style="color:rgba(255,255,255,.4);text-align:left;border-bottom:1px solid rgba(255,255,255,.08);">
            <th style="padding:6px 8px;">Store</th><th style="padding:6px 8px;">Plan</th>
            <th style="padding:6px 8px;">Paid</th><th style="padding:6px 8px;">Profit</th>
            <th style="padding:6px 8px;">Status</th><th style="padding:6px 8px;">Date</th>
          </tr></thead>
          <tbody>${txSnap.docs.map(doc=>{const d=doc.data();
            const sc=d.status==='delivered'?'#34d399':d.status==='failed'?'#f87171':'#fbbf24';
            return`<tr style="border-bottom:1px solid rgba(255,255,255,.05);color:rgba(255,255,255,.8);">
              <td style="padding:6px 8px;opacity:.8;">${esc(d.storeSlug||'—')}</td>
              <td style="padding:6px 8px;opacity:.7;font-size:.72rem;">${esc(d.planName||d.serviceID||'—')}</td>
              <td style="padding:6px 8px;font-weight:700;">${money(d.merchantPrice)}</td>
              <td style="padding:6px 8px;color:#34d399;font-weight:600;">${money(d.merchantProfit)}</td>
              <td style="padding:6px 8px;color:${sc};font-weight:600;font-size:.72rem;">${d.status||'—'}</td>
              <td style="padding:6px 8px;opacity:.5;font-size:.72rem;">${fmt(d.timestamp)}</td>
            </tr>`;}).join('')}</tbody>
        </table>`;}
      }
    }catch(e){console.error('[EduStore Admin]',e);}
  }
  window.edustoreAdminLoad=edustoreAdminLoad;
})();


// ═══════════════════════════════════════════════════════════════════════════
//  RATE US ADMIN MODULE
// ═══════════════════════════════════════════════════════════════════════════
(function RateUsAdminModule() {
  'use strict';

  let _all = [];

  function _s(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }
  function _esc(s) {
    return String(s || '').replace(/[&<>"']/g, m =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[m]);
  }
  function _fmt(ts) {
    if (!ts) return '—';
    try { return (ts.toDate ? ts.toDate() : new Date(ts))
      .toLocaleString('en-NG', { dateStyle:'medium', timeStyle:'short' }); }
    catch { return '—'; }
  }
  function _stars(n) {
    return '★'.repeat(Math.max(0, Math.min(5, n || 0))) +
           '☆'.repeat(Math.max(0, 5 - Math.min(5, n || 0)));
  }
  function _starColor(n) {
    if (n >= 5) return '#10b981';
    if (n >= 3) return '#f59e0b';
    return '#ef4444';
  }

  async function rateusLoad() {
    const container = document.getElementById('rateus-container');
    if (!container) return;
    container.innerHTML = '<div class="text-center py-16 text-gray-400 col-span-3 animate-pulse">Loading reviews…</div>';

    const filter = (document.getElementById('rateus-star-filter') || {}).value || 'all';

    try {
      let q = db.collection('RateUs').orderBy('submittedAt', 'desc').limit(200);
      const snap = await q.get();

      _all = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Summary stats (always on full dataset)
      const total = _all.length;
      const avg   = total ? (_all.reduce((a, d) => a + (Number(d.stars) || 0), 0) / total).toFixed(1) : '—';
      const five  = _all.filter(d => d.stars === 5).length;
      const three = _all.filter(d => d.stars >= 3 && d.stars <= 4).length;
      const low   = _all.filter(d => d.stars <= 2).length;

      _s('rateus-total', total);
      _s('rateus-avg',   avg + (total ? ' ⭐' : ''));
      _s('rateus-5',     five);
      _s('rateus-34',    three);
      _s('rateus-12',    low);

      // Apply filter
      const filtered = filter === 'all' ? _all : _all.filter(d => String(d.stars) === filter);

      if (!filtered.length) {
        container.innerHTML = '<div class="text-center py-16 text-gray-400 col-span-3">No reviews for this filter.</div>';
        return;
      }

      container.innerHTML = '';
      filtered.forEach(d => {
        const card = document.createElement('div');
        card.className = 'bg-white rounded-2xl shadow-md p-5 border border-gray-100';

        const loveTags = (d.loves || []).map(l =>
          `<span style="background:#e8f5e9;color:#166534;padding:3px 10px;border-radius:20px;font-size:.72rem;font-weight:600;">${_esc(l)}</span>`
        ).join('');
        const improveTags = (d.improvements || []).map(i =>
          `<span style="background:#fef3c7;color:#92400e;padding:3px 10px;border-radius:20px;font-size:.72rem;font-weight:600;">${_esc(i)}</span>`
        ).join('');

        card.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
            <div>
              <div style="font-weight:700;font-size:.9rem;color:#1e293b;">
                ${_esc(d.username || 'Anonymous')}
              </div>
              <div style="font-size:.72rem;color:#94a3b8;margin-top:1px;">${_fmt(d.submittedAt)}</div>
            </div>
            <div style="font-size:1.3rem;color:${_starColor(d.stars)};font-weight:800;letter-spacing:2px;">
              ${_stars(d.stars)}
              <span style="font-size:.8rem;margin-left:4px;">(${d.stars || 0})</span>
            </div>
          </div>
          ${d.comment ? `<p style="font-size:.85rem;color:#374151;line-height:1.55;margin-bottom:10px;font-style:italic;">"${_esc(d.comment)}"</p>` : ''}
          ${loveTags    ? `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:6px;"><span style="font-size:.72rem;color:#475569;margin-right:4px;font-weight:600;">Loves:</span>${loveTags}</div>` : ''}
          ${improveTags ? `<div style="display:flex;flex-wrap:wrap;gap:5px;"><span style="font-size:.72rem;color:#475569;margin-right:4px;font-weight:600;">Improve:</span>${improveTags}</div>` : ''}
          <div style="margin-top:10px;padding-top:8px;border-top:1px solid #f1f5f9;font-size:.7rem;color:#94a3b8;font-mono;">
            UID: ${_esc((d.uid || '—').slice(0, 20))}
          </div>`;
        container.appendChild(card);
      });

    } catch(e) {
      console.error('[RateUs Admin]', e);
      if (container) container.innerHTML = `<div class="col-span-3 text-center py-8 text-red-500">Error loading reviews: ${e.message}</div>`;
    }
  }

  window.rateusLoad = rateusLoad;
})();


// ═══════════════════════════════════════════════════════════════════════════
//  AI ACTIVITY LOGS ADMIN MODULE
//  Collections: ai_chat_logs | ai_search_logs | ai_task_writer_logs | ai_smart_insight_logs
//  All written server-side via Admin SDK — client cannot forge these.
// ═══════════════════════════════════════════════════════════════════════════
(function AiLogsAdminModule() {
  'use strict';

  let _currentTab = 'chat';
  let _chatByUser = {};   // uid → [{message,replySnip,model,hasImage,timestamp}]

  const COLLECTIONS = {
    chat:    'ai_chat_logs',
    search:  'ai_search_logs',
    writer:  'ai_task_writer_logs',
    insight: 'ai_smart_insight_logs',
  };
  const TAB_IDS = {
    chat:'ai-log-tab-chat', search:'ai-log-tab-search',
    writer:'ai-log-tab-writer', insight:'ai-log-tab-insight',
  };
  const STAT_IDS = {
    chat:'ai-stat-chat', search:'ai-stat-search',
    writer:'ai-stat-writer', insight:'ai-stat-insight',
  };

  function _s(id,v){ const el=document.getElementById(id); if(el) el.textContent=v; }
  function _esc(s){ return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]); }
  function _fmt(ts){
    if(!ts) return '—';
    try{ return (ts.toDate?ts.toDate():new Date(ts)).toLocaleString('en-NG',{dateStyle:'medium',timeStyle:'short'}); }
    catch{ return '—'; }
  }

  function _setActiveTab(tab){
    _currentTab = tab;
    Object.entries(TAB_IDS).forEach(([k,id]) => {
      const el = document.getElementById(id); if(!el) return;
      const active = k===tab;
      el.style.background = active ? '#3b82f6' : 'rgba(255,255,255,.08)';
      el.style.color       = active ? '#fff'   : 'rgba(255,255,255,.7)';
      el.style.border      = active ? 'none'   : '1px solid rgba(255,255,255,.1)';
    });
  }

  // ── Chat tab: per-user conversation cards ──────────────────────────
  function _renderChatUsers(docs) {
    const wrap = document.getElementById('ai-logs-table-wrap'); if(!wrap) return;

    // Group by uid
    _chatByUser = {};
    docs.forEach(d => {
      const uid = d.uid||'anonymous';
      if(!_chatByUser[uid]) _chatByUser[uid] = [];
      _chatByUser[uid].push(d);
    });

    const uids = Object.keys(_chatByUser);
    if(!uids.length){
      wrap.innerHTML='<div style="color:rgba(255,255,255,.3);text-align:center;padding:40px;">No chat logs yet.</div>';
      return;
    }

    wrap.innerHTML = `
      <div style="margin-bottom:12px;font-size:.8rem;color:rgba(255,255,255,.4);">
        ${uids.length} unique users — click a card to view their full conversation
      </div>
      <div id="chat-user-cards" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;"></div>
      <div id="chat-thread-modal" style="display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.7);align-items:center;justify-content:center;">
        <div style="background:#0e1a3a;border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:24px;width:min(700px,92vw);max-height:80vh;overflow-y:auto;position:relative;">
          <button onclick="document.getElementById('chat-thread-modal').style.display='none'"
            style="position:absolute;top:12px;right:12px;background:rgba(255,255,255,.1);border:none;color:#fff;padding:4px 12px;border-radius:8px;cursor:pointer;">✕ Close</button>
          <h3 id="chat-thread-title" style="font-weight:700;margin-bottom:16px;font-size:.95rem;padding-right:60px;"></h3>
          <div id="chat-thread-body"></div>
        </div>
      </div>`;

    const cardGrid = document.getElementById('chat-user-cards');
    uids.forEach(uid => {
      const msgs = _chatByUser[uid];
      // sort by timestamp asc for thread display
      msgs.sort((a,b) => {
        const ta = a.timestamp?.toDate?.()?.getTime() || 0;
        const tb = b.timestamp?.toDate?.()?.getTime() || 0;
        return ta - tb;
      });
      const last = msgs[msgs.length-1];
      const card = document.createElement('div');
      card.style.cssText = 'background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:14px;cursor:pointer;transition:background .15s;';
      card.onmouseover = () => card.style.background='rgba(255,255,255,.09)';
      card.onmouseout  = () => card.style.background='rgba(255,255,255,.05)';
      card.onclick = () => _openThread(uid);
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
          <div style="font-size:.72rem;font-family:monospace;color:rgba(255,255,255,.5);">${_esc(uid.slice(0,20))}</div>
          <span style="background:rgba(59,130,246,.3);color:#93c5fd;font-size:.7rem;padding:2px 8px;border-radius:20px;">${msgs.length} msg${msgs.length!==1?'s':''}</span>
        </div>
        <div style="font-size:.82rem;color:rgba(255,255,255,.8);margin-bottom:6px;line-height:1.4;">
          "${_esc((last.message||'[image]').slice(0,80))}${(last.message||'').length>80?'…':''}"
        </div>
        <div style="font-size:.7rem;color:rgba(255,255,255,.35);">${_fmt(last.timestamp)} · ${last.hasImage?'🖼️ image · ':''}${last.model||''}</div>`;
      cardGrid.appendChild(card);
    });
  }

  function _openThread(uid) {
    const msgs = _chatByUser[uid] || [];
    const modal = document.getElementById('chat-thread-modal');
    const title = document.getElementById('chat-thread-title');
    const body  = document.getElementById('chat-thread-body');
    if(!modal||!title||!body) return;

    title.textContent = 'Conversation — ' + uid;
    body.innerHTML = msgs.map(d => `
      <div style="margin-bottom:14px;">
        <div style="font-size:.7rem;color:rgba(255,255,255,.35);margin-bottom:4px;">${_fmt(d.timestamp)}</div>
        <div style="background:rgba(59,130,246,.15);border-radius:10px 10px 10px 2px;padding:10px 14px;margin-bottom:6px;">
          <div style="font-size:.7rem;color:#93c5fd;margin-bottom:4px;font-weight:600;">👤 User</div>
          <div style="font-size:.85rem;color:rgba(255,255,255,.85);">${_esc(d.hasImage ? '[Sent an image]' : d.message||'')}</div>
        </div>
        <div style="background:rgba(52,211,153,.12);border-radius:2px 10px 10px 10px;padding:10px 14px;margin-left:16px;">
          <div style="font-size:.7rem;color:#6ee7b7;margin-bottom:4px;font-weight:600;">🤖 AI · ${_esc(d.model||'')}</div>
          <div style="font-size:.85rem;color:rgba(255,255,255,.8);">${_esc(d.replySnip||'')}${d.replySnip&&d.replySnip.length>=200?'… <span style="opacity:.4">[truncated]</span>':''}</div>
        </div>
      </div>`).join('');
    modal.style.display = 'flex';
  }
  window._openChatThread = _openThread;

  // ── Generic table for search/writer/insight ────────────────────────
  function _renderTable(tab, docs) {
    const wrap = document.getElementById('ai-logs-table-wrap'); if(!wrap) return;
    if(!docs.length){
      wrap.innerHTML='<div style="color:rgba(255,255,255,.3);text-align:center;padding:40px;">No logs yet.</div>';
      return;
    }
    let headers='', rowFn;
    if(tab==='search'){
      headers='<th>UID</th><th>Query</th><th>Answer Snippet</th><th>Navigations</th><th>Date</th>';
      rowFn=d=>`<td>${_esc((d.uid||'—').slice(0,16))}</td><td style="max-width:200px;">${_esc(d.query||'—')}</td><td style="max-width:180px;opacity:.7;">${_esc(d.answerSnip||'—')}</td><td style="opacity:.6;font-size:.72rem;">${_esc(d.suggestions||'—')}</td><td style="opacity:.5;font-size:.72rem;">${_fmt(d.timestamp)}</td>`;
    } else if(tab==='writer'){
      headers='<th>UID</th><th>Category</th><th>Subcategory</th><th>Hint</th><th>Title Generated</th><th>Date</th>';
      rowFn=d=>`<td>${_esc((d.uid||'—').slice(0,16))}</td><td>${_esc(d.category||'—')}</td><td style="opacity:.7;">${_esc(d.subcategory||'—')}</td><td style="max-width:140px;opacity:.6;">${_esc(d.hint||'—')}</td><td style="max-width:180px;">${_esc(d.titleSnip||'—')}</td><td style="opacity:.5;font-size:.72rem;">${_fmt(d.timestamp)}</td>`;
    } else {
      headers='<th>UID</th><th>Category</th><th>Workers</th><th>Pay</th><th>Score</th><th>Verdict</th><th>Date</th>';
      rowFn=d=>{const c=d.score>=80?'#34d399':d.score>=60?'#fbbf24':'#f87171'; return`<td>${_esc((d.uid||'—').slice(0,16))}</td><td>${_esc(d.category||'—')} / ${_esc(d.subcategory||'—')}</td><td style="text-align:center;">${d.numWorkers||0}</td><td>₦${Number(d.workerPay||0).toLocaleString()}</td><td style="font-weight:800;color:${c};">${d.score||0}</td><td style="max-width:180px;opacity:.7;">${_esc(d.verdict||'—')}</td><td style="opacity:.5;font-size:.72rem;">${_fmt(d.timestamp)}</td>`;};
    }
    wrap.innerHTML=`<table style="width:100%;border-collapse:collapse;font-size:.8rem;min-width:600px;">
      <thead><tr style="color:rgba(255,255,255,.45);text-align:left;border-bottom:1px solid rgba(255,255,255,.08);position:sticky;top:0;background:#0b1635;">
        ${headers.replace(/<th>/g,'<th style="padding:8px 10px;font-weight:600;">')}
      </tr></thead>
      <tbody>${docs.map(d=>`<tr style="border-bottom:1px solid rgba(255,255,255,.04);">${rowFn(d).replace(/<td/g,'<td style="padding:8px 10px;vertical-align:top;" ')}</tr>`).join('')}</tbody>
    </table>`;
  }

  async function _loadTab(tab) {
    _setActiveTab(tab);
    const wrap = document.getElementById('ai-logs-table-wrap');
    if(wrap) wrap.innerHTML='<div style="color:rgba(255,255,255,.3);text-align:center;padding:40px;" class="animate-pulse">Loading…</div>';
    try{
      const snap = await db.collection(COLLECTIONS[tab]).orderBy('timestamp','desc').limit(200).get();
      const docs = snap.docs.map(d=>({id:d.id,...d.data()}));
      _s(STAT_IDS[tab], snap.size);
      if(tab==='chat') _renderChatUsers(docs);
      else _renderTable(tab, docs);
    }catch(e){
      console.error('[AI Logs]', tab, e);
      if(wrap) wrap.innerHTML=`<div style="color:#f87171;text-align:center;padding:32px;">Error: ${e.message}</div>`;
    }
  }

  async function aiLogsLoad() {
    // Load count summaries quickly for all tabs
    Object.entries(COLLECTIONS).forEach(([k,col]) => {
      db.collection(col).orderBy('timestamp','desc').limit(1).get()
        .then(()=> {})
        .catch(()=> _s(STAT_IDS[k],'—'));
    });
    await _loadTab(_currentTab);
  }

  function aiLogsSwitch(tab){ _loadTab(tab); }

  window.aiLogsLoad   = aiLogsLoad;
  window.aiLogsSwitch = aiLogsSwitch;
})();
