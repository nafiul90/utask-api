import mongoose from "mongoose";

const PushSubscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  endpoint: String,
  keys: {
    p256dh: String,
    auth: String,
  },
});

export default mongoose.model("PushSubscription", PushSubscriptionSchema);
