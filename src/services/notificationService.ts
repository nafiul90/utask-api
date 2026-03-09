import Notification from "../models/Notification";
import { User } from "../models/User";
import { PushService } from "./PushService";

export interface NotificationData {
  userId: string;
  title: string;
  message: string;
  type: "task_assigned" | "comment_added" | "status_changed" | "general";
  relatedTaskId?: string;
  relatedCommentId?: string;
}

export class NotificationService {
  /**
   * Create notification + send push
   */
  static async createNotification(data: NotificationData) {
    try {
      const notification = await Notification.create({
        userId: data.userId,
        title: data.title,
        message: data.message,
        type: data.type,
        relatedTaskId: data.relatedTaskId,
        relatedCommentId: data.relatedCommentId,
        read: false,
      });

      // Send push notification
      await PushService.sendPush(data.userId, {
        title: data.title,
        message: data.message,
        type: data.type,
        taskId: data.relatedTaskId,
      });

      return notification;
    } catch (error) {
      console.error("Failed to create notification:", error);
      throw error;
    }
  }

  /**
   * Notify admins and managers
   */
  static async createNotificationsForAdminsAndManagers(
    title: string,
    message: string,
    type: NotificationData["type"],
    relatedTaskId?: string,
  ) {
    try {
      const adminsAndManagers = await User.find({
        role: { $in: ["admin", "manager"] },
      });
      console.log("admin and managers", adminsAndManagers);

      const notifications = [];

      for (const user of adminsAndManagers) {
        const notification = await this.createNotification({
          userId: user._id.toString(),
          title,
          message,
          type,
          relatedTaskId,
        });

        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error(
        "Failed to create notifications for admins/managers:",
        error,
      );
      throw error;
    }
  }

  /**
   * Task Assigned
   */
  static async notifyTaskAssignee(
    assigneeId: string,
    taskId: string,
    title: string,
    message: string,
  ) {
    return this.createNotification({
      userId: assigneeId,
      title,
      message,
      type: "task_assigned",
      relatedTaskId: taskId,
    });
  }

  /**
   * Comment on task
   */
  static async notifyCommentToAssignee(
    assigneeId: string,
    taskId: string,
    taskTitle: string,
    message: string,
  ) {
    return this.createNotification({
      userId: assigneeId,
      title: "New Comment on Your Task",
      message,
      type: "comment_added",
      relatedTaskId: taskId,
    });
  }

  /**
   * Status change
   */
  static async notifyStatusChangeToAdmins(
    taskId: string,
    taskTitle: string,
    message: string,
  ) {
    return this.createNotificationsForAdminsAndManagers(
      "Task Status Changed",
      message,
      "status_changed",
      taskId,
    );
  }

  /**
   * New comment
   */
  static async notifyNewCommentToAdmins(
    taskId: string,
    taskTitle: string,
    message: string,
  ) {
    return this.createNotificationsForAdminsAndManagers(
      "New Comment Added",
      message,
      "comment_added",
      taskId,
    );
  }

  /**
   * New task
   */
  static async notifyNewTaskToAdmins(
    taskId: string,
    taskTitle: string,
    message: string,
  ) {
    return this.createNotificationsForAdminsAndManagers(
      "New Task Created",
      message,
      "task_assigned",
      taskId,
    );
  }
}
