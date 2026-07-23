import mongoose from 'mongoose';
import { config } from '../config';
import { User } from '../models/User';
import { Project } from '../models/Project';
import { ErrorEvent } from '../models/ErrorEvent';
import { ErrorGroup } from '../models/ErrorGroup';
import { ServiceTicket } from '../models/ServiceTicket';
import { generateApiKey, hashKey, computeFingerprint } from '../utils/crypto';

async function seed() {
  await mongoose.connect(config.mongodbUri);
  console.log(config.mongodbUri);
  console.log('Connected to MongoDB');

  await Promise.all([
    User.deleteMany({}),
    Project.deleteMany({}),
    ErrorEvent.deleteMany({}),
    ErrorGroup.deleteMany({}),
    ServiceTicket.deleteMany({}),
  ]);

  const admin = await User.create({
    email: 'admin@errortracker.com',
    username: 'admin',
    password: 'AdminPass123!',
    fullName: 'Platform Admin',
    role: 'admin',
    emailVerified: true,
  });

  const pm = await User.create({
    email: 'pm@errortracker.com',
    username: 'productmanager',
    password: 'PmPass1234!',
    fullName: 'Product Manager',
    role: 'product_manager',
    emailVerified: true,
  });

  const dev = await User.create({
    email: 'dev@errortracker.com',
    username: 'developer',
    password: 'DevPass1234!',
    fullName: 'Jane Developer',
    role: 'developer',
    emailVerified: true,
  });

  const publicKey = generateApiKey('pub');
  const secretKey = generateApiKey('sec');

  const project = await Project.create({
    projectName: 'Demo Web App',
    projectSlug: 'demo-web-app',
    description: 'Sample project for end-to-end testing',
    ownerId: admin._id,
    members: [
      { userId: admin._id, role: 'owner', joinedAt: new Date(), permissions: ['*'] },
      { userId: pm._id, role: 'manager', joinedAt: new Date(), permissions: [] },
      { userId: dev._id, role: 'developer', joinedAt: new Date(), permissions: [] },
    ],
    apiKeys: [
      {
        name: 'Default Key',
        key: publicKey.slice(0, 12) + '...',
        keyHash: hashKey(publicKey),
        secretKeyHash: hashKey(secretKey),
        status: 'active',
        permissions: ['errors:write', 'errors:read'],
      },
    ],
    environments: {
      production: {
        apiUrl: 'https://demo.example.com',
        allowedDomains: ['demo.example.com'],
      },
    },
    settings: {
      enableErrorGrouping: true,
      enableAutoTicketCreation: true,
      autoTicketThreshold: 5,
    },
  });

  const samples = [
    {
      message: "TypeError: Cannot read properties of undefined (reading 'foo')",
      errorType: 'TypeError',
      severity: 'high' as const,
      stackTrace: "TypeError: Cannot read properties of undefined\n    at Checkout.render (checkout.js:42:15)",
    },
    {
      message: 'NetworkError: Failed to fetch /api/orders',
      errorType: 'NetworkError',
      severity: 'critical' as const,
      stackTrace: 'NetworkError: Failed to fetch\n    at fetchOrders (api.js:18:5)',
    },
    {
      message: 'ReferenceError: cart is not defined',
      errorType: 'ReferenceError',
      severity: 'medium' as const,
      stackTrace: 'ReferenceError: cart is not defined\n    at addItem (cart.js:10:3)',
    },
  ];

  for (const sample of samples) {
    const fingerprint = computeFingerprint(sample.message, sample.errorType, sample.stackTrace);
    const group = await ErrorGroup.create({
      projectId: project._id,
      name: `${sample.errorType}: ${sample.message.slice(0, 80)}`,
      fingerprints: [fingerprint],
      errorCount: 3,
      affectedUsersCount: 2,
      priority: sample.severity === 'critical' ? 'critical' : sample.severity,
    });

    await ErrorEvent.create({
      projectId: project._id,
      groupId: group._id,
      message: sample.message,
      errorType: sample.errorType,
      severity: sample.severity,
      stackTrace: sample.stackTrace,
      environment: 'production',
      version: '1.0.0',
      url: 'https://demo.example.com/checkout',
      urlPath: '/checkout',
      browser: { name: 'Chrome', version: '120.0.0', userAgent: 'Mozilla/5.0' },
      device: { type: 'desktop', os: 'macOS' },
      fingerprint,
      occurrenceCount: 3,
      affectedUsers: 2,
      uniqueAffectedUsers: ['user1', 'user2'],
      breadcrumbs: [
        {
          timestamp: new Date(),
          category: 'navigation',
          message: 'Navigated to /checkout',
          level: 'info',
        },
      ],
    });
  }

  await ServiceTicket.create({
    projectId: project._id,
    ticketNumber: 'TKT-00001',
    title: 'Checkout page crashes on mobile',
    description: 'Users report crashes when checking out on mobile Safari',
    status: 'open',
    priority: 'high',
    severity: 'critical',
    category: 'bug',
    type: 'incident',
    createdBy: pm._id,
    assignedTo: dev._id,
    tags: ['checkout', 'mobile'],
    environment: 'production',
    activityLog: [{ action: 'created', performedBy: pm._id, timestamp: new Date() }],
  });

  project.ticketCounter = 1;
  await project.save();

  console.log('\n=== Seed complete ===\n');
  console.log('Users:');
  console.log('  admin@errortracker.com / AdminPass123!');
  console.log('  pm@errortracker.com    / PmPass1234!');
  console.log('  dev@errortracker.com   / DevPass1234!');
  console.log('\nSDK credentials (save these — shown once):');
  console.log(`  Project Key: ${publicKey}`);
  console.log(`  Secret Key:  ${secretKey}`);
  console.log(`  Project ID:  ${project._id}`);
  console.log(`  DSN:         http://localhost:5050/api/v1/errors\n`);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
