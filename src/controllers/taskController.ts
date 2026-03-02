import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { Task, TaskStatus, ITask, IComment, IReply } from '../models/Task';
import { AuthRequest } from '../middleware/authMiddleware';
import { Types } from 'mongoose';

const managerRoles = ['admin', 'manager'];
const allowedTransitions: Record<TaskStatus, TaskStatus[]> = {
  pending: ['processing', 'canceled'],
  processing: ['qa', 'canceled'],
  qa: ['processing', 'completed', 'canceled'],
  completed: ['qa', 'processing', 'canceled'],
  canceled: []
};

const canManage = (role?: string | null) => !!role && managerRoles.includes(role);

export const listTasks = async (req: AuthRequest, res: Response) => {
  const requester = req.user!;
  const filter = canManage(requester.role) ? {} : { assignee: requester.id };
  const tasks = await Task.find(filter)
    .populate('assignee', 'fullName email role profilePicture')
    .populate('createdBy', 'fullName email role profilePicture')
    .sort({ createdAt: -1 });
  res.json(tasks);
};

export const getTask = async (req: AuthRequest, res: Response) => {
  const requester = req.user!;
  const task = await Task.findById(req.params.id)
    .populate('assignee', 'fullName email role profilePicture')
    .populate('createdBy', 'fullName email role profilePicture')
    .populate({
      path: 'comments.author',
      select: 'fullName email role profilePicture'
    })
    .populate({
      path: 'comments.replies.author',
      select: 'fullName email role profilePicture'
    });

  if (!task) {
    return res.status(404).json({ message: 'Task not found' });
  }
  if (!canManage(requester.role) && task.assignee?.toString() !== requester.id) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  res.json(task);
};

export const createTask = async (req: AuthRequest, res: Response) => {
  const requester = req.user!;
  if (!canManage(requester.role)) {
    return res.status(403).json({ message: 'Only managers can create tasks' });
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const payload = {
    title: req.body.title,
    description: req.body.description,
    assignee: req.body.assignee || undefined,
    startDate: req.body.startDate,
    dueDate: req.body.dueDate,
    attachments: req.body.attachments || [],
    createdBy: requester.id
  };

  const task = await Task.create(payload);
  const populated = await task.populate([ 
    { path: 'assignee', select: 'fullName email role' },
    { path: 'createdBy', select: 'fullName email role' }
  ]);
  res.status(201).json(populated);
};

export const updateTask = async (req: AuthRequest, res: Response) => {
  const requester = req.user!;
  if (!canManage(requester.role)) {
    return res.status(403).json({ message: 'Only managers can edit tasks' });
  }

  const updates = {
    title: req.body.title,
    description: req.body.description,
    assignee: req.body.assignee,
    startDate: req.body.startDate,
    dueDate: req.body.dueDate,
    attachments: req.body.attachments
  };

  const task = await Task.findByIdAndUpdate(req.params.id, updates, { new: true })
    .populate('assignee', 'fullName email role')
    .populate('createdBy', 'fullName email role');
  if (!task) {
    return res.status(404).json({ message: 'Task not found' });
  }
  res.json(task);
};

export const updateTaskStatus = async (req: AuthRequest, res: Response) => {
  const requester = req.user!;
  const task = await Task.findById(req.params.id);
  if (!task) {
    return res.status(404).json({ message: 'Task not found' });
  }

  const nextStatus: TaskStatus = req.body.status;
  if (!nextStatus) {
    return res.status(400).json({ message: 'Status is required' });
  }

  const isAssignee = task.assignee?.toString() === requester.id;
  const manager = canManage(requester.role);

  if (!manager && !isAssignee) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  if (!manager) {
    const allowed = allowedTransitions[task.status as TaskStatus] || [];
    if (!allowed.includes(nextStatus)) {
      return res.status(400).json({ message: 'Invalid status transition' });
    }
  }

  task.status = nextStatus;
  await task.save();
  const populated = await task.populate('assignee', 'fullName email role');
  res.json(populated);
};

export const deleteTask = async (req: AuthRequest, res: Response) => {
  const requester = req.user!;
  if (!canManage(requester.role)) {
    return res.status(403).json({ message: 'Only managers can delete tasks' });
  }

  const task = await Task.findByIdAndDelete(req.params.id);
  if (!task) {
    return res.status(404).json({ message: 'Task not found' });
  }
  res.status(204).send();
};

async function populateTaskComments(task: any) {
  return task.populate([
    { path: 'comments.author', select: 'fullName email role profilePicture' },
    { path: 'comments.replies.author', select: 'fullName email role profilePicture' }
  ]);
}

// --- Comments & Replies ---

export const addComment = async (req: AuthRequest, res: Response) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ message: 'Content is required' });

  const task = await Task.findById(req.params.id);
  if (!task) return res.status(404).json({ message: 'Task not found' });

  task.comments.push({
    author: req.user!.id as any,
    content,
    createdAt: new Date(),
    replies: []
  });

  await task.save();
  const populated = await populateTaskComments(task);
  res.json(populated);
};

export const updateComment = async (req: AuthRequest, res: Response) => {
  const { content } = req.body;
  const task = await Task.findById(req.params.id);
  if (!task) return res.status(404).json({ message: 'Task not found' });

  const comment = (task.comments as any).id(req.params.commentId);
  if (!comment) return res.status(404).json({ message: 'Comment not found' });

  const requester = req.user!;
  const isAuthor = comment.author.toString() === requester.id;
  if (!canManage(requester.role) && !isAuthor) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  comment.content = content;
  await task.save();
  const populated = await populateTaskComments(task);
  res.json(populated);
};

export const deleteComment = async (req: AuthRequest, res: Response) => {
  const task = await Task.findById(req.params.id);
  if (!task) return res.status(404).json({ message: 'Task not found' });

  const comment = (task.comments as any).id(req.params.commentId);
  if (!comment) return res.status(404).json({ message: 'Comment not found' });

  const requester = req.user!;
  const isAuthor = comment.author.toString() === requester.id;
  if (!canManage(requester.role) && !isAuthor) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  comment.deleteOne();
  await task.save();
  const populated = await populateTaskComments(task);
  res.json(populated);
};

export const replyToComment = async (req: AuthRequest, res: Response) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ message: 'Content is required' });

  const task = await Task.findById(req.params.id);
  if (!task) return res.status(404).json({ message: 'Task not found' });

  const comment = (task.comments as any).id(req.params.commentId);
  if (!comment) return res.status(404).json({ message: 'Comment not found' });

  comment.replies.push({
    author: req.user!.id as any,
    content,
    createdAt: new Date()
  });

  await task.save();
  const populated = await populateTaskComments(task);
  res.json(populated);
};

export const updateReply = async (req: AuthRequest, res: Response) => {
  const { content } = req.body;
  const task = await Task.findById(req.params.id);
  if (!task) return res.status(404).json({ message: 'Task not found' });

  const comment = (task.comments as any).id(req.params.commentId);
  if (!comment) return res.status(404).json({ message: 'Comment not found' });

  const reply = comment.replies.id(req.params.replyId);
  if (!reply) return res.status(404).json({ message: 'Reply not found' });

  const requester = req.user!;
  const isAuthor = reply.author.toString() === requester.id;
  if (!canManage(requester.role) && !isAuthor) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  reply.content = content;
  await task.save();
  const populated = await populateTaskComments(task);
  res.json(populated);
};

export const deleteReply = async (req: AuthRequest, res: Response) => {
  const task = await Task.findById(req.params.id);
  if (!task) return res.status(404).json({ message: 'Task not found' });

  const comment = (task.comments as any).id(req.params.commentId);
  if (!comment) return res.status(404).json({ message: 'Comment not found' });

  const reply = comment.replies.id(req.params.replyId);
  if (!reply) return res.status(404).json({ message: 'Reply not found' });

  const requester = req.user!;
  const isAuthor = reply.author.toString() === requester.id;
  if (!canManage(requester.role) && !isAuthor) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  reply.deleteOne();
  await task.save();
  const populated = await populateTaskComments(task);
  res.json(populated);
};
