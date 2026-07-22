import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IServiceTicket extends Document {
  projectId: Types.ObjectId;
  ticketNumber: string;
  title: string;
  description?: string;
  linkedErrorIds: Types.ObjectId[];
  linkedErrorGroupIds: Types.ObjectId[];
  status: 'open' | 'in_progress' | 'waiting_for_customer' | 'resolved' | 'closed';
  priority: 'critical' | 'high' | 'medium' | 'low';
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'bug' | 'feature_request' | 'performance' | 'security' | 'other';
  type: 'incident' | 'task' | 'improvement';
  createdBy: Types.ObjectId;
  assignedTo?: Types.ObjectId;
  reporter?: Types.ObjectId;
  watchers: Types.ObjectId[];
  dueDate?: Date;
  completedAt?: Date;
  tags: string[];
  environment?: 'development' | 'staging' | 'production';
  attachments: Array<{
    _id: Types.ObjectId;
    filename: string;
    url: string;
    key?: string;
    contentType: string;
    size: number;
    storage: 'spaces' | 'inline';
    uploadedAt: Date;
    uploadedBy?: Types.ObjectId;
    data?: string;
  }>;
  reporterName?: string;
  reporterEmail?: string;
  comments: Array<{
    _id: Types.ObjectId;
    authorId?: Types.ObjectId;
    authorName?: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
  activityLog: Array<{
    action: string;
    performedBy?: Types.ObjectId;
    changes?: { field: string; oldValue?: string; newValue?: string };
    timestamp: Date;
  }>;
  customFields?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const ServiceTicketSchema = new Schema<IServiceTicket>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    ticketNumber: { type: String, required: true },
    title: { type: String, required: true, index: true },
    description: String,
    linkedErrorIds: [{ type: Schema.Types.ObjectId, ref: 'ErrorEvent' }],
    linkedErrorGroupIds: [{ type: Schema.Types.ObjectId, ref: 'ErrorGroup' }],
    status: {
      type: String,
      enum: ['open', 'in_progress', 'waiting_for_customer', 'resolved', 'closed'],
      default: 'open',
      index: true,
    },
    priority: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low'],
      default: 'medium',
      index: true,
    },
    severity: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low'],
      default: 'medium',
    },
    category: {
      type: String,
      enum: ['bug', 'feature_request', 'performance', 'security', 'other'],
      default: 'bug',
    },
    type: {
      type: String,
      enum: ['incident', 'task', 'improvement'],
      default: 'incident',
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    reporter: { type: Schema.Types.ObjectId, ref: 'User' },
    watchers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    dueDate: Date,
    completedAt: Date,
    tags: [String],
    environment: {
      type: String,
      enum: ['development', 'staging', 'production'],
    },
    reporterName: String,
    reporterEmail: { type: String, index: true },
    attachments: [
      {
        filename: String,
        url: String,
        key: String,
        contentType: String,
        size: Number,
        storage: { type: String, enum: ['spaces', 'inline'], default: 'inline' },
        uploadedAt: { type: Date, default: Date.now },
        uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        data: String,
      },
    ],
    comments: [
      {
        authorId: { type: Schema.Types.ObjectId, ref: 'User' },
        authorName: String,
        content: String,
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
    activityLog: [
      {
        action: String,
        performedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        changes: {
          field: String,
          oldValue: String,
          newValue: String,
        },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    customFields: Schema.Types.Mixed,
  },
  { timestamps: true }
);

ServiceTicketSchema.index({ projectId: 1, ticketNumber: 1 }, { unique: true });

export const ServiceTicket = mongoose.model<IServiceTicket>('ServiceTicket', ServiceTicketSchema);
