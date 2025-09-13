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



/*
  Admin Social Tasks UI + Logic
  - Only reads from: TiktokInstagram, Whatsapp, Telegram
  - Uses status values: "on review" (pending), "approved", "rejected"
  - Credits with Firestore transaction and records in Transactions collection
*/

const PLATFORMS = ["TiktokInstagram", "Whatsapp", "Telegram"];
let currentCollection = "TiktokInstagram";
let currentTasks = []; // array of { id, ...data }
let selectedStatusFilter = "on review"; // default show pending
let selectedTask = null;

// init: hook tab clicks and filters
function initSocialAdmin() {
  PLATFORMS.forEach(name => {
    const el = document.getElementById(`tab-${name}`);
    if (el) {
      el.addEventListener("click", () => {
        document.querySelectorAll(".task-tab").forEach(t => t.classList.remove("text-blue-600", "border-blue-600"));
        el.classList.add("text-blue-600", "border-blue-600");
        loadTasks(name);
      });
    }
  });

  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedStatusFilter = btn.dataset.filter;
      // visually highlight
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("ring-2", "ring-blue-300"));
      btn.classList.add("ring-2", "ring-blue-300");
      renderTasks();
    });
  });

  // activate default tab
  document.getElementById("tab-TiktokInstagram")?.click();
}

// load tasks for a collection (only this collection is queried)
async function loadTasks(collectionName) {
  currentCollection = collectionName;
  const container = document.getElementById("tasks-container");
  container.innerHTML = `<p class="text-gray-500">Loading ${collectionName}...</p>`;

  try {
    const snapshot = await firebase.firestore()
      .collection(collectionName)
      .orderBy("submittedAt", "desc")
      .get();

    currentTasks = snapshot.docs.map(d => ({ id: d.id, ...d.data(), _collection: collectionName }));
    renderTasks();
  } catch (err) {
    console.error("Error loading tasks:", err);
    container.innerHTML = `<p class="text-red-500">Failed to load tasks: ${err.message || err}</p>`;
  }
}

// render tasks using currentTasks and selectedStatusFilter
function renderTasks() {
  const container = document.getElementById("tasks-container");
  container.innerHTML = "";

  // use the exact status string in selectedStatusFilter ("on review", "approved", "rejected")
  const list = currentTasks.filter(t => {
    // some older docs might be missing status -> treat as "on review"
    const s = t.status || "on review";
    return s === selectedStatusFilter;
  });

  if (!list.length) {
    container.innerHTML = `<p class="text-gray-500">No ${selectedStatusFilter === "on review" ? "pending" : selectedStatusFilter} tasks.</p>`;
    return;
  }

  list.forEach(task => {
    const card = document.createElement("div");
    card.className = "bg-white rounded-xl shadow p-4 flex flex-col gap-2 border";

    // format submittedAt
    let submittedAt = "";
    if (task.submittedAt && typeof task.submittedAt.toDate === "function") {
      submittedAt = task.submittedAt.toDate().toLocaleString();
    } else if (task.submittedAt) {
      submittedAt = String(task.submittedAt);
    }

    // build images (single screenshot or proofs array)
    let imagesHtml = "";
    if (task.screenshot) {
      imagesHtml += `<img src="${task.screenshot}" class="w-full rounded-lg object-cover max-h-60 cursor-pointer" onclick="openReview('${task.id}')">`;
    }
    if (Array.isArray(task.proofs) && task.proofs.length) {
      imagesHtml += `<div class="flex gap-2 mt-2">${task.proofs.map(p => `<img src="${p}" onclick="openReview('${task.id}')" class="w-20 h-20 rounded-lg object-cover cursor-pointer">`).join("")}</div>`;
    }

    // small fields
    const username = task.username || task.whatsappNumber || "—";
    const userId = task.submittedBy || "—";
    const statusBadge = task.status === "approved" ? `<span class="text-xs px-2 py-1 rounded bg-green-100 text-green-700">approved</span>`
                      : task.status === "rejected" ? `<span class="text-xs px-2 py-1 rounded bg-red-100 text-red-700">rejected</span>`
                      : `<span class="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-700">on review</span>`;

    card.innerHTML = `
      <div class="flex justify-between items-start">
        <div>
          <p class="text-sm text-gray-700"><b>User:</b> ${escapeHtml(username)}</p>
          <p class="text-xs text-gray-500"><b>UserID:</b> ${escapeHtml(userId)}</p>
          <p class="text-xs text-gray-400">${escapeHtml(submittedAt)}</p>
        </div>
        ${statusBadge}
      </div>

      ${imagesHtml}

      <div class="flex gap-2 mt-2">
        <button onclick="openReview('${task.id}')" class="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg">Review</button>
        <button onclick="quickAccept('${task.id}')" class="px-3 py-1 bg-green-600 text-white text-sm rounded-lg">Accept</button>
        <button onclick="quickReject('${task.id}')" class="px-3 py-1 bg-red-500 text-white text-sm rounded-lg">Reject</button>
      </div>
    `;

    container.appendChild(card);
  });
}

// open review modal (populate full data)
function openReview(taskId) {
  selectedTask = currentTasks.find(t => t.id === taskId);
  if (!selectedTask) return;

  const modal = document.getElementById("reviewModal");
  const content = document.getElementById("reviewContent");
  content.innerHTML = buildReviewHtml(selectedTask);
  modal.classList.remove("hidden");
  modal.classList.add("flex");

  document.getElementById("acceptBtn").onclick = () => handleDecision("approved");
  document.getElementById("rejectBtn").onclick = () => handleDecision("rejected");
}

function closeReviewModal() {
  const modal = document.getElementById("reviewModal");
  modal.classList.add("hidden");
  selectedTask = null;
}

// quick accept / quick reject shortcuts (confirm then call handleDecision)
function quickAccept(taskId) {
  selectedTask = currentTasks.find(t => t.id === taskId);
  if (!selectedTask) return;
  if (!confirm("Accept this task and credit the user?")) return;
  handleDecision("approved");
}
function quickReject(taskId) {
  selectedTask = currentTasks.find(t => t.id === taskId);
  if (!selectedTask) return;
  if (!confirm("Reject this task?")) return;
  handleDecision("rejected");
}

// Build review HTML from task object (shows all the known fields)
function buildReviewHtml(task) {
  const submittedAt = task.submittedAt && typeof task.submittedAt.toDate === "function" ? task.submittedAt.toDate().toLocaleString() : (task.submittedAt || "—");
  let html = `
    <p><b>Platform:</b> ${task._collection}</p>
    <p><b>User:</b> ${escapeHtml(task.username || task.whatsappNumber || "—")}</p>
    <p><b>User ID:</b> ${escapeHtml(task.submittedBy || "—")}</p>
    <p><b>Status:</b> ${escapeHtml(task.status || "on review")}</p>
    <p><b>Submitted:</b> ${escapeHtml(submittedAt)}</p>
  `;

  if (task.profileLink) html += `<p><b>Profile Link:</b> <a href="${task.profileLink}" target="_blank" class="text-blue-600">${escapeHtml(task.profileLink)}</a></p>`;
  if (task.videoLink) html += `<p><b>Video Link:</b> <a href="${task.videoLink}" target="_blank" class="text-blue-600">${escapeHtml(task.videoLink)}</a></p>`;
  if (Array.isArray(task.groupLinks) && task.groupLinks.length) html += `<p><b>Group Links:</b><br>${task.groupLinks.map(g => `<a href="${g}" target="_blank" class="text-blue-600">${escapeHtml(g)}</a>`).join("<br>")}</p>`;
  if (task.whatsappNumber) html += `<p><b>WhatsApp Number:</b> ${escapeHtml(task.whatsappNumber)}</p>`;
  if (task.followerRequirement) html += `<p><b>Follower Req:</b> ${escapeHtml(task.followerRequirement)}</p>`;

  if (task.screenshot) html += `<img src="${task.screenshot}" class="w-full rounded-lg mt-2">`;
  if (Array.isArray(task.proofs) && task.proofs.length) {
    html += `<div class="flex gap-2 mt-2">${task.proofs.map(p => `<img src="${p}" class="w-32 h-32 rounded-lg object-cover">`).join("")}</div>`;
  }

  return html;
}

// handle accept/reject with Firestore transaction (prevents double credit)
async function handleDecision(decision) {
  if (!selectedTask) return alert("No task selected.");
  const db = firebase.firestore();
  const taskRef = db.collection(currentCollection).doc(selectedTask.id);
  const userId = selectedTask.submittedBy;
  const adminId = (firebase.auth().currentUser && firebase.auth().currentUser.uid) || "admin";

  const creditAmount = (currentCollection === "TiktokInstagram") ? 2000 : 300;
  const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp();

  try {
    await db.runTransaction(async (t) => {
      const snap = await t.get(taskRef);
      if (!snap.exists) throw new Error("Task not found.");
      const data = snap.data();
      // only allow decision if still on review
      const currentStatus = data.status || "on review";
      if (currentStatus !== "on review") {
        throw new Error(`Task already processed (${currentStatus}).`);
      }

      // update task status
      t.update(taskRef, { status: decision, reviewedAt: serverTimestamp, reviewedBy: adminId });

      // If approved -> create transaction record and add to user's balance
      if (decision === "approved") {
        const transRef = db.collection("Transactions").doc();
        t.set(transRef, {
          userId,
          amount: creditAmount,
          type: "credit",
          taskType: currentCollection,
          taskId: selectedTask.id,
          createdAt: serverTimestamp
        });

        // update or create users/{userId}.balance
        const userRef = db.collection("users").doc(userId);
        const userSnap = await t.get(userRef);
        if (userSnap.exists) {
          t.update(userRef, { balance: firebase.firestore.FieldValue.increment(creditAmount) });
        } else {
          // create user doc with balance (merge sensible default)
          t.set(userRef, { balance: creditAmount }, { merge: true });
        }
      }
    });

    alert(`Task ${decision === "approved" ? "approved and credited ✅" : "rejected ❌"}`);
    closeReviewModal();
    // refresh after update
    await loadTasks(currentCollection);
  } catch (err) {
    console.error("Decision error:", err);
    alert("Failed to update task: " + (err.message || err));
    // still refresh to get latest state
    await loadTasks(currentCollection);
  }
}

// utility: simple HTML escape
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// load init when DOM + firebase ready
document.addEventListener("DOMContentLoaded", () => {
  // if firebase auth is used to identify admin, wait for auth ready
  if (firebase && firebase.auth) {
    firebase.auth().onAuthStateChanged(() => initSocialAdmin());
  } else {
    initSocialAdmin();
  }
});




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







