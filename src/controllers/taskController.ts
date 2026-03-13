import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { NotificationService } from "../services/notificationService";
import {
  Task,
  TaskStatus,
  ITask,
  IComment,
  IReply,
  ILink,
} from "../models/Task";
import { AuthRequest } from "../middleware/authMiddleware";
import mongoose, { Types } from "mongoose";

const managerRoles = ["admin", "manager"];
const allowedTransitions: Record<TaskStatus, TaskStatus[]> = {
  pending: ["processing", "canceled"],
  processing: ["qa", "canceled"],
  qa: ["processing", "completed", "canceled"],
  completed: ["qa", "processing", "canceled"],
  canceled: [],
};

const canManage = (role?: string | null) =>
  !!role && managerRoles.includes(role);

// Test notification trigger added by Ira - 2026-03-05
export const listTasks = async (req: AuthRequest, res: Response) => {
  const requester = req.user!;

  let filter: any = canManage(requester.role) ? {} : { assignee: requester.id };

  const { search, assignee, startDate, endDate } = req.query;

  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  if (assignee && canManage(requester.role)) {
    filter.assignee = assignee;
  }

  if (startDate || endDate) {
    filter.dueDate = {};
    if (startDate) filter.dueDate.$gte = new Date(startDate as string);
    if (endDate) {
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);
      filter.dueDate.$lte = end;
    }
  }

  const tasks = await Task.find(filter)
    .populate("assignee", "fullName email role profilePicture")
    .populate("createdBy", "fullName email role profilePicture")
    .sort({ status: 1, position: 1, createdAt: 1 });

  res.json(tasks);
};

export const getTask = async (req: AuthRequest, res: Response) => {
  const requester = req.user!;
  const task = await Task.findById(req.params.id)
    .populate("assignee", "fullName email role profilePicture")
    .populate("createdBy", "fullName email role profilePicture")
    .populate({
      path: "comments.author",
      select: "fullName email role profilePicture",
    })
    .populate({
      path: "comments.replies.author",
      select: "fullName email role profilePicture",
    });

  if (!task) {
    return res.status(404).json({ message: "Task not found" });
  }

  res.json(task);
};

export const getTaskStats = async (req: AuthRequest, res: Response) => {
  const requester = req.user!;
  const { startDate, endDate } = req.query;

  let commonMatchFilter: any = {};

  if (startDate || endDate) {
    commonMatchFilter.dueDate = {};
    if (startDate)
      commonMatchFilter.dueDate.$gte = new Date(startDate as string);
    if (endDate) {
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);
      commonMatchFilter.dueDate.$lte = end;
    }
  }

  const requesterSpecificMatchFilter: any = canManage(requester.role)
    ? {}
    : { assignee: new Types.ObjectId(requester.id) };

  const globalMatchFilter = {
    ...commonMatchFilter,
    ...requesterSpecificMatchFilter,
  };

  const globalPipeline = [
    { $match: globalMatchFilter },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ];

  const globalResults = await Task.aggregate(globalPipeline);
  const globalStats = globalResults.reduce(
    (acc: Record<string, number>, item: { _id: string; count: number }) => {
      acc[item._id] = item.count;
      return acc;
    },
    { pending: 0, processing: 0, qa: 0, completed: 0, canceled: 0 } as Record<
      string,
      number
    >,
  );
  globalStats.total = (Object.values(globalStats) as number[]).reduce(
    (sum, count) => sum + count,
    0,
  );

  const userPipeline = [
    {
      $match: { ...commonMatchFilter, assignee: { $exists: true, $ne: null } },
    },
    {
      $group: {
        _id: "$assignee",
        pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
        processing: {
          $sum: { $cond: [{ $eq: ["$status", "processing"] }, 1, 0] },
        },
        qa: { $sum: { $cond: [{ $eq: ["$status", "qa"] }, 1, 0] } },
        completed: {
          $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
        },
        canceled: { $sum: { $cond: [{ $eq: ["$status", "canceled"] }, 1, 0] } },
        total: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "assigneeInfo",
      },
    },
    { $unwind: "$assigneeInfo" },
    {
      $project: {
        _id: 0,
        assignee: "$assigneeInfo",
        pending: 1,
        processing: 1,
        qa: 1,
        completed: 1,
        canceled: 1,
        total: 1,
      },
    },
  ];

  if (!canManage(requester.role)) {
    userPipeline[0].$match = {
      ...userPipeline[0].$match,
      assignee: new Types.ObjectId(requester.id),
    };
  }

  const userStats = await Task.aggregate(userPipeline);

  // FIX: Ensure res.json sends the full nested object correctly.
  // This was the source of the frontend rendering problem.
  res.json({ global: globalStats, users: userStats });
};

export const createTask = async (req: AuthRequest, res: Response) => {
  const requester = req.user!;
  if (!canManage(requester.role)) {
    return res.status(403).json({ message: "Only managers can create tasks" });
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const lastTaskInStatus = await Task.findOne({
    status: req.body.status || "pending",
  }).sort({ position: -1 });
  const newPosition = lastTaskInStatus ? lastTaskInStatus.position + 1 : 0;

  const payload = {
    title: req.body.title,
    description: req.body.description,
    status: req.body.status || "pending", // Ensure status is set for initial position calculation
    assignee: req.body.assignee || undefined,
    startDate: req.body.startDate,
    dueDate: req.body.dueDate,
    attachments: req.body.attachments || [],
    links: req.body.links || [], // Add links to payload
    createdBy: requester.id,
    position: newPosition, // Assign initial position
  };

  const task = await Task.create(payload);
  await task.save();

  const title = payload.title;

  if (payload.assignee && payload.assignee !== requester.id) {
    await NotificationService.notifyTaskAssignee(
      payload.assignee,
      task._id.toString(),
      title,
      `You have been assigned a new task: "${title}"`,
    );
  }

  await NotificationService.notifyNewTaskToAdmins(
    task._id.toString(),
    title,
    `A new task "${title}" has been created`,
  );

  const populated = await task.populate([
    { path: "assignee", select: "fullName email role" },
    { path: "createdBy", select: "fullName email role" },
  ]);
  res.status(201).json(populated);
};

export const updateTask = async (req: AuthRequest, res: Response) => {
  const requester = req.user!;
  if (!canManage(requester.role)) {
    return res.status(403).json({ message: "Only managers can edit tasks" });
  }
  const oldTask = await Task.findById(req.params.id);
  if (!oldTask) {
    return res.status(404).json({ message: "Task not found" });
  }

  const updates = {
    title: req.body.title,
    description: req.body.description,
    assignee: req.body.assignee,
    startDate: req.body.startDate,
    dueDate: req.body.dueDate,
    attachments: req.body.attachments,
    links: req.body.links,
  };

  const task = await Task.findByIdAndUpdate(req.params.id, updates, {
    new: true,
  })
    .populate("assignee", "fullName email role")
    .populate("createdBy", "fullName email role");
  if (!task) {
    return res.status(404).json({ message: "Task not found" });
  }
  // Notify assignee change
  if (updates.assignee && updates.assignee !== oldTask.assignee?.toString()) {
    await NotificationService.notifyTaskAssignee(
      updates.assignee,
      req.params.id as string,
      task.title,
      `Assigned to task: "${task.title}"`,
    );
    await NotificationService.notifyTaskAssignee(
      oldTask.assignee!.toString(),
      req.params.id as string,
      task.title,
      `Assignee changed: "${task.title}"`,
    );
  } else {
    await NotificationService.notifyTaskAssignee(
      updates.assignee,
      req.params.id as string,
      task.title,
      `See the change on task: "${task.title}"`,
    );
  }

  // Notify status change
  // if (updates.status && updates.status !== oldTask.status) {
  //   await NotificationService.notifyStatusChangeToAdmins(
  //     req.params.id,
  //     task.title,
  //     `Status changed from ${oldTask.status} to ${updates.status}`,
  //   );
  // }
  res.json(task);
};

export const updateTaskLink = async (req: AuthRequest, res: Response) => {
  const oldTask = await Task.findById(req.params.id);
  if (!oldTask) {
    return res.status(404).json({ message: "Task not found" });
  }
  const link = req.body;

  const updates = {
    links: [...oldTask.links, req.body],
  };

  const task = await Task.findByIdAndUpdate(req.params.id, updates, {
    new: true,
  })
    .populate("assignee", "fullName email role")
    .populate("createdBy", "fullName email role");
  if (!task) {
    return res.status(404).json({ message: "Task not found" });
  }

  await NotificationService.notifyLinkAddedToAdmins(
    task._id.toString(),
    link.title,
    `Link added "${link.title}". Task: "${task.title}"`,
  );

  res.json(task);
};

export const updateTaskStatus = async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const taskId = req.params.id as string;

    const oldTask = await Task.findById(taskId);
    if (!oldTask) {
      return res.status(404).json({ message: "Task not found" });
    }

    const task = await Task.findByIdAndUpdate(taskId, { status }, { new: true })
      .populate("assignee", "fullName email profilePicture")
      .populate("createdBy", "fullName email profilePicture");

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // Send notification for status change
    if (status !== oldTask.status) {
      await NotificationService.notifyStatusChangeToAdmins(
        taskId,
        task.title,
        `Task "${task.title}" status changed from ${oldTask.status} to ${status}`,
      );
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ message: "Failed to update task status", error });
  }
};

export const reorderTasks = async (req: AuthRequest, res: Response) => {
  const requester = req.user!;
  if (!canManage(requester.role)) {
    return res.status(403).json({ message: "Only managers can reorder tasks" });
  }

  const { updates } = req.body; // updates: [{ taskId: string, position: number, status: string }]
  if (!Array.isArray(updates)) {
    return res.status(400).json({ message: "Invalid update payload" });
  }

  const operations = updates.map((item) => ({
    updateOne: {
      filter: { _id: item.taskId, status: item.status },
      update: { $set: { position: item.position } },
    },
  }));

  try {
    await Task.bulkWrite(operations);
    res.status(200).json({ message: "Tasks reordered successfully" });
  } catch (error) {
    console.error("Bulk reorder failed:", error);
    res.status(500).json({ message: "Failed to reorder tasks" });
  }
};

export const deleteTask = async (req: AuthRequest, res: Response) => {
  const requester = req.user!;
  if (!canManage(requester.role)) {
    return res.status(403).json({ message: "Only managers can delete tasks" });
  }

  const task = await Task.findByIdAndDelete(req.params.id);
  if (!task) {
    return res.status(404).json({ message: "Task not found" });
  }
  res.status(204).send();
};

async function populateTaskComments(task: any) {
  return task.populate([
    { path: "comments.author", select: "fullName email role profilePicture" },
    {
      path: "comments.replies.author",
      select: "fullName email role profilePicture",
    },
  ]);
}

// --- Comments & Replies ---

export const addComment = async (req: AuthRequest, res: Response) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ message: "Content is required" });

  const task = await Task.findById(req.params.id);
  if (!task) return res.status(404).json({ message: "Task not found" });

  const commentId = new mongoose.Types.ObjectId();
  task.comments.push({
    _id: commentId,
    author: req.user!.id as any,
    content,
    createdAt: new Date(),
    replies: [],
  });

  await task.save();
  // Notify assignee if not author
  if (task.assignee && task.assignee.toString() !== req.user!.id) {
    await NotificationService.notifyCommentToAssignee(
      task.assignee.toString(),
      req.params.id as string,
      commentId,
      `New comment on "${task.title}"`,
    );
  }

  // Notify admins
  await NotificationService.notifyNewCommentToAdmins(
    req.params.id as string,
    commentId,
    `New comment on "${task.title}"`,
  );
  const populated = await populateTaskComments(task);
  res.json(populated);
};

export const updateComment = async (req: AuthRequest, res: Response) => {
  const { content } = req.body;
  const task = await Task.findById(req.params.id);
  if (!task) return res.status(404).json({ message: "Task not found" });

  const comment = (task.comments as any).id(req.params.commentId);
  if (!comment) return res.status(404).json({ message: "Comment not found" });

  const requester = req.user!;
  const isAuthor = comment.author.toString() === requester.id;
  if (!canManage(requester.role) && !isAuthor) {
    return res.status(403).json({ message: "Forbidden" });
  }

  comment.content = content;
  await task.save();
  // Notify assignee if not author
  if (task.assignee && task.assignee.toString() !== req.user!.id) {
    await NotificationService.notifyCommentUpdateToAssignee(
      task.assignee.toString(),
      req.params.id as string,
      comment._id,
      `Comment updated on "${task.title}"`,
    );
  }

  // Notify admins
  await NotificationService.notifyCommentUpdateToAdmins(
    req.params.id as string,
    comment._id,
    `Comment updated on "${task.title}"`,
  );
  const populated = await populateTaskComments(task);
  res.json(populated);
};

export const deleteComment = async (req: AuthRequest, res: Response) => {
  const task = await Task.findById(req.params.id);
  if (!task) return res.status(404).json({ message: "Task not found" });

  const comment = (task.comments as any).id(req.params.commentId);
  if (!comment) return res.status(404).json({ message: "Comment not found" });

  const requester = req.user!;
  const isAuthor = comment.author.toString() === requester.id;
  if (!canManage(requester.role) && !isAuthor) {
    return res.status(403).json({ message: "Forbidden" });
  }

  comment.deleteOne();
  await task.save();
  const populated = await populateTaskComments(task);
  res.json(populated);
};

export const replyToComment = async (req: AuthRequest, res: Response) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ message: "Content is required" });

  const task = await Task.findById(req.params.id);
  if (!task) return res.status(404).json({ message: "Task not found" });

  const comment = (task.comments as any).id(req.params.commentId);
  if (!comment) return res.status(404).json({ message: "Comment not found" });

  const repplyId = new mongoose.Types.ObjectId();
  comment.replies.push({
    _id: repplyId,
    author: req.user!.id as any,
    content,
    createdAt: new Date(),
  });

  await task.save();
  // Notify assignee if not author
  if (task.assignee && task.assignee.toString() !== req.user!.id) {
    await NotificationService.notifyRepplyToAssignee(
      task.assignee.toString(),
      req.params.id as string,
      repplyId,
      `Reply on a comment "${content}"`,
    );
  }

  // Notify admins
  await NotificationService.notifyNewRepplyToAdmins(
    req.params.id as string,
    repplyId,
    `Reply on a comment "${content}"`,
  );
  const populated = await populateTaskComments(task);
  res.json(populated);
};

export const updateReply = async (req: AuthRequest, res: Response) => {
  const { content } = req.body;
  const task = await Task.findById(req.params.id);
  if (!task) return res.status(404).json({ message: "Task not found" });

  const comment = (task.comments as any).id(req.params.commentId);
  if (!comment) return res.status(404).json({ message: "Comment not found" });

  const reply = comment.replies.id(req.params.replyId);
  if (!reply) return res.status(404).json({ message: "Reply not found" });

  const requester = req.user!;
  const isAuthor = reply.author.toString() === requester.id;
  if (!canManage(requester.role) && !isAuthor) {
    return res.status(403).json({ message: "Forbidden" });
  }

  reply.content = content;
  await task.save();
  if (task.assignee && task.assignee.toString() !== req.user!.id) {
    await NotificationService.notifyRepplyUpdateToAssignee(
      task.assignee.toString(),
      req.params.id as string,
      reply._id,
      `Reply updated "${content}"`,
    );
  }

  // Notify admins
  await NotificationService.notifyNewRepplyUpdateToAdmins(
    req.params.id as string,
    task.title,
    `Reply updated "${content}"`,
  );
  const populated = await populateTaskComments(task);
  res.json(populated);
};

export const deleteReply = async (req: AuthRequest, res: Response) => {
  const task = await Task.findById(req.params.id);
  if (!task) return res.status(404).json({ message: "Task not found" });

  const comment = (task.comments as any).id(req.params.commentId);
  if (!comment) return res.status(404).json({ message: "Comment not found" });

  const reply = comment.replies.id(req.params.replyId);
  if (!reply) return res.status(404).json({ message: "Reply not found" });

  const requester = req.user!;
  const isAuthor = reply.author.toString() === requester.id;
  if (!canManage(requester.role) && !isAuthor) {
    return res.status(403).json({ message: "Forbidden" });
  }

  reply.deleteOne();
  await task.save();
  const populated = await populateTaskComments(task);
  res.json(populated);
};
