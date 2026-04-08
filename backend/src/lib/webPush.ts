import webpush from "web-push";

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY!;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY!;
const vapidEmail = process.env.VAPID_EMAIL || "mailto:admin@dresto.com";

webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);

interface StoredSubscription {
  subscription: webpush.PushSubscription;
  role: string;
}

// In-memory store — good enough for single-process dev; swap for DB in prod
const subscriptions = new Map<string, StoredSubscription>();

export function saveSubscription(
  userId: string,
  role: string,
  subscription: webpush.PushSubscription
) {
  subscriptions.set(userId, { subscription, role });
}

export function removeSubscription(userId: string) {
  subscriptions.delete(userId);
}

export async function sendPushToRoles(
  title: string,
  body: string,
  roles: string[]
) {
  const payload = JSON.stringify({ title, body });
  for (const [userId, { subscription, role }] of subscriptions.entries()) {
    if (roles.includes(role)) {
      try {
        await webpush.sendNotification(subscription, payload);
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          subscriptions.delete(userId);
        }
      }
    }
  }
}

export { vapidPublicKey };
