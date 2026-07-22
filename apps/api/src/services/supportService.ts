import { Types } from 'mongoose';
import { Project } from '../models/Project';
import { ServiceTicket } from '../models/ServiceTicket';
import { Notification } from '../models/Notification';
import { nextTicketNumber } from '../utils/crypto';
import { uploadDataUrlFile } from './storageService';

export type SupportCategory =
  | 'feature_request'
  | 'bug'
  | 'performance'
  | 'security'
  | 'question'
  | 'other';

export interface SupportAttachmentInput {
  filename: string;
  dataUrl: string;
  contentType?: string;
}

export interface SupportTicketInput {
  title: string;
  description: string;
  category?: SupportCategory;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  reporterName?: string;
  reporterEmail?: string;
  pageUrl?: string;
  platform?: Record<string, unknown>;
  attachments?: SupportAttachmentInput[];
  tags?: string[];
}

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024; // 4MB each

async function processAttachments(
  projectId: string,
  attachments: SupportAttachmentInput[] | undefined,
  uploadedBy?: string
) {
  if (!attachments?.length) return [];
  const slice = attachments.slice(0, MAX_ATTACHMENTS);
  const results = [];
  const errors: string[] = [];

  for (const file of slice) {
    let dataUrl = file.dataUrl || '';
    // Normalize charset / base64 variants from browsers
    if (dataUrl.startsWith('data:') && !/;base64,/.test(dataUrl) && dataUrl.includes(',')) {
      const [meta, payload] = dataUrl.split(',', 2);
      dataUrl = `${meta};base64,${Buffer.from(decodeURIComponent(payload), 'utf8').toString('base64')}`;
    }

    const match = dataUrl.match(/^data:([^;,]+)?(?:;charset=[^;,]+)?(?:;base64)?,(.+)$/i);
    if (!match) {
      errors.push(`${file.filename || 'file'}: invalid data URL`);
      continue;
    }

    const contentType = (match[1] || file.contentType || 'application/octet-stream').trim();
    const isBase64 = /;base64/i.test(dataUrl);
    const buffer = isBase64
      ? Buffer.from(match[2], 'base64')
      : Buffer.from(decodeURIComponent(match[2]), 'utf8');

    if (!buffer.length) {
      errors.push(`${file.filename || 'file'}: empty file`);
      continue;
    }
    if (buffer.length > MAX_ATTACHMENT_BYTES) {
      const err = new Error(`Attachment ${file.filename} exceeds 4MB limit`) as Error & {
        status: number;
        code: string;
      };
      err.status = 400;
      err.code = 'ATTACHMENT_TOO_LARGE';
      throw err;
    }

    const normalizedDataUrl = `data:${contentType};base64,${buffer.toString('base64')}`;
    const uploaded = await uploadDataUrlFile({
      projectId,
      filename: file.filename || 'attachment',
      dataUrl: normalizedDataUrl,
      folder: 'ticket-attachments',
    });

    results.push({
      _id: new Types.ObjectId(),
      filename: uploaded.filename,
      url: uploaded.url,
      key: uploaded.key,
      contentType: uploaded.contentType || contentType,
      size: uploaded.size,
      storage: uploaded.storage,
      uploadedAt: new Date(),
      uploadedBy: uploadedBy ? new Types.ObjectId(uploadedBy) : undefined,
      data: uploaded.data,
    });
  }

  if (!results.length && attachments.length) {
    const err = new Error(
      errors[0] || 'Failed to process attachments. Please try again with images, PDF, or text files under 4MB.'
    ) as Error & { status: number; code: string };
    err.status = 400;
    err.code = 'ATTACHMENT_INVALID';
    throw err;
  }

  return results;
}

export async function createSupportTicket(projectId: string, input: SupportTicketInput) {
  const project = await Project.findById(projectId);
  if (!project) {
    const err = new Error('Project not found') as Error & { status: number; code: string };
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  project.ticketCounter = (project.ticketCounter || 0) + 1;
  await project.save();

  const categoryMap: Record<string, 'bug' | 'feature_request' | 'performance' | 'security' | 'other'> = {
    feature_request: 'feature_request',
    bug: 'bug',
    performance: 'performance',
    security: 'security',
    question: 'other',
    other: 'other',
  };

  const attachments = await processAttachments(projectId, input.attachments);

  const ticket = await ServiceTicket.create({
    projectId,
    ticketNumber: nextTicketNumber(project.ticketCounter - 1),
    title: input.title,
    description: input.description,
    status: 'open',
    priority: input.priority || 'medium',
    severity: input.priority === 'critical' ? 'critical' : input.priority || 'medium',
    category: categoryMap[input.category || 'other'] || 'other',
    type: input.category === 'feature_request' ? 'improvement' : 'task',
    createdBy: project.ownerId,
    reporter: project.ownerId,
    assignedTo: project.settings.ticketAssigneeId || project.ownerId,
    reporterName: input.reporterName,
    reporterEmail: input.reporterEmail?.toLowerCase(),
    tags: [...(input.tags || []), 'customer-support', input.category || 'other'],
    attachments,
    customFields: {
      source: 'sdk-support-page',
      pageUrl: input.pageUrl,
      platform: input.platform,
    },
    activityLog: [
      {
        action: 'created_via_support',
        performedBy: project.ownerId,
        timestamp: new Date(),
      },
    ],
  });

  const notifyUserIds = new Set<string>([project.ownerId.toString()]);
  for (const m of project.members) {
    if (m.role === 'owner' || m.role === 'manager') {
      notifyUserIds.add(m.userId.toString());
    }
  }

  await Promise.all(
    Array.from(notifyUserIds).map((userId) =>
      Notification.create({
        userId: new Types.ObjectId(userId),
        projectId: project._id,
        type: 'support.ticket_created',
        title: `New support request: ${input.title}`,
        message: `${input.reporterName || input.reporterEmail || 'A user'} submitted a ${input.category || 'support'} ticket (${ticket.ticketNumber}).`,
        link: `/tickets/${ticket._id}?projectId=${projectId}`,
        metadata: {
          ticketId: ticket._id.toString(),
          ticketNumber: ticket.ticketNumber,
          category: input.category,
          attachmentCount: attachments.length,
        },
      })
    )
  );

  return {
    ticketId: ticket._id.toString(),
    ticketNumber: ticket.ticketNumber,
    status: ticket.status,
    attachmentCount: attachments.length,
    message: 'Support request submitted successfully',
  };
}

export async function listSupportTickets(
  projectId: string,
  filters: { email?: string; status?: string }
): Promise<
  Array<{
    _id: unknown;
    ticketNumber: string;
    title: string;
    description?: string;
    status: string;
    priority: string;
    category?: string;
    reporterName?: string;
    reporterEmail?: string;
    createdAt: Date;
    updatedAt?: Date;
    tags?: string[];
    attachments: Array<{
      filename?: string;
      url?: string;
      contentType?: string;
      size?: number;
    }>;
  }>
> {
  const query: Record<string, unknown> = {
    projectId,
    tags: 'customer-support',
  };
  if (filters.email) query.reporterEmail = filters.email.toLowerCase();
  if (filters.status) query.status = filters.status;

  const tickets = await ServiceTicket.find(query)
    .sort({ createdAt: -1 })
    .limit(50)
    .select(
      'ticketNumber title description status priority category reporterName reporterEmail attachments createdAt updatedAt tags'
    )
    .lean();

  return tickets.map((t) => ({
    ...t,
    attachments: (t.attachments || []).map((a) => ({
      filename: a.filename,
      url: a.url || a.data,
      contentType: a.contentType,
      size: a.size,
    })),
  }));
}

export async function getSupportTicket(
  projectId: string,
  ticketId: string,
  email?: string
): Promise<Record<string, unknown>> {
  const query: Record<string, unknown> = { _id: ticketId, projectId };
  if (email) query.reporterEmail = email.toLowerCase();

  const ticket = await ServiceTicket.findOne(query).lean();
  if (!ticket) {
    const err = new Error('Ticket not found') as Error & { status: number; code: string };
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  return {
    ...ticket,
    attachments: (ticket.attachments || []).map((a) => ({
      _id: a._id,
      filename: a.filename,
      url: a.url || a.data,
      contentType: a.contentType,
      size: a.size,
      uploadedAt: a.uploadedAt,
    })),
  };
}

export async function addSupportComment(
  projectId: string,
  ticketId: string,
  input: { content: string; authorName?: string; email?: string }
) {
  const ticket = await ServiceTicket.findOne({ _id: ticketId, projectId });
  if (!ticket) {
    const err = new Error('Ticket not found') as Error & { status: number; code: string };
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (input.email && ticket.reporterEmail && ticket.reporterEmail !== input.email.toLowerCase()) {
    const err = new Error('Not allowed to comment on this ticket') as Error & {
      status: number;
      code: string;
    };
    err.status = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  ticket.comments.push({
    _id: new Types.ObjectId(),
    authorName: input.authorName || ticket.reporterName || 'Customer',
    content: input.content,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  ticket.activityLog.push({
    action: 'customer_comment',
    timestamp: new Date(),
  });
  await ticket.save();
  return ticket.comments[ticket.comments.length - 1];
}
