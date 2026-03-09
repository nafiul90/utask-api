import { Request, Response } from "express";
import { AuthRequest } from "../middleware/authMiddleware";
import Notification from "../models/Notification";
import { Types } from "mongoose";

/**
 * Get notifications for the current user
 */
export const getUserNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { limit = 20, skip = 0, unreadOnly = false } = req.query;

    const query: any = { userId };
    if (unreadOnly === "true") {
      query.read = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(Number(skip))
      .limit(Number(limit))
      .populate("relatedTaskId", "title status")
      .populate("relatedCommentId");

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({
      userId,
      read: false,
    });

    res.json({
      notifications,
      total,
      unreadCount,
      hasMore: Number(skip) + Number(limit) < total,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
};

/**
 * Mark notification as read
 */
export const markNotificationAsRead = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      userId: req.user!.id,
    });

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    notification.read = true;
    await notification.save();

    res.json(notification);
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ message: "Failed to mark notification as read" });
  }
};

/**
 * Mark all notifications as read for the current user
 */
export const markAllNotificationsAsRead = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const result = await Notification.updateMany(
      { userId: req.user!.id, read: false },
      { $set: { read: true } },
    );

    res.json({
      message: "All notifications marked as read",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res
      .status(500)
      .json({ message: "Failed to mark all notifications as read" });
  }
};

/**
 * Delete a notification
 */
export const deleteNotification = async (req: AuthRequest, res: Response) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.user!.id,
    });

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.json({ message: "Notification deleted successfully" });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({ message: "Failed to delete notification" });
  }
};

/**
 * Register/update FCM token for the current user
 */
export const getNotificationStats = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const total = await Notification.countDocuments({ userId });
    const unread = await Notification.countDocuments({ userId, read: false });

    // Get notification counts by type
    const typeCounts = await Notification.aggregate([
      { $match: { userId: new Types.ObjectId(userId) } },
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]);

    // Get recent notification types
    const recentNotifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("type createdAt read");

    res.json({
      total,
      unread,
      typeCounts,
      recentNotifications,
    });
  } catch (error) {
    console.error("Error fetching notification stats:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch notification statistics" });
  }
};

import PushSubscription from "../models/PushSubscription";

export const saveSubscription = async (req: AuthRequest, res: Response) => {
  try {
    const { subscription } = req.body;

    // await PushSubscription.create({
    //   userId: req.user!.id,
    //   endpoint: subscription.endpoint,
    //   keys: subscription.keys,
    // });
    await PushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      {
        userId: req.user!.id,
        keys: subscription.keys,
      },
      { upsert: true },
    );

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to save subscription" });
  }
};
