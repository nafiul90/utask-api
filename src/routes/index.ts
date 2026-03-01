import { Router } from 'express';
import { body } from 'express-validator';
import {
  signup,
  login,
  createUser,
  listUsers,
  getUser,
  updateUser,
  deleteUser
} from '../controllers/userController';
import { authMiddleware, requireRoles } from '../middleware/authMiddleware';
import { upload } from '../middleware/upload';
import { uploadProfileImage, uploadTaskAttachment } from '../controllers/uploadController';
import {
  createTask,
  deleteTask,
  getTask,
  listTasks,
  updateTask,
  updateTaskStatus,
  addComment,
  replyToComment
} from '../controllers/taskController';

const router = Router();

const signupValidator = [
  body('fullName').isString().notEmpty(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('role').optional().isIn(['admin', 'manager', 'employee'])
];

const loginValidator = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
];

const userMutationValidator = [
  body('fullName').optional().isString(),
  body('email').optional().isEmail().normalizeEmail(),
  body('password').optional().isLength({ min: 6 }),
  body('role').optional().isIn(['admin', 'manager', 'employee'])
];

const taskCreateValidator = [
  body('title').isString().notEmpty(),
  body('assignee').optional().isMongoId(),
  body('startDate').optional().isISO8601(),
  body('dueDate').optional().isISO8601(),
  body('attachments').optional().isArray()
];

const taskUpdateValidator = [
  body('title').optional().isString(),
  body('assignee').optional().isMongoId(),
  body('startDate').optional().isISO8601(),
  body('dueDate').optional().isISO8601(),
  body('attachments').optional().isArray()
];

const statusValidator = [body('status').isIn(['pending', 'processing', 'qa', 'completed', 'canceled'])];

router.post('/auth/signup', signupValidator, signup);
router.post('/auth/login', loginValidator, login);

router.use(authMiddleware);
router.post('/uploads/profile', upload.single('file'), uploadProfileImage);
router.post('/uploads/file', upload.single('file'), uploadTaskAttachment);

router.get('/users', listUsers);
router.post('/users', requireRoles('admin', 'manager'), signupValidator, createUser);
router.get('/users/:id', getUser);
router.put('/users/:id', userMutationValidator, updateUser);
router.delete('/users/:id', requireRoles('admin'), deleteUser);

router.get('/tasks', listTasks);
router.post('/tasks', taskCreateValidator, createTask);
router.get('/tasks/:id', getTask);
router.put('/tasks/:id', taskUpdateValidator, updateTask);
router.patch('/tasks/:id/status', statusValidator, updateTaskStatus);
router.delete('/tasks/:id', deleteTask);

// Comments
router.post('/tasks/:id/comments', addComment);
router.post('/tasks/:id/comments/:commentId/replies', replyToComment);

export default router;
