import { Request, Response } from 'express';
import { Task } from "../models/Task";
import { User } from "../models/User";
import { NotificationService } from '../services/notificationService';

// Audio upload with MP3 conversion
import multer from 'multer';
import fs from 'fs/promises';
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);

const audioStorage = multer.diskStorage({
  destination: 'uploads/audio/',
  filename: (req, file, cb) => cb(null, req.params.id + '-' + Date.now() + '-' + file.originalname)
});
const uploadAudio = multer({ storage: audioStorage });

export const uploadAudioAttachment = async (req: Request, res: Response) => {
  try {
    const taskId = req.params.id;
    const file = req.file;
    if (!file) return res.status(400).json({ message: 'No file' });

    // Convert to MP3
    const mp3Path = file.path.replace(/\\.webm$/, '.mp3');
    ffmpeg(file.path)
      .audioCodec('mp3')
      .toFormat('mp3')
      .output(mp3Path)
      .on('end', async () => {
        await fs.unlink(file.path); // delete webm
        const task = await Task.findById(taskId);
        task.attachments.push({
          filename: file.filename.replace(/\\.webm$/, '.mp3'),
          path: file.path.replace(/\\.webm$/, '.mp3'),
          type: 'audio/mp3'
        });
        await task.save();
        res.json({ message: 'MP3 uploaded' });
      })
      .run();
  } catch (error) {
    res.status(500).json({ error });
  }
};

export const listTasks = async (req: Request, res: Response) => {
  try {
    const tasks = await Task.find()
      .populate('assignee', 'fullName email profilePicture')
      .populate('createdBy', 'fullName email profilePicture')
      .sort({ position: 1, createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch tasks', error });
  }
};

export const getTask = async (req: Request, res: Response) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignee', 'fullName email profilePicture')
      .populate('createdBy', 'fullName email profilePicture')
      .populate({
        path: 'comments',
        populate: [
          { path: 'author', select: 'fullName email profilePicture' },
          { path: 'replies.author', select: 'fullName email profilePicture' }
        ]
      });

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch task', error });
  }
};

export const createTask = async (req: Request, res: Response) => {
  try {
    const { title, description, status, assignee, priority, dueDate, tags, attachments } = req.body;
    const userId = (req as any).user?.id;

    const task = new Task({
      title,
      description,
      status: status || 'pending',
      assignee: assignee || null,
      createdBy: userId,
      priority: priority || 'medium',
      dueDate: dueDate || null,
      tags: tags || [],
      attachments: attachments || []
    });

    await task.save();

    // Populate the task with user details
    const populatedTask = await Task.findById(task._id)
      .populate('assignee', 'fullName email profilePicture')
      .populate('createdBy', 'fullName email profilePicture');

    // Send notification if task is assigned to someone
    if (assignee && assignee !== userId) {
      await NotificationService.notifyTaskAssignee(
        assignee,
        task._id.toString(),
        title,
        `You have been assigned a new task: "${title}"`
      );
    }

    // Notify admins about new task
    await NotificationService.notifyNewTaskToAdmins(
      task._id.toString(),
      title,
      `A new task "${title}" has been created`
    );

    res.status(201).json(populatedTask);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create task', error });
  }
};

export const updateTask = async (req: Request, res: Response) => {
  try {
    const { title, description, status, assignee, priority, dueDate, tags, attachments } = req.body;
    const userId = (req as any).user?.id;
    const taskId = req.params.id;

    const oldTask = await Task.findById(taskId);
    if (!oldTask) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const task = await Task.findByIdAndUpdate(
      taskId,
      {
        title,
        description,
        status,
        assignee,
        priority,
        dueDate,
        tags,
        attachments
      },
      { new: true }
    )
      .populate('assignee', 'fullName email profilePicture')
      .populate('createdBy', 'fullName email profilePicture');

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Send notification if assignee changed
    if (assignee && assignee !== oldTask.assignee?.toString()) {
      await NotificationService.notifyTaskAssignee(
        assignee,
        taskId,
        title,
        `You have been assigned to task: "${title}"`
      );
    }

    // Send notification if status changed
    if (status && status !== oldTask.status) {
      await NotificationService.notifyStatusChangeToAdmins(
        taskId,
        title,
        `Task "${title}" status changed from ${oldTask.status} to ${status}`
      );
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update task', error });
  }
};

export const updateTaskStatus = async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const taskId = req.params.id;

    const oldTask = await Task.findById(taskId);
    if (!oldTask) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const task = await Task.findByIdAndUpdate(
      taskId,
      { status },
      { new: true }
    )
      .populate('assignee', 'fullName email profilePicture')
      .populate('createdBy', 'fullName email profilePicture');

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Send notification for status change
    if (status !== oldTask.status) {
      await NotificationService.notifyStatusChangeToAdmins(
        taskId,
        task.title,
        `Task "${task.title}" status changed from ${oldTask.status} to ${status}`
      );
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update task status', error });
  }
};

export const deleteTask = async (req: Request, res: Response) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete task', error });
  }
};

export const addComment = async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    const userId = (req as any).user?.id;
    const taskId = req.params.id;

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const comment = {
      content,
      author: userId,
      createdAt: new Date()
    };

    task.comments.push(comment);
    await task.save();

    const populatedTask = await Task.findById(taskId)
      .populate('assignee', 'fullName email profilePicture')
      .populate('createdBy', 'fullName email profilePicture')
      .populate({
        path: 'comments',
        populate: [
          { path: 'author', select: 'fullName email profilePicture' },
          { path: 'replies.author', select: 'fullName email profilePicture' }
        ]
      });

    const newComment = populatedTask?.comments[populatedTask.comments.length - 1];

    // Send notification to task assignee if comment is not from assignee
    if (task.assignee && task.assignee.toString() !== userId) {
      await NotificationService.notifyCommentToAssignee(
        task.assignee.toString(),
        taskId,
        task.title,
        `New comment on task "${task.title}"`
      );
    }

    // Notify admins about new comment
    await NotificationService.notifyNewCommentToAdmins(
      taskId,
      task.title,
      `New comment added to task "${task.title}"`
    );

    res.status(201).json(newComment);
  } catch (error) {
    res.status(500).json({ message: 'Failed to add comment', error });
  }
};

export const updateComment = async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    const { id, commentId } = req.params;

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const comment = task.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    comment.content = content;
    await task.save();

    res.json(comment);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update comment', error });
  }
};

export const deleteComment = async (req: Request, res: Response) => {
  try {
    const { id, commentId } = req.params;

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const comment = task.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    comment.deleteOne();
    await task.save();

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete comment', error });
  }
};

export const replyToComment = async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    const userId = (req as any).user?.id;
    const { id, commentId } = req.params;

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const comment = task.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const reply = {
      content,
      author: userId,
      createdAt: new Date()
    };

    comment.replies.push(reply);
    await task.save();

    const populatedTask = await Task.findById(id)
      .populate('assignee', 'fullName email profilePicture')
      .populate('createdBy', 'fullName email profilePicture')
      .populate({
        path: 'comments',
        populate: [
          { path: 'author', select: 'fullName email profilePicture' },
          { path: 'replies.author', select: 'fullName email profilePicture' }
        ]
      });

    const updatedComment = populatedTask?.comments.id(commentId);
    const newReply = updatedComment?.replies[updatedComment.replies.length - 1];

    res.status(201).json(newReply);
  } catch (error) {
    res.status(500).json({ message: 'Failed to add reply', error });
  }
};

export const updateReply = async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    const { id, commentId, replyId } = req.params;

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const comment = task.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const reply = comment.replies.id(replyId);
    if (!reply) {
      return res.status(404).json({ message: 'Reply not found' });
    }

    reply.content = content;
    await task.save();

    res.json(reply);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update reply', error });
  }
};

export const deleteReply = async (req: Request, res: Response) => {
  try {
    const { id, commentId, replyId } = req.params;

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const comment = task.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const reply = comment.replies.id(replyId);
    if (!reply) {
      return res.status(404).json({ message: 'Reply not found' });
    }

    reply.deleteOne();
    await task.save();

    res.json({ message: 'Reply deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete reply', error });
  }
};

export const reorderTasks = async (req: Request, res: Response) => {
  try {
    const { updates } = req.body;

    const bulkOps = updates.map((update: any) => ({
      updateOne: {
        filter: { _id: update.taskId },
        update: { $set: { position: update.position, status: update.status } }
      }
    }));

    await Task.bulkWrite(bulkOps);

    res.json({ message: 'Tasks reordered successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to reorder tasks', error });
  }
};

export const getTaskStats = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;
    const { startDate, endDate } = req.query;

    // Build match filter based on user role
    let matchFilter: any = {};
    
    // If user is not admin or manager, only show their tasks
    if (userRole !== 'admin' && userRole !== 'manager') {
      matchFilter.assignee = userId;
    }

    // Add date filters if provided
    if (startDate || endDate) {
      matchFilter.dueDate = {};
      if (startDate) matchFilter.dueDate.$gte = new Date(startDate as string);
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        matchFilter.dueDate.$lte = end;
      }
    }

    const stats = await Task.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalHours: { $sum: { $ifNull: ['$estimatedHours', 0] } }
        }
      },
      {
        $project: {
          status: '$_id',
          count: 1,
          totalHours: 1,
          _id: 0
        }
      }
    ]);

    // Get total counts
    const totalTasks = await Task.countDocuments(matchFilter);
    const completedTasks = await Task.countDocuments({ ...matchFilter, status: 'completed' });
    const overdueTasks = await Task.countDocuments({
      ...matchFilter,
      dueDate: { $lt: new Date() },
      status: { $ne: 'completed' }
    });

    // Get user-specific statistics for Team Member Task Breakdown
    const userStats = await Task.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$assignee',
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          processing: { $sum: { $cond: [{ $eq: ['$status', 'processing'] }, 1, 0] } },
          qa: { $sum: { $cond: [{ $eq: ['$status', 'qa'] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          canceled: { $sum: { $cond: [{ $eq: ['$status', 'canceled'] }, 1, 0] } }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'assignee'
        }
      },
      { $unwind: { path: '$assignee', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          assignee: {
            _id: '$assignee._id',
            fullName: { $ifNull: ['$assignee.fullName', 'Unassigned'] },
            email: { $ifNull: ['$assignee.email', ''] },
            role: { $ifNull: ['$assignee.role', ''] },
            profilePicture: { $ifNull: ['$assignee.profilePicture', ''] }
          },
          total: 1,
          pending: 1,
          processing: 1,
          qa: 1,
          completed: 1,
          canceled: 1,
          _id: 0
        }
      },
      { $sort: { total: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      byStatus: stats,
      totals: {
        total: totalTasks,
        completed: completedTasks,
        overdue: overdueTasks,
        completionRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
      },
      users: userStats
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch task stats', error });
  }
};
