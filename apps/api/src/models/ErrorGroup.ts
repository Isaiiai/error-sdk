import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IErrorGroup extends Document {
  projectId: Types.ObjectId;
  name: string;
  description?: string;
  fingerprints: string[];
  errorCount: number;
  affectedUsersCount: number;
  firstOccurrence: Date;
  lastOccurrence: Date;
  mostRecentErrorId?: Types.ObjectId;
  isResolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: Types.ObjectId;
  status: 'new' | 'acknowledged' | 'resolved' | 'regressed';
  priority: 'critical' | 'high' | 'medium' | 'low';
  tags: string[];
  linkedTicketIds: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const ErrorGroupSchema = new Schema<IErrorGroup>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    name: { type: String, required: true },
    description: String,
    fingerprints: [String],
    errorCount: { type: Number, default: 1 },
    affectedUsersCount: { type: Number, default: 0 },
    firstOccurrence: { type: Date, default: Date.now },
    lastOccurrence: { type: Date, default: Date.now },
    mostRecentErrorId: { type: Schema.Types.ObjectId, ref: 'ErrorEvent' },
    isResolved: { type: Boolean, default: false, index: true },
    resolvedAt: Date,
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['new', 'acknowledged', 'resolved', 'regressed'],
      default: 'new',
    },
    priority: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low'],
      default: 'medium',
    },
    tags: [String],
    linkedTicketIds: [{ type: Schema.Types.ObjectId, ref: 'ServiceTicket' }],
  },
  { timestamps: true }
);

ErrorGroupSchema.index({ projectId: 1, fingerprints: 1 });

export const ErrorGroup = mongoose.model<IErrorGroup>('ErrorGroup', ErrorGroupSchema);
