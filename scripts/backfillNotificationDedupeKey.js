require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../src/config/db");
const Notification = require("../src/models/Notification");
const { buildNotificationDedupeKey } = require("../src/helpers/notificationDedupe");

const run = async () => {
  await connectDB();

  const notifications = await Notification.find({
    $or: [
      { dedupeKey: { $exists: false } },
      { dedupeKey: null },
      { dedupeKey: "" },
    ],
  }).select("_id type activeSearch publication exchange");

  if (notifications.length === 0) {
    console.log("No notifications require backfill.");
    await mongoose.disconnect();
    return;
  }

  const ops = notifications
    .map((notification) => {
      const dedupeKey = buildNotificationDedupeKey(notification);
      if (!dedupeKey) return null;

      return {
        updateOne: {
          filter: { _id: notification._id },
          update: { $set: { dedupeKey } },
        },
      };
    })
    .filter(Boolean);

  if (ops.length === 0) {
    console.log("Notifications found, but none could derive a dedupe key.");
    await mongoose.disconnect();
    return;
  }

  const result = await Notification.bulkWrite(ops, { ordered: false });
  console.log(`Backfilled notifications: ${result.modifiedCount}`);
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("Failed to backfill notifications:", error.message);
  await mongoose.disconnect();
  process.exit(1);
});
