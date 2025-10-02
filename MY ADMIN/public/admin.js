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






// --- Tab Switching Logic ---
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












// --- Load All Users with Filters + Stats ---

/* Users Admin Module
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
    // Firestore client timestamp
    if (typeof v.toDate === 'function') return v.toDate();
    // possible Admin SDK shape
    if (v._seconds || v.seconds) {
      const secs = v._seconds || v.seconds;
      return new Date(secs * 1000);
    }
    // number (ms or seconds)
    if (typeof v === 'number') {
      // heuristics: if > 1e12 it's ms; if < 1e12 it's secs
      if (v > 1e12) return new Date(v);
      return new Date(v * 1000);
    }
    // string
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
    // small wrapper if you want to toggle logs
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
      const joinedDate = toDateVal(u.createdAt);
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
      const d = toDateVal(u.createdAt);
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

    // update visible count (if you want)
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
      const d = toDateVal(u.createdAt);
      return d && d >= startToday;
    }).length;

    const joinedWeek = users.filter(u => {
      const d = toDateVal(u.createdAt);
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
      const q = db.collection('users').orderBy('createdAt','desc');
      unsubscribe = q.onSnapshot(handleSnapshot, (err) => {
        console.warn('Realtime users snapshot error, falling back to once-off load:', err);
        fallbackLoad();
      });
      emitConsole('attached realtime users listener');
    } catch (err) {
      // some projects may not have createdAt in all docs or security prevents orderBy; fallback
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
    // snap.docs is available for both onSnapshot and get()
    const docs = snap.docs || [];
    allUsersCache = docs.map(d => {
      const data = d.data ? d.data() : d;
      const out = Object.assign({}, data);
      out.id = d.id || data.id || out.uid || out.userId || null;
      return out;
    });
    // if some docs lack .id above we set it to doc.id (done)
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

  // ----- CSV export (optional) -----
  function exportUsersCSV(users) {
    if (!users || users.length === 0) return alert('No users to export');
    const header = ['uid','fullName','username','email','is_Premium','createdAt'];
    const rows = users.map(u => [
      u.id || '',
      (u.fullName || u.displayName || '').replace(/"/g,'""'),
      (u.username || '').replace(/"/g,'""'),
      (u.email || '').replace(/"/g,'""'),
      !!u.is_Premium,
      (toDateVal(u.createdAt) ? toDateVal(u.createdAt).toISOString() : '')
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
      // wait for db to exist (poll)
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
    // attach realtime listener (safe fallback inside)
    attachRealtime();
  }

  function stopUsersModule() {
    stopRealtime();
  }

  // auto-init when DOM ready and db is present
  function tryAutoInit() {
    if (!document.getElementById('users')) return; // no users tab on this page
    startUsersModule().catch(e => console.warn('startUsersModule failed', e));
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    tryAutoInit();
  } else {
    window.addEventListener('DOMContentLoaded', tryAutoInit);
  }

  // expose
  window.startUsersModule = startUsersModule;
  window.stopUsersModule = stopUsersModule;

})();









// Load All Submitted Jobs
async function fetchPendingJobsForAdmin() {
  const pendingContainer = document.getElementById("adminPendingJobs");
  pendingContainer.innerHTML = "<p>Loading pending jobs...</p>";

  try {
    const pendingJobs = [];

    // Fetch pending tasks
    const taskSnap = await db.collection("tasks")
      .where("status", "==", "on review")
      .get();

    taskSnap.forEach(doc => {
      const data = doc.data();
      data.id = doc.id;
      data.type = "task";
      pendingJobs.push(data);
    });

    // Fetch pending affiliate jobs
    const affiliateSnap = await db.collection("affiliateJobs")
      .where("status", "==", "on review")
      .get();

    affiliateSnap.forEach(doc => {
      const data = doc.data();
      data.id = doc.id;
      data.type = "affiliate";
      pendingJobs.push(data);
    });

    // Render jobs
    if (pendingJobs.length === 0) {
      pendingContainer.innerHTML = "<p>No jobs pending review.</p>";
      return;
    }

    pendingContainer.innerHTML = "";
    pendingJobs.forEach(job => {
      const card = `
  <div class="p-4 border shadow rounded-lg bg-white mb-4">
    <h3 class="text-lg font-semibold">${job.title}</h3>
    <p><strong>Type:</strong> ${job.type}</p>
    <p><strong>Posted by:</strong> ${job.postedBy?.name || "Unknown"}</p>
    <p><strong>Total:</strong> ₦${job.total}</p>
    <p><strong>Status:</strong> ${job.status}</p>
    <div class="mt-4 flex gap-2">
      <button onclick="approveJob('${job.id}', '${job.type}')" class="bg-green-600 text-white px-4 py-1 rounded">Approve</button>
      <button onclick="rejectJob('${job.id}', '${job.type}')" class="bg-red-600 text-white px-4 py-1 rounded">Reject</button>
    </div>
  </div>
`;
      pendingContainer.innerHTML += card;
    });

  } catch (error) {
    console.error("🔥 Error loading pending jobs:", error);
    pendingContainer.innerHTML = "<p>Error loading jobs.</p>";
  }
}






function approveJob(jobId, jobType) {
  const collectionName = jobType === "affiliate" ? "affiliateJobs" : "tasks";

  firebase.firestore().collection(collectionName).doc(jobId).update({
    status: 'approved'
  }).then(() => {
    alert('✅ Job approved successfully');
    fetchPendingJobsForAdmin(); // Refresh the UI
  }).catch((error) => {
    console.error('❌ Error approving job:', error);
    alert("Error approving job: " + error.message);
  });
}




async function rejectJob(jobId, jobType) {
  const collectionName = jobType === "affiliate" ? "affiliateJobs" : "tasks";
  try {
    await db.collection(collectionName).doc(jobId).update({
      status: "rejected"
    });
    alert("🚫 Job rejected.");
    fetchPendingJobsForAdmin(); // Refresh the list
  } catch (err) {
    console.error("Error rejecting job:", err);
    alert("❌ Failed to reject job.");
  }
}








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




document.addEventListener("DOMContentLoaded", async () => {
  const db = firebase.firestore();

  // KPI Elements
  const kpiTotalUsers = document.getElementById("kpiTotalUsers");
  const kpiTotalReferrals = document.getElementById("kpiTotalReferrals");
  const kpiPremium = document.getElementById("kpiPremium");
  const kpiCommission = document.getElementById("kpiCommission");

  // Other Elements
  const leaderboardBody = document.getElementById("leaderboardBody");
  const chartNote = document.getElementById("chartNote");

  // ==============================
  // Load all users
  // ==============================
  async function loadUsers() {
    const snap = await db.collection("users").get();
    return snap.docs.map(d => ({
      id: d.id,
      username: d.data().username || "unknown",
      referredBy: d.data().referredBy || null,
      is_Premium: d.data().is_Premium || false,
      joinedAt: d.data().joinedAt || null
    }));
  }

  // ==============================
  // KPIs
  // ==============================
  function loadKPIs(users) {
    const totalUsers = users.length;
    const referrals = users.filter(u => u.referredBy).length;
    const premium = users.filter(u => u.is_Premium).length;

    // Commission only for premium referrals
    const commission = users.filter(u => u.referredBy && u.is_Premium).length * 500;

    kpiTotalUsers.textContent = totalUsers;
    kpiTotalReferrals.textContent = referrals;
    kpiPremium.textContent = premium;
    kpiCommission.textContent = "₦" + commission.toLocaleString();
  }

  // ==============================
  // Leaderboard
  // ==============================
  function buildLeaderboard(users) {
    const refCounts = {};

    users.forEach(u => {
      if (u.referredBy && u.is_Premium) {
        refCounts[u.referredBy] = (refCounts[u.referredBy] || 0) + 1;
      }
    });

    const top = Object.entries(refCounts)
      .map(([uid, count]) => {
        const referrer = users.find(x => x.id === uid);
        return {
          username: referrer?.username || "Unknown",
          count,
          earnings: count * 500
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    leaderboardBody.innerHTML = top.map(t => `
      <tr>
        <td class="py-1 pr-2">@${t.username}</td>
        <td class="py-1 pr-2 text-right">${t.count}</td>
        <td class="py-1 text-right">₦${t.earnings.toLocaleString()}</td>
      </tr>`).join("");
  }

  // ==============================
  // Referral Trend (last 14 days)
  // ==============================
  function buildChart(users) {
    const ctx = document.getElementById("trendChart").getContext("2d");
    const today = new Date();

    const labels = [];
    const counts = [];

    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const label = d.toISOString().slice(5, 10); // "MM-DD"
      labels.push(label);
      counts.push(0);
    }

    users.forEach(u => {
      if (!u.joinedAt) return;
      const joined = u.joinedAt.toDate ? u.joinedAt.toDate() : new Date(u.joinedAt);
      const label = joined.toISOString().slice(5, 10);
      const idx = labels.indexOf(label);
      if (idx !== -1) counts[idx]++;
    });

    new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "New Referrals",
          data: counts,
          fill: true,
          borderColor: "#2563eb",
          backgroundColor: "rgba(37,99,235,0.15)"
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } }
      }
    });

    if (counts.every(c => c === 0)) chartNote.classList.remove("hidden");
  }

  // ==============================
  // User Explorer
  // ==============================
  function setupExplorer(users) {
    const searchBtn = document.getElementById("searchBtn");
    const searchInput = document.getElementById("searchUsername");

    searchBtn.addEventListener("click", () => {
      const username = searchInput.value.trim().toLowerCase();
      if (!username) return;

      const user = users.find(u => u.username.toLowerCase() === username);
      if (!user) return alert("User not found");

      // Direct referrals
      const directs = users.filter(u => u.referredBy === user.id);

      // Second-level referrals
      const seconds = users.filter(u => directs.map(d => d.id).includes(u.referredBy));

      // Earnings from premium directs
      const earnings = directs.filter(u => u.is_Premium).length * 500;

      document.getElementById("uDirectCount").textContent = directs.length;
      document.getElementById("uSecondCount").textContent = seconds.length;
      document.getElementById("uEarnings").textContent = "₦" + earnings.toLocaleString();

      document.getElementById("userRefLink").value = `${window.location.origin}/signup?ref=${user.id}`;
      document.getElementById("userPanel").classList.remove("hidden");

      // Render direct referrals
      const list = document.getElementById("uList");
      list.innerHTML = "";
      directs.forEach(d => {
        const div = document.createElement("div");
        div.className = "p-3 rounded-lg border";
        div.textContent = `@${d.username}${d.is_Premium ? " ⭐" : ""}`;
        list.appendChild(div);
      });
    });

    // Copy link
    document.getElementById("copyLinkBtn").addEventListener("click", () => {
      const input = document.getElementById("userRefLink");
      input.select();
      document.execCommand("copy");
      alert("Link copied!");
    });

    // Share link
    document.getElementById("shareLinkBtn").addEventListener("click", () => {
      const link = document.getElementById("userRefLink").value;
      if (navigator.share) {
        navigator.share({ title: "Join via my referral", url: link });
      } else {
        alert("Sharing not supported. Copy link instead.");
      }
    });
  }

  // ==============================
  // Init
  // ==============================
  const users = await loadUsers();
  loadKPIs(users);
  buildLeaderboard(users);
  buildChart(users);
  setupExplorer(users);

});








// --- Load Withdrawals ---
async function loadWithdrawals() {
  const snap = await db.collection('withdrawals').get();
  const list = document.getElementById('withdrawal-list');
  list.innerHTML = '';

  snap.forEach(doc => {
    const data = doc.data();
    const div = document.createElement('div');
    div.className = "bg-white p-4 rounded-lg shadow-sm border";
    div.innerHTML = `
      <p><strong>User:</strong> ${data.userId || "N/A"}</p>
      <p><strong>Amount:</strong> ₦${data.amount || "0"}</p>
      <p><strong>Status:</strong> 
        <span class="${data.status === 'Approved' ? 'text-green-600' : 'text-red-600'}">
          ${data.status || "Pending"}
        </span>
      </p>
    `;
    list.appendChild(div);
  });
}

  









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






// --- Load Everything on Page Load ---
window.addEventListener('DOMContentLoaded', () => {
  fetchStats();
  startUsersModule();
  fetchPendingJobsForAdmin();
  loadWithdrawals();
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



















