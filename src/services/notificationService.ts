import Notification from "../models/Notification";
import { User } from "../models/User";
import { PushService } from "./PushService";

export interface NotificationData {
  userId: string;
  title: string;
  message: string;
  type:
    | "task_assigned"
    | "comment_added"
    | "status_changed"
    | "general"
    | "comment_updated"
    | "repply_added"
    | "repply_updated";
  relatedTaskId?: string;
  relatedCommentId?: string;
  commentId?: any;
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
        commentId: data.commentId,
      });

      // Send push notification
      await PushService.sendPush(data.userId, {
        title: data.title,
        message: data.message,
        type: data.type,
        taskId: data.relatedTaskId,
        commentId: data.commentId,
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
    commentId?: any,
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
          commentId,
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
    commentId: any,
    message: string,
  ) {
    return this.createNotification({
      userId: assigneeId,
      title: "New Comment on Your Task",
      message,
      type: "comment_added",
      relatedTaskId: taskId,
      commentId,
    });
  }

  static async notifyCommentUpdateToAssignee(
    assigneeId: string,
    taskId: string,
    commentId: any,
    message: string,
  ) {
    return this.createNotification({
      userId: assigneeId,
      title: "A Comment updated on Your Task",
      message,
      type: "comment_updated",
      relatedTaskId: taskId,
      commentId,
    });
  }

  static async notifyRepplyToAssignee(
    assigneeId: string,
    taskId: string,
    commentId: any,
    message: string,
  ) {
    return this.createNotification({
      userId: assigneeId,
      title: "Someone repplied to a comment",
      message,
      type: "repply_added",
      relatedTaskId: taskId,
      commentId,
    });
  }

  static async notifyRepplyUpdateToAssignee(
    assigneeId: string,
    taskId: string,
    commentId: any,
    message: string,
  ) {
    return this.createNotification({
      userId: assigneeId,
      title: "Repply updated",
      message,
      type: "repply_updated",
      relatedTaskId: taskId,
      commentId,
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
    commentId: any,
    message: string,
  ) {
    return this.createNotificationsForAdminsAndManagers(
      "New Comment Added",
      message,
      "comment_added",
      taskId,
      commentId,
    );
  }
  static async notifyCommentUpdateToAdmins(
    taskId: string,
    commentId: any,
    message: string,
  ) {
    return this.createNotificationsForAdminsAndManagers(
      "Comment Updated",
      message,
      "comment_updated",
      taskId,
      commentId,
    );
  }
  static async notifyNewRepplyToAdmins(
    taskId: string,
    commentId: any,
    message: string,
  ) {
    return this.createNotificationsForAdminsAndManagers(
      "Repply Added",
      message,
      "repply_added",
      taskId,
      commentId,
    );
  }
  static async notifyNewRepplyUpdateToAdmins(
    taskId: string,
    commentId: any,
    message: string,
  ) {
    return this.createNotificationsForAdminsAndManagers(
      "Repply Updated",
      message,
      "repply_updated",
      taskId,
      commentId,
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
