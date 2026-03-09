import webpush from "web-push";
import PushSubscription from "../models/PushSubscription";
import dotenv from "dotenv";

dotenv.config();

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);
console.log("email here -> ", process.env.VAPID_EMAIL);

export class PushService {
  static async sendPush(userId: string, payload: any) {
    try {
      const subscriptions = await PushSubscription.find({ userId });

      for (const sub of subscriptions) {
        // Validate subscription keys
        if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
          console.warn("Invalid push subscription skipped:", sub._id);
          continue;
        }

        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keys.p256dh,
            auth: sub.keys.auth,
          },
        };

        try {
          await webpush.sendNotification(
            pushSubscription,
            JSON.stringify(payload),
          );
        } catch (error) {
          console.error("Push send error:", error);
        }
      }
    } catch (error) {
      console.error("Push service failed:", error);
    }
  }
}
