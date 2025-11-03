// server.js (or index.js) — IMPORTANT: replace your /send-email logic with this
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";
import admin from "firebase-admin";
import path from "path";
import crypto from "crypto";

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(process.cwd(), "public")));

// init admin SDK (unchanged)
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_ADMIN_KEY)),
});

const BATCH_COLLECTION = "admin_email_batches"; // stores queued batches
const CHUNK_SIZE = 100; // send 100 at a time

function hashMessage(title, message) {
  return crypto.createHash("sha256").update(title + "\n" + message).digest("hex");
}

/**
 * POST /queue-email
 * body: { title, message }
 * - scans users collection for { email, fullname/displayName } and creates a batch doc
 * - if a batch with the same messageHash exists and not finished, returns that batch id and metadata
 * - If all recipients already collected, creates a new batch doc with recipients and index 0
 */
app.post("/queue-email", async (req, res) => {
  try {
    const { title, message } = req.body;
    if (!title || !message) return res.status(400).json({ success: false, error: "title+message required" });

    const messageHash = hashMessage(title, message);

    // Check if an unfinished batch with same hash exists
    const existingQuery = await admin.firestore()
      .collection(BATCH_COLLECTION)
      .where("messageHash", "==", messageHash)
      .where("done", "==", false)
      .limit(1)
      .get();

    if (!existingQuery.empty) {
      const doc = existingQuery.docs[0];
      const batch = { id: doc.id, ...doc.data() };
      return res.json({ success: true, message: "existing-batch", batch });
    }

    // Otherwise create a fresh batch by scanning users collection
    // NOTE: This assumes your users are in Firestore collection 'users' with fields email and fullname (or displayName)
    const usersSnapshot = await admin.firestore().collection("users").get();
    const recipients = [];
    usersSnapshot.forEach(u => {
      const data = u.data();
      const email = data.email || null;
      const fullname = data.fullname || data.name || data.displayName || "";
      if (email) recipients.push({ email, fullname });
    });

    // If you also want to include admin.auth users, you can add admin.auth().listUsers() pass too (omitted to follow your "users collection" request)
    if (recipients.length === 0) {
      return res.status(400).json({ success: false, error: "No recipients found in users collection" });
    }

    const batchDoc = {
      title,
      message,
      messageHash,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      total: recipients.length,
      sent: 0,
      recipients, // full array; we'll slice through it (be mindful if extremely large)
      done: false,
      chunkSize: CHUNK_SIZE,
    };

    const createdRef = await admin.firestore().collection(BATCH_COLLECTION).add(batchDoc);
    const created = await createdRef.get();

    return res.json({ success: true, message: "queued", batch: { id: created.id, ...created.data() } });
  } catch (err) {
    console.error("queue-email error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /send-next
 * body: { batchId }
 * - finds the batch, sends next CHUNK_SIZE recipients, updates batch.sent
 * - marks done when finished
 */
app.post("/send-next", async (req, res) => {
  try {
    const { batchId } = req.body;
    if (!batchId) return res.status(400).json({ success: false, error: "batchId required" });

    const batchRef = admin.firestore().collection(BATCH_COLLECTION).doc(batchId);
    const batchSnap = await batchRef.get();
    if (!batchSnap.exists) return res.status(404).json({ success: false, error: "Batch not found" });

    const batch = batchSnap.data();
    if (batch.done) return res.json({ success: true, message: "already_done", batch });

    const start = batch.sent || 0;
    const end = Math.min(start + CHUNK_SIZE, batch.recipients.length);
    const slice = batch.recipients.slice(start, end);

    // EmailJS config from env
    const serviceID = process.env.EMAILJS_SERVICE_ID;
    const templateID = process.env.EMAILJS_TEMPLATE_ID;
    const publicKey = process.env.EMAILJS_PUBLIC_KEY;

    if (!serviceID || !templateID || !publicKey) {
      return res.status(500).json({ success: false, error: "EmailJS creds not set in env" });
    }

    // Send each email sequentially (keeps it simple); you can parallelize with Promise.all but be mindful of rate limits
    const results = [];
    for (const r of slice) {
      const templateParams = {
        title: batch.title,
        message: batch.message,
        to_email: r.email,
        name: r.fullname || "",
      };

      try {
        const emailRes = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            service_id: serviceID,
            template_id: templateID,
            user_id: publicKey,
            template_params: templateParams,
          }),
        });

        if (!emailRes.ok) {
          const text = await emailRes.text();
          console.error("EmailJS send failed for", r.email, text);
          results.push({ email: r.email, ok: false, info: text });
        } else {
          results.push({ email: r.email, ok: true });
        }
      } catch (err) {
        console.error("send error for", r.email, err);
        results.push({ email: r.email, ok: false, info: err.message });
      }
    }

    // Update the batch doc
    const newSent = end;
    const done = newSent >= batch.recipients.length;
    await batchRef.update({
      sent: newSent,
      lastSentAt: admin.firestore.FieldValue.serverTimestamp(),
      done,
    });

    return res.json({
      success: true,
      message: "chunk_sent",
      sentThisBatch: slice.length,
      total: batch.recipients.length,
      sent: newSent,
      done,
      results,
    });
  } catch (err) {
    console.error("send-next error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Optional: GET /batch/:id to fetch batch status
 */
app.get("/batch/:id", async (req, res) => {
  try {
    const doc = await admin.firestore().collection(BATCH_COLLECTION).doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, error: "Not found" });
    return res.json({ success: true, batch: { id: doc.id, ...doc.data() } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
