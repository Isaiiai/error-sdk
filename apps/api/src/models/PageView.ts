import mongoose, { Schema, Document, Types } from 'mongoose';

export type DevicePlatform = 'mobile' | 'tablet' | 'desktop' | 'webview' | 'unknown';

export interface IPageView extends Document {
  projectId: Types.ObjectId;
  sessionId: string;
  userId?: string;
  path: string;
  title?: string;
  referrer?: string;
  url?: string;
  platform: DevicePlatform;
  runtime?: string;
  browser?: string;
  os?: string;
  durationMs?: number;
  engaged: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const PageViewSchema = new Schema<IPageView>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    userId: { type: String, index: true },
    path: { type: String, required: true, index: true },
    title: String,
    referrer: String,
    url: String,
    platform: {
      type: String,
      enum: ['mobile', 'tablet', 'desktop', 'webview', 'unknown'],
      default: 'unknown',
      index: true,
    },
    runtime: String,
    browser: String,
    os: String,
    durationMs: Number,
    engaged: { type: Boolean, default: true },
    metadata: Schema.Types.Mixed,
  },
  { timestamps: true }
);

PageViewSchema.index({ projectId: 1, createdAt: -1 });
PageViewSchema.index({ projectId: 1, path: 1, createdAt: -1 });
PageViewSchema.index({ projectId: 1, platform: 1, createdAt: -1 });

export const PageView = mongoose.model<IPageView>('PageView', PageViewSchema);
