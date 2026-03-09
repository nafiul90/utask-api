import webpush from "web-push";
import PushSubscription from "../models/PushSubscription";
import dotenv from "dotenv";

dotenv.config();

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

export class PushService {
  static async sendPush(userId: string, payload: any) {
    try {
      const subscriptions = await PushSubscription.find({ userId });
      console.log("subscription: ", subscriptions);
      console.log("payload: ", payload);

      if (subscriptions.length == 0) {
        return;
      }
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
          const result = await webpush.sendNotification(
            pushSubscription,
            JSON.stringify(payload),
          );
          console.log("n send result: ", result);
        } catch (error) {
          console.error("Push send error:", error);
        }
      }
    } catch (error) {
      console.error("Push service failed:", error);
    }
  }
}
