import mongoose, { Schema, Document, Types } from 'mongoose';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type Environment = 'development' | 'staging' | 'production';

export interface IErrorEvent extends Document {
  projectId: Types.ObjectId;
  groupId?: Types.ObjectId;
  message: string;
  errorType: string;
  severity: Severity;
  stackTrace?: string;
  sourceMap?: {
    file?: string;
    line?: number;
    column?: number;
    context?: string;
  };
  environment: Environment;
  version?: string;
  browser?: {
    name?: string;
    version?: string;
    userAgent?: string;
  };
  device?: {
    type?: 'mobile' | 'tablet' | 'desktop';
    os?: string;
    osVersion?: string;
  };
  location?: {
    country?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
    ipAddress?: string;
  };
  url?: string;
  urlPath?: string;
  user?: {
    userId?: string;
    username?: string;
    email?: string;
    customData?: Record<string, unknown>;
  };
  sessionId?: string;
  breadcrumbs: Array<{
    timestamp: Date;
    category: string;
    message: string;
    level: string;
    data?: Record<string, unknown>;
  }>;
  context?: {
    customData?: Record<string, unknown>;
    tags?: string[];
    release?: string;
  };
  screenshot?: {
    data?: string;
    url?: string;
    key?: string;
    storage?: 'spaces' | 'inline';
    contentType: string;
    width: number;
    height: number;
    capturedAt: Date;
  };
  platform?: Record<string, unknown>;
  networkActivity?: Array<{
    timestamp: string | Date;
    type: 'fetch' | 'xhr';
    method: string;
    url: string;
    status?: number;
    ok?: boolean;
    durationMs: number;
    requestBody?: string;
    responseBody?: string;
    error?: string;
  }>;
  fingerprint: string;
  isDuplicate: boolean;
  duplicateOf?: Types.ObjectId;
  isResolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: Types.ObjectId;
  resolutionNotes?: string;
  linkedTicketId?: Types.ObjectId;
  occurrenceCount: number;
  firstOccurrence: Date;
  lastOccurrence: Date;
  affectedUsers: number;
  uniqueAffectedUsers: string[];
  assignedTo?: Types.ObjectId;
  comments: Array<{
    _id: Types.ObjectId;
    authorId: Types.ObjectId;
    content: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const ErrorSchema = new Schema<IErrorEvent>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    groupId: { type: Schema.Types.ObjectId, ref: 'ErrorGroup', index: true },
    message: { type: String, required: true, index: true },
    errorType: { type: String, required: true },
    severity: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low', 'info'],
      default: 'medium',
      index: true,
    },
    stackTrace: String,
    sourceMap: {
      file: String,
      line: Number,
      column: Number,
      context: String,
    },
    environment: {
      type: String,
      enum: ['development', 'staging', 'production'],
      default: 'production',
      index: true,
    },
    version: String,
    browser: {
      name: String,
      version: String,
      userAgent: String,
    },
    device: {
      type: { type: String, enum: ['mobile', 'tablet', 'desktop'] },
      os: String,
      osVersion: String,
    },
    location: {
      country: String,
      city: String,
      latitude: Number,
      longitude: Number,
      ipAddress: String,
    },
    url: String,
    urlPath: { type: String, index: true },
    user: {
      userId: String,
      username: String,
      email: String,
      customData: Schema.Types.Mixed,
    },
    sessionId: String,
    breadcrumbs: [
      {
        timestamp: { type: Date, default: Date.now },
        category: String,
        message: String,
        level: String,
        data: Schema.Types.Mixed,
      },
    ],
    context: {
      customData: Schema.Types.Mixed,
      tags: [String],
      release: String,
    },
    screenshot: {
      data: { type: String },
      url: String,
      key: String,
      storage: { type: String, enum: ['spaces', 'inline'], default: 'inline' },
      contentType: { type: String, default: 'image/jpeg' },
      width: Number,
      height: Number,
      capturedAt: Date,
    },
    platform: Schema.Types.Mixed,
    networkActivity: [
      {
        timestamp: { type: Date, default: Date.now },
        type: { type: String, enum: ['fetch', 'xhr'] },
        method: String,
        url: String,
        status: Number,
        ok: Boolean,
        durationMs: Number,
        requestBody: String,
        responseBody: String,
        error: String,
      },
    ],
    fingerprint: { type: String, required: true, index: true },
    isDuplicate: { type: Boolean, default: false, index: true },
    duplicateOf: { type: Schema.Types.ObjectId, ref: 'ErrorEvent' },
    isResolved: { type: Boolean, default: false, index: true },
    resolvedAt: Date,
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolutionNotes: String,
    linkedTicketId: { type: Schema.Types.ObjectId, ref: 'ServiceTicket' },
    occurrenceCount: { type: Number, default: 1 },
    firstOccurrence: { type: Date, default: Date.now },
    lastOccurrence: { type: Date, default: Date.now },
    affectedUsers: { type: Number, default: 0 },
    uniqueAffectedUsers: [String],
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    comments: [
      {
        authorId: { type: Schema.Types.ObjectId, ref: 'User' },
        content: String,
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

ErrorSchema.index({ projectId: 1, fingerprint: 1 });
ErrorSchema.index({ projectId: 1, createdAt: -1 });

export const ErrorEvent = mongoose.model<IErrorEvent>('ErrorEvent', ErrorSchema);
