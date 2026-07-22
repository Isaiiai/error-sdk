import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IApiKey {
  _id: Types.ObjectId;
  name: string;
  key: string;
  keyHash: string;
  secretKeyHash: string;
  status: 'active' | 'inactive';
  lastUsed?: Date;
  createdAt: Date;
  expiresAt?: Date;
  permissions: string[];
}

export interface IProjectMember {
  userId: Types.ObjectId;
  role: 'owner' | 'manager' | 'developer';
  joinedAt: Date;
  permissions: string[];
}

export interface IWebhook {
  _id: Types.ObjectId;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  secret: string;
  createdAt: Date;
}

export interface IMaintenance {
  _id: Types.ObjectId;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  status: 'scheduled' | 'ongoing' | 'completed';
  severity: 'critical' | 'high' | 'medium' | 'low';
  affectedComponents: string[];
  suppressErrors: boolean;
  createdBy: Types.ObjectId;
}

export interface IProject extends Document {
  projectName: string;
  projectSlug: string;
  description?: string;
  ownerId: Types.ObjectId;
  members: IProjectMember[];
  apiKeys: IApiKey[];
  environments: {
    development?: Record<string, unknown>;
    staging?: Record<string, unknown>;
    production?: Record<string, unknown>;
  };
  /** Maintenance department / client handover profile */
  maintenanceProfile: {
    clientName?: string;
    clientCompany?: string;
    githubUrl?: string;
    repositoryBranch?: string;
    stagingUrl?: string;
    productionUrl?: string;
    supportEmail?: string;
    supportPhone?: string;
    slaNotes?: string;
    techStack?: string[];
    developerEmails?: string[];
    clientAdmin?: {
      fullName?: string;
      email?: string;
      username?: string;
      /** Encrypted password */
      passwordEnc?: string;
      notes?: string;
    };
  };
  versions: Array<{
    _id?: Types.ObjectId;
    version: string;
    description?: string;
    releaseDate: Date;
    status: 'released' | 'beta' | 'deprecated';
    changelog?: string;
    commitSha?: string;
    commitShortSha?: string;
    commitUrl?: string;
    commitMessage?: string;
    authorName?: string;
    authorEmail?: string;
    branch?: string;
    tagName?: string;
    source?: 'manual' | 'git-commit' | 'git-tag';
  }>;
  settings: {
    enableErrorGrouping: boolean;
    groupingThreshold: number;
    retentionDays: number;
    sampleRate: number;
    errorLevelThreshold: string;
    enableAutoTicketCreation: boolean;
    autoTicketThreshold: number;
    ticketAssigneeId?: Types.ObjectId;
  };
  webhooks: IWebhook[];
  maintenance: IMaintenance[];
  tags: string[];
  status: 'active' | 'archived' | 'disabled';
  ticketCounter: number;
  createdAt: Date;
  updatedAt: Date;
}

const ApiKeySchema = new Schema(
  {
    name: { type: String, required: true },
    key: { type: String, required: true },
    keyHash: { type: String, required: true, index: true },
    secretKeyHash: { type: String, required: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    lastUsed: Date,
    expiresAt: Date,
    permissions: [String],
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const ProjectSchema = new Schema<IProject>(
  {
    projectName: { type: String, required: true, index: true },
    projectSlug: { type: String, required: true, unique: true },
    description: String,
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    members: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        role: { type: String, enum: ['owner', 'manager', 'developer'], default: 'developer' },
        joinedAt: { type: Date, default: Date.now },
        permissions: [String],
      },
    ],
    apiKeys: [ApiKeySchema],
    environments: {
      development: { type: Schema.Types.Mixed },
      staging: { type: Schema.Types.Mixed },
      production: { type: Schema.Types.Mixed },
    },
    maintenanceProfile: {
      clientName: String,
      clientCompany: String,
      githubUrl: String,
      repositoryBranch: { type: String, default: 'main' },
      stagingUrl: String,
      productionUrl: String,
      supportEmail: String,
      supportPhone: String,
      slaNotes: String,
      techStack: [String],
      developerEmails: [String],
      clientAdmin: {
        fullName: String,
        email: String,
        username: String,
        passwordEnc: String,
        notes: String,
      },
    },
    versions: [
      {
        version: String,
        description: String,
        releaseDate: { type: Date, default: Date.now },
        status: { type: String, enum: ['released', 'beta', 'deprecated'], default: 'released' },
        changelog: String,
        commitSha: String,
        commitShortSha: String,
        commitUrl: String,
        commitMessage: String,
        authorName: String,
        authorEmail: String,
        branch: String,
        tagName: String,
        source: {
          type: String,
          enum: ['manual', 'git-commit', 'git-tag'],
          default: 'manual',
        },
      },
    ],
    settings: {
      enableErrorGrouping: { type: Boolean, default: true },
      groupingThreshold: { type: Number, default: 0.8 },
      retentionDays: { type: Number, default: 90 },
      sampleRate: { type: Number, default: 1.0 },
      errorLevelThreshold: {
        type: String,
        enum: ['critical', 'high', 'medium', 'low', 'info'],
        default: 'info',
      },
      enableAutoTicketCreation: { type: Boolean, default: false },
      autoTicketThreshold: { type: Number, default: 10 },
      ticketAssigneeId: { type: Schema.Types.ObjectId, ref: 'User' },
    },
    webhooks: [
      {
        name: String,
        url: String,
        events: [String],
        isActive: { type: Boolean, default: true },
        secret: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    maintenance: [
      {
        title: String,
        description: String,
        startTime: Date,
        endTime: Date,
        status: {
          type: String,
          enum: ['scheduled', 'ongoing', 'completed'],
          default: 'scheduled',
        },
        severity: {
          type: String,
          enum: ['critical', 'high', 'medium', 'low'],
          default: 'medium',
        },
        affectedComponents: [String],
        suppressErrors: { type: Boolean, default: true },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
      },
    ],
    tags: [String],
    status: {
      type: String,
      enum: ['active', 'archived', 'disabled'],
      default: 'active',
    },
    ticketCounter: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Project = mongoose.model<IProject>('Project', ProjectSchema);
