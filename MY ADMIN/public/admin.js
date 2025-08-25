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

// --- Load All Users ---
async function loadUsers() {
  const snap = await db.collection('users').get();
  const list = document.getElementById('user-list');
  list.innerHTML = '';

  snap.forEach(doc => {
    const data = doc.data();
    const div = document.createElement('div');
    div.className = "bg-white p-4 rounded-lg shadow-sm border";
    div.innerHTML = `
      <div class="font-semibold text-blue-600"> Name:${data.fullName || "Unnamed User"}</div>
	  <div class="font-semibold text-green-600"> Username:${data.username || "Unnamed User"}</div>
	  
      <div>Email: ${data.email || "N/A"}</div>
      <div>UID: ${doc.id}</div>
    `;
    list.appendChild(div);
  });
}

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



  // Switch tabs (TikTok / WhatsApp / Telegram)


(function(){
  /* ---------- CONFIG ---------- */
  const COLLECTIONS = { tiktok: 'TiktokInstagram', whatsapp: 'Whatsapp', telegram: 'Telegram' };
  const REWARD_AMOUNTS = { tiktok: 1000, whatsapp: 300, telegram: 300 };

  // Firestore / Auth detection
  let db = window.db || (window.firebase && window.firebase.firestore && window.firebase.firestore());
  let auth = window.auth || (window.firebase && window.firebase.auth && window.firebase.auth());
  const Timestamp = (window.firebase && window.firebase.firestore && window.firebase.firestore.Timestamp) || null;
  const FieldValue = (window.firebase && window.firebase.firestore && window.firebase.firestore.FieldValue) || null;

  // State
  const state = {
    active: 'tiktok',
    view: 'cards',
    list: { tiktok: [], whatsapp: [], telegram: [] },
    selected: new Set(),
    previewIndex: 0,
    previewUrls: [],
    currentDoc: null
  };

  // Elements
  const el = (s) => document.querySelector(s);
  const els = (s) => Array.from(document.querySelectorAll(s));

  const refs = {
    list: el('#st-list'),
    search: el('#st-search'),
    viewCards: el('#st-view-cards'),
    viewTable: el('#st-view-table'),
    tabs: els('.st-tab'),
    kpiPending: el('#st-kpi-pending'),
    kpiAcceptedToday: el('#st-kpi-accepted-today'),
    kpiTotal: el('#st-kpi-total'),
    bulkAccept: el('#st-bulk-accept'),
    bulkReject: el('#st-bulk-reject'),
    drawer: el('#st-drawer'),
    drawerClose: el('#st-drawer-close'),
    drawerUser: el('#st-drawer-user'),
    drawerSub: el('#st-drawer-sub'),
    drawerBadge: el('#st-drawer-badge'),
    drawerImg: el('#st-drawer-img'),
    drawerLinks: el('#st-drawer-links'),
    drawerAccept: el('#st-drawer-accept'),
    drawerReject: el('#st-drawer-reject'),
    drawerRejectConfirm: el('#st-drawer-reject-confirm'),
    drawerRejectCancel: el('#st-drawer-reject-cancel'),
    drawerReasonWrap: el('#st-drawer-reason-wrap'),
    drawerReason: el('#st-drawer-reason'),
    carouselNext: el('#st-carousel-next'),
    carouselPrev: el('#st-carousel-prev'),
    recordsBtn: el('#st-open-records'),
    recordsModal: el('#st-records-modal'),
    recordsClose: el('#st-records-close'),
    recordsContent: el('#st-records-content'),
    recordsExport: el('#st-records-export'),
    toast: el('#st-toast'),
    refreshBtn: el('#st-refresh'),
    filterSelect: el('#st-filter')
  };

  /* ---------- HELPERS ---------- */
  function toast(msg, type='success'){
    refs.toast.textContent = msg;
    refs.toast.className = `fixed bottom-6 right-6 p-3 rounded-lg shadow-lg ${type==='error'?'bg-red-600 text-white':'bg-sky-600 text-white'}`;
    refs.toast.classList.remove('hidden');
    setTimeout(()=> refs.toast.classList.add('hidden'), 3000);
  }

  // safe date conversion
  function tsToStr(ts){
    if (!ts) return 'N/A';
    if (ts.toDate) return ts.toDate().toLocaleString();
    try { return new Date(ts).toLocaleString(); } catch(e){ return String(ts); }
  }

  // Security: sanitize basic output (not intended as full XSS protection)
  function esc(s){ if (!s && s !== 0) return ''; return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

  /* ---------- FIRESTORE OPERATIONS ---------- */

  // subscribe to realtime lists for all collections (server-driven)
  const unsubscribers = {};
  function startRealtime(){
    if (!db) { console.warn('Firestore not detected; call startSocialTasksAdmin() after Firebase init'); return; }

    Object.entries(COLLECTIONS).forEach(([key, colName]) => {
      try {
        unsubscribers[key] = db.collection(colName).orderBy('submittedAt','desc')
          .onSnapshot(snap => {
            const arr = [];
            snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
            state.list[key] = arr;
            updateKPIs(); // refresh counts
            if (key === state.active) renderList();
          }, err => console.error('snap err', err));
      } catch (e) {
        console.error('subscribe error', e);
      }
    });
  }

  // KPI counts
  async function updateKPIs(){
    // Pending across all collections
    try {
      let pendingTotal = 0;
      let totalProcessed = 0;
      let acceptedToday = 0;
      // quick compute from loaded state (cheap, realtime)
      Object.keys(state.list).forEach(k => {
        pendingTotal += state.list[k].filter(it => (it.status||'on review') === 'on review' || (it.status||'') === 'pending').length;
        totalProcessed += state.list[k].filter(it => (it.status||'') === 'accepted' || (it.status||'') === 'rejected').length;
        acceptedToday += state.list[k].filter(it => (it.status||'') === 'accepted' && (() => {
          if (!it.reviewedAt) return false;
          const d = (it.reviewedAt.toDate?it.reviewedAt.toDate():new Date(it.reviewedAt));
          const now = new Date(); const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          return d >= start;
        })()).length;
      });

      refs.kpiPending.textContent = pendingTotal;
      refs.kpiAcceptedToday.textContent = acceptedToday;
      refs.kpiTotal.textContent = totalProcessed;
    } catch(e){ console.warn(e); }
  }

  /* ---------- RENDERING ---------- */

  function renderList(){
    const tab = state.active;
    const raw = state.list[tab] || [];
    const query = refs.search.value.trim().toLowerCase();
    const filter = refs.filterSelect.value;

    // filter & search
    let rows = raw.filter(r => {
      const st = (r.status||'on review');
      if (filter !== 'all' && st !== filter) return false;
      if (!query) return true;
      return (r.username||'').toLowerCase().includes(query)
        || (r.submittedBy||'').toLowerCase().includes(query)
        || (r.profileLink||'').toLowerCase().includes(query)
        || (r.videoLink||'').toLowerCase().includes(query)
        || (r.whatsappNumber||'').toLowerCase().includes(query)
        || (r.groupLinks||[]).join(' ').toLowerCase().includes(query);
    });

    // sort: pending first
    rows.sort((a,b) => {
      const sa = a.status || 'on review', sb = b.status || 'on review';
      if (sa === sb) return (b.submittedAt?.seconds||0) - (a.submittedAt?.seconds||0);
      if (sa === 'on review') return -1;
      if (sb === 'on review') return 1;
      return 0;
    });

    // render cards (or table; here we do cards)
    refs.list.innerHTML = '';
    if (!rows.length) {
      refs.list.innerHTML = `<div class="p-6 rounded-xl bg-white/60 text-center st-card">No submissions match the current filters</div>`;
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'grid gap-6 st-grid-cols';
    // responsive: 1 column mobile, 2 on md, 2 on lg
    grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(320px, 1fr))';

    rows.forEach(doc => {
      const card = document.createElement('article');
      card.className = 'st-card p-5 st-scale st-slide';

      // avatar (if user exists), fallback to initials
      const initials = (doc.username || doc.submittedBy || 'U').slice(0,1).toUpperCase();
      const status = (doc.status || 'on review').toLowerCase();

      const imgs = doc.screenshot ? [doc.screenshot] : (doc.proofs || []);
      const previewThumbs = imgs.map(u => `<img src="${u}" class="w-20 h-20 object-cover rounded-md cursor-pointer" data-url="${u}" />`).join('');

      card.innerHTML = `
        <div class="flex items-start gap-4">
          <div class="w-14 h-14 rounded-xl bg-gradient-to-br from-slate-100 to-white flex items-center justify-center text-lg font-bold">${esc(initials)}</div>
          <div class="flex-1">
            <div class="flex items-center justify-between gap-3">
              <div>
                <h3 class="text-lg font-semibold">${esc(doc.username || doc.submittedBy || 'Unknown')}</h3>
                <div class="text-xs st-small-muted mt-1">${esc((doc.platform||tab).toUpperCase())} • ${tsToStr(doc.submittedAt)}</div>
              </div>
              <div><span class="st-badge ${status==='accepted'?'st-badge-accepted':status==='rejected'?'st-badge-rejected':'st-badge-pending'}">${status.toUpperCase()}</span></div>
            </div>

            <div class="mt-3 text-sm text-slate-700">${doc.profileLink?`<div>Profile: <a target="_blank" class="text-sky-600 underline" href="${esc(doc.profileLink)}">${esc(doc.profileLink)}</a></div>`:''}
              ${doc.videoLink?`<div>Video: <a target="_blank" class="text-sky-600 underline" href="${esc(doc.videoLink)}">${esc(doc.videoLink)}</a></div>`:''}
              ${doc.whatsappNumber?`<div>WhatsApp: ${esc(doc.whatsappNumber)}</div>`:''}
            </div>

            <div class="mt-4 flex gap-3 items-center">
              ${previewThumbs || '<div class="text-slate-400">No screenshots</div>'}
            </div>

            <div class="mt-4 flex items-center gap-3">
              <button class="px-3 py-2 rounded-md st-btn-accept btn-accept" data-id="${doc.id}">Accept</button>
              <button class="px-3 py-2 rounded-md st-btn-reject btn-reject" data-id="${doc.id}">Reject</button>
              <button class="px-3 py-2 rounded-md bg-white/80 text-sm border ml-auto btn-open" data-id="${doc.id}">Open</button>
            </div>
          </div>
        </div>
      `;

      // attach event delegation after insert
      grid.appendChild(card);
    });

    refs.list.appendChild(grid);

    // Hook thumbnails & action buttons
    refs.list.querySelectorAll('[data-url]').forEach(img => {
      img.addEventListener('click', (e) => {
        openDrawerByDocUrl(e.target.dataset.url);
      });
    });

    refs.list.querySelectorAll('.btn-open').forEach(b => {
      b.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const doc = rows.find(r=>r.id===id);
        if (doc) openDrawer(doc);
      });
    });
    refs.list.querySelectorAll('.btn-accept').forEach(b => {
      b.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const doc = rows.find(r=>r.id===id);
        if (!doc) return;
        confirmAccept(doc);
      });
    });
    refs.list.querySelectorAll('.btn-reject').forEach(b => {
      b.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const doc = rows.find(r=>r.id===id);
        if (!doc) return;
        promptReject(doc);
      });
    });
  }

  /* ---------- DETAIL DRAWER ---------- */

  function openDrawer(doc){
    state.currentDoc = doc;
    state.previewIndex = 0;
    state.previewUrls = doc.screenshot ? [doc.screenshot] : (doc.proofs || []);
    refs.drawer.classList.add('open');
    refs.drawerUser.textContent = doc.username || doc.submittedBy || 'Unknown user';
    refs.drawerSub.textContent = `${(doc.platform||state.active).toUpperCase()} • ${tsToStr(doc.submittedAt)}`;
    refs.drawerBadge.className = 'st-badge ' + ((doc.status==='accepted')?'st-badge-accepted':(doc.status==='rejected')?'st-badge-rejected':'st-badge-pending');
    refs.drawerLinks.innerHTML = `
      ${doc.profileLink?`<div>Profile: <a class="text-sky-600 underline" target="_blank" href="${esc(doc.profileLink)}">${esc(doc.profileLink)}</a></div>`:''}
      ${doc.videoLink?`<div>Video: <a class="text-sky-600 underline" target="_blank" href="${esc(doc.videoLink)}">${esc(doc.videoLink)}</a></div>`:''}
      ${doc.whatsappNumber?`<div>WhatsApp: ${esc(doc.whatsappNumber)}</div>`:''}
      ${doc.groupLinks?`<div>Groups: ${esc((doc.groupLinks||[]).join(', '))}</div>`:''}
      <div class="text-xs st-small-muted mt-2">Submitted by: ${esc(doc.submittedBy || doc.userId || 'N/A')}</div>
    `;
    // image
    refs.drawerImg.src = state.previewUrls[state.previewIndex] || '';
    refs.drawerImg.alt = `Proof ${state.previewIndex+1}`;
    refs.drawerReasonWrap.classList.add('hidden');
  }

  function closeDrawer(){
    refs.drawer.classList.remove('open');
    state.currentDoc = null;
  }

  refs.drawerClose.addEventListener('click', closeDrawer);
  refs.carouselNext.addEventListener('click', ()=>{ if (!state.previewUrls.length) return; state.previewIndex = (state.previewIndex+1) % state.previewUrls.length; refs.drawerImg.src = state.previewUrls[state.previewIndex]; });
  refs.carouselPrev.addEventListener('click', ()=>{ if (!state.previewUrls.length) return; state.previewIndex = (state.previewIndex-1 + state.previewUrls.length) % state.previewUrls.length; refs.drawerImg.src = state.previewUrls[state.previewIndex]; });

  refs.drawerReject.addEventListener('click', ()=>{ refs.drawerReasonWrap.classList.remove('hidden'); });
  refs.drawerRejectCancel.addEventListener('click', ()=>{ refs.drawerReasonWrap.classList.add('hidden'); refs.drawerReason.value = ''; });

  refs.drawerRejectConfirm.addEventListener('click', async ()=>{
    const reason = refs.drawerReason.value.trim();
    if (!state.currentDoc) return;
    await rejectSubmission(state.currentDoc, reason);
    closeDrawer();
  });

  refs.drawerAccept.addEventListener('click', async ()=>{
    if (!state.currentDoc) return;
    await acceptAndReward(state.currentDoc);
    closeDrawer();
  });

  /* ---------- ACCEPT / REJECT LOGIC (transaction-safe) ---------- */

  /* ---------- ACCEPT / REJECT LOGIC (transaction-safe) ---------- */

async function acceptAndReward(doc){
  if (!db) { toast('Firestore not initialized','error'); return; }

  // normalize collection key
  const colKey = (doc.platform || state.active).toLowerCase();
  const collectionName = 
    colKey.includes('whatsapp') ? COLLECTIONS.whatsapp :
    colKey.includes('telegram') ? COLLECTIONS.telegram :
    COLLECTIONS.tiktok;
  const amount = 
    colKey.includes('whatsapp') ? REWARD_AMOUNTS.whatsapp :
    colKey.includes('telegram') ? REWARD_AMOUNTS.telegram :
    REWARD_AMOUNTS.tiktok;

  const docRef = db.collection(collectionName).doc(doc.id);

  try {
    await db.runTransaction(async (t) => {
      const ds = await t.get(docRef);
      if (!ds.exists) throw new Error('Submission missing');
      const data = ds.data();

      if (data.status === 'accepted') throw new Error('Already accepted');
      if (data.status === 'rejected') throw new Error('Already rejected');

      const userId = data.submittedBy || data.userId || data.uid;
      if (!userId) throw new Error('No user ID found in submission');

      // mark submission
      t.update(docRef, {
        status: 'accepted',
        rewarded: true,
        reviewedAt: FieldValue.serverTimestamp()
      });

      // increment user balance
      const userRef = db.collection('users').doc(userId);
      t.set(userRef, { balance: FieldValue.increment(amount) }, { merge: true });
    });

    toast(`✅ Accepted & credited ${amount}`, 'success');
  } catch(e){
    console.error(e);
    toast(`❌ ${e.message || 'Failed to accept'}`, 'error');
  }
}

async function rejectSubmission(doc, reason=''){
  if (!db) { toast('Firestore not initialized','error'); return; }

  const colKey = (doc.platform || state.active).toLowerCase();
  const collectionName = 
    colKey.includes('whatsapp') ? COLLECTIONS.whatsapp :
    colKey.includes('telegram') ? COLLECTIONS.telegram :
    COLLECTIONS.tiktok;
  const docRef = db.collection(collectionName).doc(doc.id);

  try {
    await docRef.update({
      status: 'rejected',
      reviewedAt: FieldValue.serverTimestamp(),
      rejectionReason: reason || null
    });
    toast('❌ Rejected submission', 'error');
  } catch(e){
    console.error(e);
    toast('❌ Failed to reject', 'error');
  }
}

  /* ---------- UI ACTIONS ---------- */

  function confirmAccept(doc){
    // simple confirm
    const ok = confirm(`Accept this submission and credit the user ₦${REWARD_AMOUNTS[(doc.platform||state.active).toLowerCase().includes('whatsapp')?'whatsapp':(doc.platform||state.active).toLowerCase().includes('telegram')?'telegram':'tiktok']} ?`);
    if (!ok) return;
    acceptAndReward(doc);
  }

  function promptReject(doc){
    const reason = prompt('Enter rejection reason (optional):');
    if (reason === null) return;
    rejectSubmissionManual(doc, reason);
  }

  /* ---------- RECORDS PANEL ---------- */

  function openRecords(){
    refs.recordsModal.classList.remove('hidden');
    loadRecords();
  }
  function closeRecords(){ refs.recordsModal.classList.add('hidden'); }
  refs.recordsClose.addEventListener('click', closeRecords);
  refs.recordsBtn.addEventListener('click', openRecords);

  async function loadRecords(){
    if (!db) return;
    refs.recordsContent.innerHTML = '<div class="text-slate-500 p-4">Loading records…</div>';
    try {
      // load accepted & rejected across collections (latest 100)
      const rows = [];
      for (const [k, col] of Object.entries(COLLECTIONS)){
        const snap = await db.collection(col).where('status','in',['accepted','rejected']).orderBy('reviewedAt','desc').limit(60).get();
        snap.forEach(d => rows.push({ id: d.id, collection: col, ...d.data() }));
      }
      // sort by reviewedAt
      rows.sort((a,b)=> (b.reviewedAt?.seconds||0) - (a.reviewedAt?.seconds||0));
      if (!rows.length) { refs.recordsContent.innerHTML = '<div class="text-slate-500 p-4">No records yet.</div>'; return; }

      refs.recordsContent.innerHTML = rows.map(r => {
        const sclass = r.status==='accepted' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700';
        const amount = r.rewardAmount ? `+₦${r.rewardAmount}` : '';
        return `<div class="p-3 st-card"><div class="flex justify-between items-center gap-4">
          <div><div class="font-semibold">${esc(r.username||r.submittedBy||'User')}</div><div class="text-xs st-small-muted">${tsToStr(r.reviewedAt)} • ${esc(r.collection)}</div></div>
          <div class="text-right">
            <div class="${sclass} st-badge">${esc(r.status?.toUpperCase()||'')}</div>
            <div class="text-sm mt-2">${amount}${r.reviewReason?`<div class="text-xs text-slate-500 mt-1">Reason: ${esc(r.reviewReason)}</div>`:''}</div>
          </div>
        </div></div>`;
      }).join('');
    } catch (e) {
      console.error('loadRecords error', e);
      refs.recordsContent.innerHTML = '<div class="text-red-500 p-4">Failed to load records</div>';
    }
  }

  // CSV export simple
  refs.recordsExport.addEventListener('click', async ()=>{
    if (!db) return toast('DB not ready','error');
    const rows = [];
    for (const col of Object.values(COLLECTIONS)){
      const snap = await db.collection(col).where('status','in',['accepted','rejected']).orderBy('reviewedAt','desc').limit(200).get();
      snap.forEach(d => rows.push({ id: d.id, collection: col, ...d.data() }));
    }
    if (!rows.length) return toast('No rows to export','error');
    const header = ['id','collection','username','submittedBy','status','rewardAmount','reviewReason','reviewedAt'].join(',');
    const csv = [header].concat(rows.map(r => {
      const vals = [r.id, r.collection, (r.username||''), (r.submittedBy||''), (r.status||''), (r.rewardAmount||''), (r.reviewReason||''), (r.reviewedAt && r.reviewedAt.toDate? r.reviewedAt.toDate().toISOString() : '')];
      return vals.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',');
    })).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `social_records_${new Date().toISOString().slice(0,19)}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    toast('CSV export started');
  });

  /* ---------- UI wiring ---------- */

  // Tabs
  refs.tabs.forEach(btn => btn.addEventListener('click', ()=>{
    refs.tabs.forEach(b=>b.classList.remove('active','text-white')); btn.classList.add('active','text-white');
    const tab = btn.dataset.tab; state.active = tab; renderList();
  }));

  // search debounce
  let sd;
  refs.search.addEventListener('input', (e)=>{ clearTimeout(sd); sd = setTimeout(()=>renderList(), 250); });

  // view toggle
  refs.viewCards.addEventListener('click', ()=>{ state.view='cards'; renderList(); });
  refs.viewTable.addEventListener('click', ()=>{ state.view='table'; renderList(); });

  // refresh
  refs.refreshBtn && refs.refreshBtn.addEventListener('click', ()=>{ renderList(); toast('Refreshed'); });

  // bulk actions (placeholder wiring: selection UI not implemented in this version but buttons are ready)
  refs.bulkAccept.addEventListener('click', ()=>{ if (!confirm('Bulk accept selected?')) return; /* bulk logic can be added */ });
  refs.bulkReject.addEventListener('click', ()=>{ if (!confirm('Bulk reject selected?')) return; /* bulk logic can be added */ });

  /* ---------- START / INIT ---------- */

  function startSocialTasksAdmin(){
    // re-evaluate db/auth if they were set later
    db = window.db || (window.firebase && window.firebase.firestore && window.firebase.firestore());
    auth = window.auth || (window.firebase && window.firebase.auth && window.firebase.auth());
    startRealtime();
    // initial tab
    renderList();
    toast('Social Tasks Admin started');
  }

  // Expose for manual start
  window.startSocialTasksAdmin = startSocialTasksAdmin;

  // Auto-start if Firestore present
  if (db) startSocialTasksAdmin();

})();






  // REFERRAL FUNCTION 



document.addEventListener("DOMContentLoaded", async () => {
  const db = firebase.firestore();

  const kpiTotalUsers = document.getElementById("kpiTotalUsers");
  const kpiTotalReferrals = document.getElementById("kpiTotalReferrals");
  const kpiPremium = document.getElementById("kpiPremium");
  const kpiCommission = document.getElementById("kpiCommission");
  const leaderboardBody = document.getElementById("leaderboardBody");
  const chartNote = document.getElementById("chartNote");

  // ==============================
  //  Load all users from Firestore
  // ==============================
  async function loadUsers() {
    const snap = await db.collection("users").get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  // ==============================
  //  KPIs
  // ==============================
  function loadKPIs(users) {
    const totalUsers = users.length;

    const referrals = users.filter(u => u.referredBy).length;
    const premium = users.filter(u => u.is_Premium).length;

    // Commission = count of premium referrals × 500
    const commission = users.filter(u => u.referredBy && u.is_Premium).length * 500;

    kpiTotalUsers.textContent = totalUsers;
    kpiTotalReferrals.textContent = referrals;
    kpiPremium.textContent = premium;
    kpiCommission.textContent = "₦" + commission.toLocaleString();
  }

  // ==============================
  //  Leaderboard (Top Referrers)
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
      .sort((a,b) => b.count - a.count)
      .slice(0,10);

    leaderboardBody.innerHTML = top.map(t => `
      <tr>
        <td class="py-1 pr-2">@${t.username}</td>
        <td class="py-1 pr-2 text-right">${t.count}</td>
        <td class="py-1 text-right">₦${t.earnings.toLocaleString()}</td>
      </tr>`).join("");
  }

  // ==============================
  //  Referral Trend (last 14 days)
  // ==============================
  function buildChart(users) {
    const ctx = document.getElementById("trendChart").getContext("2d");
    const today = new Date();

    const labels = [];
    const counts = [];

    for (let i=13; i>=0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const label = d.toISOString().slice(5,10); // MM-DD
      labels.push(label);
      counts.push(0);
    }

    users.forEach(u => {
      if (!u.joinedAt) return;
      const joined = u.joinedAt.toDate ? u.joinedAt.toDate() : new Date(u.joinedAt);
      const label = joined.toISOString().slice(5,10);
      const idx = labels.indexOf(label);
      if (idx !== -1) counts[idx]++;
    });

    new Chart(ctx, {
      type: "line",
      data: { 
        labels, 
        datasets: [{
          label:"New Referrals",
          data:counts,
          fill:true,
          borderColor:"#2563eb",
          backgroundColor:"rgba(37,99,235,0.15)"
        }] 
      },
      options: { responsive:true, plugins:{ legend:{ display:false } } }
    });

    if (counts.every(c => c===0)) chartNote.classList.remove("hidden");
  }

  // ==============================
  //  User Explorer
  // ==============================
  function setupExplorer(users) {
    const searchBtn = document.getElementById("searchBtn");
    const searchInput = document.getElementById("searchUsername");

    searchBtn.addEventListener("click", () => {
      const username = searchInput.value.trim();
      if (!username) return;

      const user = users.find(u => u.username === username);
      if (!user) return alert("User not found");

      // Direct referrals
      const directs = users.filter(u => u.referredBy === user.id);

      // Second level referrals
      const seconds = users.filter(u => directs.map(d => d.id).includes(u.referredBy));

      // Earnings = premium directs × 500
      const earnings = directs.filter(u => u.is_Premium).length * 500;

      document.getElementById("uDirectCount").textContent = directs.length;
      document.getElementById("uSecondCount").textContent = seconds.length;
      document.getElementById("uEarnings").textContent = "₦" + earnings.toLocaleString();

      document.getElementById("userRefLink").value = `${window.location.origin}/signup?ref=${user.id}`;
      document.getElementById("userPanel").classList.remove("hidden");

      // Render direct referrals list
      const list = document.getElementById("uList");
      list.innerHTML = "";
      directs.forEach(d => {
        const div = document.createElement("div");
        div.className = "p-3 rounded-lg border";
        div.textContent = `@${d.username}`;
        list.appendChild(div);
      });
    });

    // Copy referral link
    document.getElementById("copyLinkBtn").addEventListener("click", () => {
      const input = document.getElementById("userRefLink");
      input.select();
      document.execCommand("copy");
      alert("Link copied!");
    });

    // Share referral link
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
  //  Init
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
  loadUsers();
  fetchPendingJobsForAdmin();
  loadWithdrawals();
  loadTaskSubmissions();

});




