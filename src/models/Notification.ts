import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  message: string;
  type: 'task_assigned' | 'comment_added' | 'status_changed' | 'general';
  relatedTaskId?: mongoose.Types.ObjectId;
  relatedCommentId?: mongoose.Types.ObjectId;
  read: boolean;
  createdAt: Date;
}

const NotificationSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { 
    type: String, 
    required: true,
    enum: ['task_assigned', 'comment_added', 'status_changed', 'general']
  },
  relatedTaskId: { type: Schema.Types.ObjectId, ref: 'Task' },
  relatedCommentId: { type: Schema.Types.ObjectId, ref: 'Comment' },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<INotification>('Notification', NotificationSchema);
