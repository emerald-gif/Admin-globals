// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyCuI_Nw4HMbDWa6wR3FhHJMHOUgx53E40c",
  authDomain: "globals-17bf7.firebaseapp.com",
  projectId: "globals-17bf7",
  storageBucket: "globals-17bf7.appspot.com",
  messagingSenderId: "603274362994",
  appId: "1:603274362994:web:c312c10cf0a42938e882eb"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

console.log("✅ Firebase Initialized - Admin Dashboard Connected");






// --- Tab Switchings Logic ---
function switchTab(tabId) {
  document.querySelectorAll('.tab').forEach(tab => tab.classList.add('hidden'));
  document.getElementById(tabId).classList.remove('hidden');
}





// --- Fetch Overview Stats ---
async function fetchStats() {
  const [usersSnap, tasksSnap, withdrawalSnap] = await Promise.all([
    db.collection('users').get(),
    db.collection('tasks').get(),
    db.collection('withdrawals').get()
  ]);

  document.getElementById('user-count').innerText = usersSnap.size;
  document.getElementById('task-count').innerText = tasksSnap.size;
  document.getElementById('withdrawal-count').innerText = withdrawalSnap.size;
}










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

  function tryAutoInit() {
    if (!document.getElementById('users')) return;
    startUsersModule().catch(e => console.warn('startUsersModule failed', e));
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    tryAutoInit();
  } else {
    window.addEventListener('DOMContentLoaded', tryAutoInit);
  }

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

/* ------------------ initial load ------------------ */
document.addEventListener("DOMContentLoaded", () => {
  // initialize UI states
  setCollection(currentCollection, document.querySelector(".tab-btn"));
  setStatusFilter(statusFilter, document.querySelector(".filter-btn"));
  loadTasks(true);
});



 








// ===== Airtime/Data Admin Review =====

        
let currentBillType = "airtime";   // airtime | data
let currentBillStatus = "pending"; // pending | successful | failed
let billsUnsub = null; // listener cleanup

// Switch between Airtime / Data
function switchBillType(type) {
  currentBillType = type;
  updateBillTabs();
  loadBillsAdmin();
}

// Switch Pending / Successful / Failed
function switchBillStatus(status) {
  currentBillStatus = status;
  updateBillSubtabs();
  loadBillsAdmin();
}

// Update tab styles
function updateBillTabs() {
  document.getElementById("tab-airtime").className =
    currentBillType === "airtime"
      ? "px-4 py-2 font-medium text-blue-600 border-b-2 border-blue-600"
      : "px-4 py-2 font-medium text-gray-500 hover:text-blue-600";
  document.getElementById("tab-data").className =
    currentBillType === "data"
      ? "px-4 py-2 font-medium text-blue-600 border-b-2 border-blue-600"
      : "px-4 py-2 font-medium text-gray-500 hover:text-blue-600";
}

function updateBillSubtabs() {
  ["pending","successful","failed"].forEach(s => {
    document.getElementById(`subtab-${s}`).className =
      currentBillStatus === s
        ? "px-5 py-2 text-sm font-medium rounded-full bg-blue-600 text-white shadow-md transition"
        : "px-5 py-2 text-sm font-medium rounded-full text-gray-600 hover:text-blue-600";
  });
}

// Load Airtime/Data Requests (Realtime)
function loadBillsAdmin() {
  const container = document.getElementById("billsContainer");
  container.innerHTML = `<div class="text-center py-12 text-gray-500 animate-pulse">Loading...</div>`;

  if (billsUnsub) billsUnsub(); // cleanup old listener

  billsUnsub = db.collection("bill_submissions")
    .orderBy("createdAt", "desc")
    .limit(50)
    .onSnapshot((snap) => {
      container.innerHTML = "";

      if (snap.empty) {
        container.innerHTML = `<div class="text-center py-16 text-gray-400">📭 No ${currentBillType} ${currentBillStatus} requests</div>`;
        return;
      }

      // Use Promise.all to handle async transaction lookups safely
      Promise.all(
        snap.docs.map(async (doc) => {
          const data = doc.data();
          const isData = data.type === "data";
          const type = isData ? "data" : "airtime";

          // Filter by type
          if (type !== currentBillType) return null;

          // 🔹 Fetch matching transaction
          let transStatus = "processing";
          try {
            const transSnap = await db.collection("Transaction")
              .where("userId", "==", data.userId)
              .where("amount", "==", data.amount)
              .orderBy("timestamp", "desc")
              .limit(1)
              .get();
            if (!transSnap.empty) {
              transStatus = transSnap.docs[0].data().status || "processing";
            }
          } catch (e) {
            console.error("Transaction fetch error:", e);
          }

          // 🔹 Filter by status
          if (currentBillStatus === "pending" && data.processed) return null;
          if (currentBillStatus === "successful" && (!data.processed || transStatus !== "successful")) return null;
          if (currentBillStatus === "failed" && (!data.processed || transStatus !== "failed")) return null;

          // 🔹 Status badge
          const statusBadge =
            currentBillStatus === "successful"
              ? `<span class="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Successful</span>`
              : currentBillStatus === "failed"
                ? `<span class="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">Failed</span>`
                : `<span class="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">Pending</span>`;

          // 🔹 Card
          const card = document.createElement("div");
          card.className = "rounded-2xl bg-white shadow-md hover:shadow-lg transition p-5 flex flex-col justify-between";
          card.id = `bill-${doc.id}`; // ✅ assign ID for UI updates

          card.innerHTML = `
            <div>
              <div class="flex items-center justify-between mb-3">
                <span class="text-sm font-semibold uppercase tracking-wide text-gray-500">${type.toUpperCase()}</span>
                ${statusBadge}
              </div>
              <h3 class="text-lg font-bold text-gray-800 mb-2">₦${Number(data.amount).toLocaleString()}</h3>
              <div class="space-y-1 text-sm text-gray-600">
                <p><b>📱 Phone:</b> ${data.phone || "N/A"}</p>
                <p><b>🌐 Network:</b> ${data.network || data.networkLabel || "N/A"}</p>
                ${data.planLabel ? `<p><b>📦 Plan:</b> ${data.planLabel}</p>` : ""}
                <p><b>👤 User ID:</b> <span class="font-mono">${data.userId}</span></p>
                <p><b>🕒 Date:</b> ${data.createdAt?.toDate().toLocaleString() || "N/A"}</p>
              </div>
            </div>

            ${!data.processed && currentBillStatus === "pending" ? `
              <div class="flex gap-3 mt-4 action-buttons">
                <button onclick="reviewBill('${doc.id}', '${data.userId}', ${data.amount}, true, this)"
                        class="flex-1 px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition">
                  ✅ Approve
                </button>
                <button onclick="reviewBill('${doc.id}', '${data.userId}', ${data.amount}, false, this)"
                        class="flex-1 px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition">
                  ❌ Reject
                </button>
              </div>
            ` : ""}
          `;
          return card;
        })
      ).then((cards) => {
        cards.filter(Boolean).forEach((c) => container.appendChild(c));
        if (!container.hasChildNodes()) {
          container.innerHTML = `<div class="text-center py-16 text-gray-400">📭 No ${currentBillType} ${currentBillStatus} requests</div>`;
        }
      });
    });
}

// Approve / Reject
// Approve / Reject
async function reviewBill(billId, userId, amount, approve, btnEl) {
  try {
    btnEl.disabled = true;
    btnEl.innerText = approve ? "Approving..." : "Rejecting...";

    const billRef = db.collection("bill_submissions").doc(billId);
    const userRef = db.collection("users").doc(userId);

    // ✅ mark as processed
    await billRef.update({ processed: true });

    // ✅ update matching Transaction
    const transRef = db.collection("Transaction")
      .where("userId", "==", userId)
      .where("amount", "==", amount)
      .where("status", "==", "processing")
      .limit(1);

    const transSnap = await transRef.get();
    if (!transSnap.empty) {
      await transSnap.docs[0].ref.update({
        status: approve ? "successful" : "failed"
      });
    }

    // ✅ refund if rejected
    if (!approve) {
      await userRef.update({
        balance: firebase.firestore.FieldValue.increment(amount)
      });
    }

    // ✅ Instantly move card to correct subtab
    const card = document.getElementById(`bill-${billId}`);
    if (card) {
      // Remove from current view (Pending)
      card.remove();
    }

    // Auto switch subtab
    if (approve) {
      switchBillStatus("successful");
    } else {
      switchBillStatus("failed");
    }

    alert(approve ? "✅ Approved Successfully!" : "❌ Rejected & Refunded!");
  } catch (err) {
    console.error("Error reviewing bill:", err);
    alert("⚠️ Failed to process action.");
    btnEl.disabled = false;
    btnEl.innerText = approve ? "✅ Approve" : "❌ Reject";
  }
}














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
  if (document.readyState === 'complete' || document.readyState === 'interactive') tryAutoInit();
  else window.addEventListener('DOMContentLoaded', tryAutoInit);

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
  if (document.readyState === 'complete' || document.readyState === 'interactive') tryAutoInit();
  else window.addEventListener('DOMContentLoaded', tryAutoInit);

  // expose
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

  // auto-start (safe: will wait for firebase auth availability)
  try {
    // If admin UI is visible in your SPA call startAdminCheckin() when switching to admin tab.
    // We also guard for firebase ready; try auto-init after small delay if firebase exists.
    const tryAuto = async () => {
      if (typeof db !== 'undefined' && typeof firebase !== 'undefined') {
        // don't auto-run if the admin screen is not present
        if (document.getElementById('admin-checkin-screen')) {
          await startAdminCheckin();
        }
      } else {
        setTimeout(tryAuto, 600);
      }
    };
    tryAuto();
  } catch (e) { console.warn('Admin checkin module init error', e); }

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

  // Realtime listener
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

  // Real-time listener for all Withdraw-type transactions
  db.collection("Transaction")
    .where("type", "==", "Withdraw")
    .orderBy("timestamp", "desc")
    .onSnapshot((snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      render(list);
      updateCounts(list);
    });

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
  document.addEventListener("DOMContentLoaded", fetchAllJobs);






// email notifications 

  let currentBatch = null;

  async function queueEmail() {
    const title = document.getElementById("notifTitle").value.trim();
    const message = document.getElementById("notifMessage").value.trim();
    if (!title || !message) return alert("⚠️ Please enter both title and message");

    try {
      // Try to queue (or detect existing batch for same message)
      const res = await fetch("/queue-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, message }),
      });
      const data = await res.json();
      if (!data.success) return alert("❌ Error queueing: " + (data.error || "unknown"));

      if (data.message === "existing-batch") {
        // there's an existing unfinished batch with the same message
        currentBatch = data.batch;
        if (!confirm(`A batch with this same message is already queued (sent ${currentBatch.sent}/${currentBatch.total}). Press OK to continue sending next 100, or Cancel to abort.`)) {
          currentBatch = null;
          return;
        }
        // Continue to send next set immediately
        await sendNextChunk(currentBatch.id);
        return;
      }

      // queued new batch
      currentBatch = data.batch;
      alert(`✅ Batch queued for ${currentBatch.total} recipients. Press "Send Email (Next 100)" to send the first chunk.`);
      // Optionally auto-send first chunk if you want — currently we wait for explicit send.
    } catch (err) {
      console.error(err);
      alert("❌ Error queueing email.");
    }
  }

  async function sendNextChunk(batchId) {
    try {
      if (!batchId && currentBatch) batchId = currentBatch.id;
      if (!batchId) return alert("No batch selected. Click 'Queue Email' first.");

      const res = await fetch("/send-next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId }),
      });

      const data = await res.json();
      if (!data.success) return alert("❌ Send error: " + (data.error || "unknown"));

      // Update currentBatch state by fetching new batch info (optional)
      const batchResp = await fetch(`/batch/${batchId}`);
      const batchData = await batchResp.json();
      if (batchData.success) currentBatch = batchData.batch;

      alert(`✅ Sent ${data.sentThisBatch} emails. Total sent: ${data.sent}/${data.total}. ${data.done ? "All done." : "Press Send again to send the next 100."}`);
      if (data.done) currentBatch = null;
    } catch (err) {
      console.error(err);
      alert("❌ Error sending chunk.");
    }
  }

  // Wire up to buttons (you already have two buttons; adjust IDs or inline onclicks)
  // Replace your "Send Email Only" click handler to call queueEmail() instead of old sendEmailNotification()
  // Example if you want separate "Queue" and "Send Next" buttons:
  // Add two buttons to admin UI:
  // <button id="queueBtn" onclick="queueEmail()">Queue Email</button>
  // <button id="sendNextBtn" onclick="sendNextChunk()">Send Email (Next 100)</button>

  // If you want same "Send Email Only" button to queue+send first chunk automatically, do:
  async function sendEmailOnlyFlow() {
    // queue (or detect existing), then ask confirm and send next chunk
    await queueEmail();
    if (currentBatch) {
      const ok = confirm("Send the next 100 recipients now?");
      if (ok) await sendNextChunk(currentBatch.id);
    }
  }

  // Remove the old localStorage template logic:
  // If you previously had saveEmailTemplate(), resetEmailTemplate(), and DOM on DOMContentLoaded setting emailTemplateEditor,
  // remove those functions and the emailTemplateEditor textarea from the DOM. You said you'll change messages in server-side EmailJS.






// --- Load Everything on Page Load ---
window.addEventListener('DOMContentLoaded', () => {
  fetchStats();
  startUsersModule();
  fetchPendingJobsForAdmin();
  
  loadTaskSubmissions();

  // 📲 Default Airtime → Pending live listener
  switchBillType("airtime");
  switchBillStatus("pending");
});

// ✅ Expose functions globally
window.loadBillsAdmin   = loadBillsAdmin;
window.reviewBill       = reviewBill;
window.switchBillType   = switchBillType;
window.switchBillStatus = switchBillStatus;














































