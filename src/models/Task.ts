import { Schema, model, Document, Types } from 'mongoose';

export type TaskStatus = 'pending' | 'processing' | 'qa' | 'completed' | 'canceled';

export interface IAttachment {
  filename: string;
  path: string;
  mimeType?: string;
  size?: number;
}

export interface ILink {
  _id?: Types.ObjectId;
  title: string;
  url: string;
}

export interface IReply {
  _id?: Types.ObjectId;
  author: Types.ObjectId;
  content: string;
  createdAt: Date;
}

export interface IComment {
  _id?: Types.ObjectId;
  author: Types.ObjectId;
  content: string;
  createdAt: Date;
  replies: IReply[];
}

export interface ITask extends Document {
  title: string;
  description?: string;
  status: TaskStatus;
  assignee?: Types.ObjectId;
  createdBy: Types.ObjectId;
  startDate: Date;
  dueDate: Date;
  attachments: IAttachment[];
  links: ILink[];
  comments: IComment[];
  position: number; // Added for sorting within status columns
}

const AttachmentSchema = new Schema<IAttachment>(
  {
    filename: String,
    path: { type: String, required: true },
    mimeType: String,
    size: Number
  },
  { _id: false }
);

const LinkSchema = new Schema<ILink>(
  {
    title: { type: String, required: true },
    url: { type: String, required: true }
  }
);

const ReplySchema = new Schema<IReply>(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }
);

const CommentSchema = new Schema<IComment>(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    replies: [ReplySchema]
  }
);

const TaskSchema = new Schema<ITask>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String },
    status: { type: String, enum: ['pending', 'processing', 'qa', 'completed', 'canceled'], default: 'pending' },
    assignee: { type: Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    startDate: { type: Date, default: () => new Date() },
    dueDate: {
      type: Date,
      default: () => {
        const date = new Date();
        date.setDate(date.getDate() + 1);
        date.setHours(23, 59, 59, 999);
        return date;
      }
    },
    attachments: { type: [AttachmentSchema], default: [] },
    links: { type: [LinkSchema], default: [] },
    comments: { type: [CommentSchema], default: [] },
    position: { type: Number, default: 0 } // Default position
  },
  { timestamps: true }
);

export const Task = model<ITask>('Task', TaskSchema);
