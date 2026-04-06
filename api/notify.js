import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:aktiarlws@gmail.com',
  process.env.VITE_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { subscriptions, fcmTokens, title, body, url } = req.body;
  const results = [];

  // ── Web Push (browser) ──
  if (subscriptions?.length) {
    const webResults = await Promise.allSettled(
      subscriptions.map(sub =>
        webpush.sendNotification(sub, JSON.stringify({ title, body, url }))
      )
    );
    results.push(...webResults);
  }

  // ── FCM (Android APK) ──
  if (fcmTokens?.length) {
    try {
      const fcmRes = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `key=${process.env.FCM_SERVER_KEY}`
        },
        body: JSON.stringify({
          registration_ids: fcmTokens,
          notification: { title, body, sound: 'default' },
          data: { url }
        })
      });
      const fcmData = await fcmRes.json();
      results.push({ fcm: fcmData });
    } catch (err) {
      console.error('FCM send failed', err);
      results.push({ fcm_error: err.message });
    }
  }

  res.json({ success: true, results });
}