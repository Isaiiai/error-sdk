import { Types } from 'mongoose';
import { ServiceTicket } from '../models/ServiceTicket';
import { Project } from '../models/Project';
import { nextTicketNumber } from '../utils/crypto';

export async function createTicket(
  projectId: string,
  userId: string,
  data: {
    title: string;
    description?: string;
    priority?: string;
    severity?: string;
    category?: string;
    type?: string;
    linkedErrorIds?: string[];
    assignedTo?: string;
    dueDate?: string;
    tags?: string[];
    environment?: string;
  }
) {
  const project = await Project.findById(projectId);
  if (!project) {
    const err = new Error('Project not found') as Error & { status: number; code: string };
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  project.ticketCounter = (project.ticketCounter || 0) + 1;
  await project.save();

  const ticket = await ServiceTicket.create({
    projectId,
    ticketNumber: nextTicketNumber(project.ticketCounter - 1),
    title: data.title,
    description: data.description,
    linkedErrorIds: data.linkedErrorIds || [],
    status: 'open',
    priority: data.priority || 'medium',
    severity: data.severity || 'medium',
    category: data.category || 'bug',
    type: data.type || 'incident',
    createdBy: userId,
    reporter: userId,
    assignedTo: data.assignedTo,
    dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
    tags: data.tags || [],
    environment: data.environment,
    activityLog: [
      {
        action: 'created',
        performedBy: userId,
        timestamp: new Date(),
      },
    ],
  });

  return ticket;
}

export async function listTickets(
  projectId: string,
  filters: { status?: string; priority?: string; assignedTo?: string; search?: string },
  page: number,
  limit: number
) {
  const query: Record<string, unknown> = { projectId };

  if (filters.status) query.status = { $in: filters.status.split(',') };
  if (filters.priority) query.priority = { $in: filters.priority.split(',') };
  if (filters.assignedTo) query.assignedTo = filters.assignedTo;
  if (filters.search) query.title = { $regex: filters.search, $options: 'i' };

  const [tickets, total] = await Promise.all([
    ServiceTicket.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select(
        'ticketNumber title description status priority severity category type assignedTo createdBy reporterName reporterEmail tags attachments.filename attachments.url attachments.contentType attachments.size attachments.storage createdAt updatedAt'
      )
      .populate('assignedTo', 'fullName email')
      .populate('createdBy', 'fullName email')
      .lean(),
    ServiceTicket.countDocuments(query),
  ]);

  return {
    tickets: tickets.map((t) => ({
      ...t,
      attachments: (t.attachments || []).map((a) => ({
        filename: a.filename,
        url: a.url || undefined,
        contentType: a.contentType,
        size: a.size,
        storage: a.storage,
      })),
    })),
    total,
  };
}

export async function getTicket(
  projectId: string,
  ticketId: string
): Promise<Record<string, unknown>> {
  const ticket = await ServiceTicket.findOne({ _id: ticketId, projectId })
    .populate('assignedTo', 'fullName email')
    .populate('createdBy', 'fullName email')
    .populate('comments.authorId', 'fullName email')
    .populate('linkedErrorIds', 'message severity occurrenceCount')
    .lean();
  if (!ticket) {
    const err = new Error('Ticket not found') as Error & { status: number; code: string };
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }
  return {
    ...ticket,
    attachments: (ticket.attachments || []).map((a) => ({
      ...a,
      // Prefer hosted URL; keep inline data only when no URL exists
      url: a.url || a.data,
      data: a.url ? undefined : a.data,
    })),
  };
}

export async function updateTicket(
  projectId: string,
  ticketId: string,
  userId: string,
  updates: Record<string, unknown>
) {
  const ticket = await ServiceTicket.findOne({ _id: ticketId, projectId });
  if (!ticket) {
    const err = new Error('Ticket not found') as Error & { status: number; code: string };
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const trackFields = ['status', 'priority', 'severity', 'assignedTo', 'title'];
  for (const field of trackFields) {
    if (updates[field] !== undefined && String((ticket as unknown as Record<string, unknown>)[field]) !== String(updates[field])) {
      ticket.activityLog.push({
        action: 'updated',
        performedBy: new Types.ObjectId(userId),
        changes: {
          field,
          oldValue: String((ticket as unknown as Record<string, unknown>)[field] ?? ''),
          newValue: String(updates[field]),
        },
        timestamp: new Date(),
      });
    }
  }

  Object.assign(ticket, updates);

  if (updates.status === 'resolved' || updates.status === 'closed') {
    ticket.completedAt = new Date();
  }

  await ticket.save();
  return ticket;
}

export async function addComment(
  projectId: string,
  ticketId: string,
  userId: string,
  content: string
) {
  const ticket = await ServiceTicket.findOne({ _id: ticketId, projectId });
  if (!ticket) {
    const err = new Error('Ticket not found') as Error & { status: number; code: string };
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  ticket.comments.push({
    _id: new Types.ObjectId(),
    authorId: new Types.ObjectId(userId),
    content,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  ticket.activityLog.push({
    action: 'comment_added',
    performedBy: new Types.ObjectId(userId),
    timestamp: new Date(),
  });

  await ticket.save();
  return ticket.comments[ticket.comments.length - 1];
}

export async function addAttachment(
  projectId: string,
  ticketId: string,
  userId: string,
  file: { filename: string; dataUrl: string }
) {
  const ticket = await ServiceTicket.findOne({ _id: ticketId, projectId });
  if (!ticket) {
    const err = new Error('Ticket not found') as Error & { status: number; code: string };
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const { uploadDataUrlFile } = await import('./storageService');
  const uploaded = await uploadDataUrlFile({
    projectId,
    filename: file.filename,
    dataUrl: file.dataUrl,
    folder: 'ticket-attachments',
  });

  const attachment = {
    _id: new Types.ObjectId(),
    filename: uploaded.filename,
    url: uploaded.url,
    key: uploaded.key,
    contentType: uploaded.contentType,
    size: uploaded.size,
    storage: uploaded.storage,
    uploadedAt: new Date(),
    uploadedBy: new Types.ObjectId(userId),
    data: uploaded.data,
  };

  ticket.attachments.push(attachment);
  ticket.activityLog.push({
    action: 'attachment_added',
    performedBy: new Types.ObjectId(userId),
    changes: { field: 'attachments', newValue: uploaded.filename },
    timestamp: new Date(),
  });
  await ticket.save();

  return {
    ...attachment,
    url: attachment.url || attachment.data,
  };
}

