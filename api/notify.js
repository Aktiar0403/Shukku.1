import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:aktiarlws@gmail.com',
  process.env.VITE_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { subscriptions, title, body, url } = req.body;
  if (!subscriptions?.length) return res.status(400).json({ error: 'No subscriptions' });

  await Promise.allSettled(
    subscriptions.map(sub =>
      webpush.sendNotification(sub, JSON.stringify({ title, body, url }))
    )
  );
  res.json({ success: true });
}