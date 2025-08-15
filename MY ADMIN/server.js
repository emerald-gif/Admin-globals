import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";
import admin from "firebase-admin";
import path from "path";

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

// Serve static files from 'public' folder
app.use(express.static(path.join(process.cwd(), "public")));

// --- FIREBASE ADMIN INITIALIZATION ---
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_ADMIN_KEY)),
});

// --- SEND EMAIL TO ALL USERS ---
app.post("/send-email", async (req, res) => {
  const { title, message } = req.body;

  if (!title || !message) {
    return res.status(400).json({ success: false, error: "Title and message required" });
  }

  try {
    // 1️⃣ Get all Firebase user emails
    const listUsersResult = await admin.auth().listUsers();
    const emails = listUsersResult.users
      .map(user => user.email)
      .filter(email => !!email);

    console.log(`📧 Sending email to ${emails.length} users`);

    // 2️⃣ EmailJS credentials
    const serviceID = process.env.EMAILJS_SERVICE_ID;
    const templateID = process.env.EMAILJS_TEMPLATE_ID;
    const publicKey = process.env.EMAILJS_PUBLIC_KEY;

    // 3️⃣ Loop through each email
    for (const email of emails) {
      const templateParams = { title, message, to_email: email };

      await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: serviceID,
          template_id: templateID,
          user_id: publicKey,
          template_params: templateParams,
        }),
      });
    }

    res.json({ success: true, message: `Emails sent to ${emails.length} users` });
  } catch (error) {
    console.error("❌ Email send error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));