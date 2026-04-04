import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import webpush from "web-push";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// VAPID configuration
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidEmail = process.env.VAPID_EMAIL || "mailto:example@example.com";

if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
    console.log("VAPID details set successfully");
  } catch (error) {
    console.error("Failed to set VAPID details:", error);
  }
} else {
  console.warn("VAPID keys missing from environment variables");
}

app.use(express.json());

// API routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/notify", async (req, res) => {
  const { subscriptions, title, body, url } = req.body;

  if (!subscriptions || !Array.isArray(subscriptions)) {
    return res.status(400).json({ error: "Invalid subscriptions" });
  }

  const notifications = subscriptions.map((sub) =>
    webpush.sendNotification(sub, JSON.stringify({ title, body, url }))
      .catch((err) => {
        console.error("Push error:", err);
        return null;
      })
  );

  await Promise.all(notifications);
  res.json({ success: true });
});

// In-memory reminder store (for prototype purposes)
interface ScheduledReminder {
  id: string;
  subscriptions: any[];
  title: string;
  body: string;
  time: number;
}
let scheduledReminders: ScheduledReminder[] = [];

app.post("/api/schedule-reminder", (req, res) => {
  const { id, subscriptions, title, body, time } = req.body;
  
  if (!subscriptions || !time) {
    return res.status(400).json({ error: "Missing data" });
  }

  // Remove existing if any
  scheduledReminders = scheduledReminders.filter(r => r.id !== id);
  
  scheduledReminders.push({ id, subscriptions, title, body, time });
  res.json({ success: true });
});

// Check reminders every minute
setInterval(async () => {
  const now = Date.now();
  const toNotify = scheduledReminders.filter(r => r.time <= now);
  scheduledReminders = scheduledReminders.filter(r => r.time > now);

  for (const reminder of toNotify) {
    const notifications = reminder.subscriptions.map((sub) =>
      webpush.sendNotification(sub, JSON.stringify({ 
        title: `⏰ Reminder: ${reminder.title}`, 
        body: reminder.body,
        url: '/' 
      })).catch(() => null)
    );
    await Promise.all(notifications);
  }
}, 60000);

// Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
