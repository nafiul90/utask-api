const fs = require('fs');
const path = require('path');
const taskFile = path.join(__dirname, 'src/controllers/taskController.ts');
let taskContent = fs.readFileSync(taskFile, 'utf8');

// Add imports at top
if (!taskContent.includes('multer')) {
  taskContent = taskContent.replace(
    /import \{ Request, Response \} from 'express';/,
    `import { Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs/promises';`
  );
}

// Add uploadAudioAttachment function before the last }
const uploadAudioFunc = `

export const uploadAudioAttachment = async (req: Request, res: Response) => {
  try {
    const taskId = req.params.id;
    const userId = (req as any).user.id;
    const file = req.file;
    if (!file) return res.status(400).json({ message: 'No audio file uploaded' });

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const attachment = {
      filename: file.filename,
      path: \`/uploads/audio/\${file.filename}\`,
      type: 'audio',
      size: file.size,
      uploadedBy: userId,
      uploadedAt: new Date()
    };

    task.attachments.push(attachment);
    await task.save();

    res.json({ message: 'Audio attachment added', attachment });
  } catch (error) {
    res.status(500).json({ message: 'Upload failed', error: (error as Error).message });
  }
};

export const deleteAttachment = async (req: Request, res: Response) => {
  try {
    const taskId = req.params.id;
    const filename = req.params.filename;
    const userRole = (req as any).user.role;

    if (!['admin', 'manager'].includes(userRole)) {
      return res.status(403).json({ message: 'Insufficient permissions to delete attachments' });
    }

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    task.attachments = task.attachments.filter(a => a.filename !== filename);
    await task.save();

    const filePath = path.join(__dirname, '..', 'uploads', 'audio', filename);
    await fs.unlink(filePath).catch(err => console.log('File delete error:', err));

    res.json({ message: 'Attachment deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Delete failed', error: (error as Error).message });
  }
};`;

taskContent = taskContent.replace(/};$/m, uploadAudioFunc + '\n}');

fs.writeFileSync(taskFile, taskContent);

// Add routes to routes/index.ts
const routesFile = path.join(__dirname, 'src/routes/index.ts');
let routesContent = fs.readFileSync(routesFile, 'utf8');

// Add multer storage
const storageCode = `
const audioStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/audio/';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, req.params.id + '-' + Date.now() + '-' + file.originalname)
});

const uploadAudio = multer({ storage: audioStorage });`;

routesContent = routesContent.replace(
  /import multer from 'multer';/,
  `import multer from 'multer';
import fs from 'fs';
${storageCode}`
);

// Add routes after task routes
routesContent = routesContent.replace(
  /router\.post\('\\/tasks', taskCreateValidator, createTask\);/,
  `router.post('/tasks', taskCreateValidator, createTask);

router.post('/tasks/:id/attachments/audio', authMiddleware, uploadAudio.single('audio'), uploadAudioAttachment);
router.delete('/tasks/:id/attachments/:filename', authMiddleware, deleteAttachment);`
);

routesContent = routesContent.replace(
  /from '\.\.\/controllers\/taskController';/,
  `from '../controllers/taskController';
import { uploadAudioAttachment, deleteAttachment } from '../controllers/taskController';`
);

fs.writeFileSync(routesFile, routesContent);

console.log('✅ Backend audio attachments implemented');
