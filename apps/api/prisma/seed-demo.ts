/**
 * Demo dataset for manual testing. NOT for production.
 *
 *   npm run db:seed:demo
 *
 * Resets: deletes every ticket (+ its comments / followers / attachments /
 * activities / audit / notifications) and every "@demo.opshub" user, then
 * recreates a realistic set. The core seed (roles, departments, master data,
 * the Super Admin) is left untouched.
 *
 * Demo logins — all use password:  Demo!2345
 *   admin@demo.opshub          Admin              · IT
 *   sara.k@demo.opshub         Team Member        · Finance
 *   omar.d@demo.opshub         Supervisor         · Warehouse
 *   nadia.f@demo.opshub        Supervisor         · HR
 *   lena.m@demo.opshub         Employee           · Sales
 *   yusuf.a@demo.opshub        Director           · Management
 *   priya.n@demo.opshub        Purchasing/Finance · Purchase
 *   hassan.r@demo.opshub       Employee           · R&D
 */
import { PrismaClient, EntityType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const PASSWORD = 'Demo!2345';

interface DemoUser {
  local: string;
  fullName: string;
  dept: string;
  roles: string[];
}

const USERS: DemoUser[] = [
  { local: 'admin', fullName: 'Aisha Admin', dept: 'IT', roles: ['ADMIN'] },
  { local: 'sara.k', fullName: 'Sara Khan', dept: 'Finance', roles: ['TEAM_MEMBER', 'EMPLOYEE'] },
  { local: 'omar.d', fullName: 'Omar Dar', dept: 'Warehouse', roles: ['SUPERVISOR'] },
  { local: 'nadia.f', fullName: 'Nadia Farooq', dept: 'HR', roles: ['SUPERVISOR'] },
  { local: 'lena.m', fullName: 'Lena Marom', dept: 'Sales', roles: ['EMPLOYEE'] },
  { local: 'yusuf.a', fullName: 'Yusuf Ali', dept: 'Management', roles: ['DIRECTOR'] },
  { local: 'priya.n', fullName: 'Priya Nair', dept: 'Purchase', roles: ['PURCHASING_FINANCE'] },
  { local: 'hassan.r', fullName: 'Hassan Raza', dept: 'R&D', roles: ['EMPLOYEE'] },
];

const TEAMS: { name: string; dept: string; members: string[] }[] = [
  { name: 'ERP Support', dept: 'IT', members: ['admin', 'sara.k', 'omar.d'] },
  { name: 'IT Desk', dept: 'IT', members: ['admin', 'hassan.r'] },
  { name: 'Sales Floor', dept: 'Sales', members: ['lena.m'] },
];

interface DemoTicket {
  subject: string;
  type: string;
  fields: Record<string, string>;
  visibility: 'PRIVATE' | 'TEAM';
  team?: string;
  priority?: string;
  statusKey: string;
  requester: string;
  assignee?: string;
}

const TICKETS: DemoTicket[] = [
  {
    subject: 'GL posting fails for September invoices',
    type: 'erp_issue',
    fields: { erpModule: 'General Ledger', whatTrying: 'Post September customer invoices', whatWentWrong: 'Batch stops at invoice 41', errorMessage: 'Account 4000-01 is not open for the selected period' },
    visibility: 'TEAM', team: 'ERP Support', priority: 'high', statusKey: 'in_progress',
    requester: 'sara.k', assignee: 'admin',
  },
  {
    subject: 'Cannot log in to ERP after password reset',
    type: 'access_request',
    fields: { system: 'ERP', accessLevel: 'existing account', reason: 'Locked out since this morning' },
    visibility: 'PRIVATE', priority: 'urgent', statusKey: 'waiting_for_user',
    requester: 'lena.m', assignee: 'admin',
  },
  {
    subject: 'New laptop for onboarding — Warehouse',
    type: 'procurement_request',
    fields: { kind: 'Product', item: 'Standard staff laptop', quantity: '1', reason: 'New warehouse hire starts next week' },
    visibility: 'TEAM', team: 'ERP Support', priority: 'normal', statusKey: 'assigned',
    requester: 'omar.d', assignee: 'priya.n',
  },
  {
    subject: 'Request ERP invoicing training for 3 staff',
    type: 'training_request',
    fields: { topic: 'ERP Invoicing Basics', headcount: '3', reason: 'New finance joiners' },
    visibility: 'PRIVATE', statusKey: 'new',
    requester: 'nadia.f',
  },
  {
    subject: 'Printer on 2nd floor not responding',
    type: 'it_issue',
    fields: { device: 'HP LaserJet (2nd floor)', problem: 'Jobs queue but nothing prints', whenStarted: 'Yesterday afternoon' },
    visibility: 'TEAM', team: 'IT Desk', priority: 'normal', statusKey: 'resolved',
    requester: 'hassan.r', assignee: 'admin',
  },
  {
    subject: 'Stock report totals do not match warehouse count',
    type: 'erp_issue',
    fields: { erpModule: 'Inventory', whatTrying: 'Reconcile month-end stock', whatWentWrong: 'System shows 1,204 units, floor count is 1,180', errorMessage: '' },
    visibility: 'TEAM', team: 'ERP Support', priority: 'high', statusKey: 'in_progress',
    requester: 'omar.d', assignee: 'admin',
  },
  {
    subject: 'VPN access for remote finance user',
    type: 'access_request',
    fields: { system: 'Corporate VPN', accessLevel: 'standard remote', reason: 'Working from home two days a week' },
    visibility: 'PRIVATE', priority: 'normal', statusKey: 'assigned',
    requester: 'sara.k', assignee: 'admin',
  },
  {
    subject: 'Add R&D shared drive folder',
    type: 'general_request',
    fields: { details: 'Need a shared folder for the R&D team with access for Hassan and Nadia.' },
    visibility: 'PRIVATE', statusKey: 'new',
    requester: 'hassan.r',
  },
  {
    subject: 'Quarterly forklift maintenance contract',
    type: 'procurement_request',
    fields: { kind: 'Service', item: 'Forklift preventive maintenance, 4 visits/year', quantity: '', reason: 'Current contract expires this month' },
    visibility: 'PRIVATE', priority: 'normal', statusKey: 'assigned',
    requester: 'omar.d', assignee: 'priya.n',
  },
  {
    subject: 'CRM export missing last week of data',
    type: 'erp_issue',
    fields: { erpModule: 'CRM', whatTrying: 'Export pipeline report', whatWentWrong: 'Rows after last Monday are missing', errorMessage: '' },
    visibility: 'TEAM', team: 'Sales Floor', priority: 'normal', statusKey: 'new',
    requester: 'lena.m',
  },
  {
    subject: 'Laptop keyboard keys sticking',
    type: 'it_issue',
    fields: { device: 'Dell Latitude (Sara K.)', problem: 'E and R keys need hard presses', whenStarted: 'Last week' },
    visibility: 'PRIVATE', priority: 'low', statusKey: 'closed',
    requester: 'sara.k', assignee: 'admin',
  },
  {
    subject: 'Training on new procurement approval flow',
    type: 'training_request',
    fields: { topic: 'Procurement approvals', headcount: '6', reason: 'Process changed this quarter' },
    visibility: 'PRIVATE', statusKey: 'new',
    requester: 'priya.n',
  },
  {
    subject: 'Access to management dashboards',
    type: 'access_request',
    fields: { system: 'BI Dashboards', accessLevel: 'view all departments', reason: 'Board reporting' },
    visibility: 'PRIVATE', priority: 'normal', statusKey: 'resolved',
    requester: 'yusuf.a', assignee: 'admin',
  },
  {
    subject: 'Meeting room display keeps disconnecting',
    type: 'it_issue',
    fields: { device: 'Conference room A screen', problem: 'HDMI drops every few minutes', whenStarted: 'Since the office move' },
    visibility: 'TEAM', team: 'IT Desk', priority: 'normal', statusKey: 'assigned',
    requester: 'nadia.f', assignee: 'hassan.r',
  },
];

async function reset() {
  await prisma.notification.deleteMany({ where: { entityType: EntityType.TICKET } });
  await prisma.auditLog.deleteMany({ where: { entityType: EntityType.TICKET } });
  await prisma.activity.deleteMany({ where: { entityType: EntityType.TICKET } });
  await prisma.follower.deleteMany({ where: { entityType: EntityType.TICKET } });
  await prisma.attachment.deleteMany({ where: { entityType: EntityType.TICKET } });
  await prisma.commentMention.deleteMany({ where: { comment: { entityType: EntityType.TICKET } } });
  await prisma.comment.deleteMany({ where: { entityType: EntityType.TICKET } });
  await prisma.ticket.deleteMany({});

  const demoUsers = await prisma.user.findMany({
    where: { email: { endsWith: '@demo.opshub' } },
    select: { id: true },
  });
  const ids = demoUsers.map((u) => u.id);
  if (ids.length) {
    await prisma.notification.deleteMany({ where: { recipientId: { in: ids } } });
    await prisma.activity.deleteMany({ where: { OR: [{ assignedToId: { in: ids } }, { createdById: { in: ids } }] } });
    await prisma.teamMember.deleteMany({ where: { userId: { in: ids } } });
    await prisma.userRole.deleteMany({ where: { userId: { in: ids } } });
    await prisma.comment.deleteMany({ where: { authorId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.team.deleteMany({ where: { name: { in: TEAMS.map((t) => t.name) } } });
}

async function main() {
  await reset();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const depts = await prisma.department.findMany();
  const deptId = (name: string) => depts.find((d) => d.name === name)?.id ?? null;
  const roles = await prisma.role.findMany();
  const roleId = (key: string) => roles.find((r) => r.key === key)!.id;

  const userId: Record<string, string> = {};
  for (const u of USERS) {
    const email = `${u.local}@demo.opshub`;
    const created = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: u.fullName,
        status: 'ACTIVE',
        primaryDepartmentId: deptId(u.dept),
        roles: { create: u.roles.map((k) => ({ roleId: roleId(k) })) },
      },
    });
    userId[u.local] = created.id;
  }

  const teamId: Record<string, string> = {};
  for (const t of TEAMS) {
    const team = await prisma.team.create({
      data: {
        name: t.name,
        departmentId: deptId(t.dept),
        members: { create: t.members.map((m) => ({ userId: userId[m] })) },
      },
    });
    teamId[t.name] = team.id;
  }

  let created = 0;
  for (const t of TICKETS) {
    const ticket = await prisma.ticket.create({
      data: {
        subject: t.subject,
        type: t.type,
        fields: t.fields,
        visibility: t.visibility,
        teamId: t.team ? teamId[t.team] : null,
        priority: t.priority ?? null,
        statusKey: t.statusKey,
        requesterId: userId[t.requester],
        assigneeId: t.assignee ? userId[t.assignee] : null,
        closedById: t.statusKey === 'closed' ? userId[t.assignee ?? t.requester] : null,
        closedAt: t.statusKey === 'closed' ? new Date() : null,
      },
    });
    created += 1;

    // requester + assignee follow
    const followerIds = new Set<string>([userId[t.requester]]);
    if (t.assignee) followerIds.add(userId[t.assignee]);
    for (const uid of followerIds) {
      await prisma.follower.create({
        data: { entityType: EntityType.TICKET, entityId: ticket.id, userId: uid },
      });
    }

    await prisma.auditLog.create({
      data: {
        entityType: EntityType.TICKET,
        entityId: ticket.id,
        action: 'CREATED',
        summary: `raised ticket TKT-${String(ticket.number).padStart(4, '0')}`,
        actorId: userId[t.requester],
      },
    });
    if (t.assignee) {
      await prisma.auditLog.create({
        data: {
          entityType: EntityType.TICKET,
          entityId: ticket.id,
          action: 'ASSIGNMENT_CHANGED',
          summary: 'assigned the ticket',
          actorId: userId.admin,
        },
      });
    }
  }

  // a couple of comments + an activity on the first ticket
  const first = await prisma.ticket.findFirst({ orderBy: { number: 'asc' } });
  if (first) {
    await prisma.comment.create({
      data: {
        entityType: EntityType.TICKET,
        entityId: first.id,
        authorId: userId['sara.k'],
        body: 'Finance close is blocked until this is fixed — flagging as high priority.',
      },
    });
    await prisma.comment.create({
      data: {
        entityType: EntityType.TICKET,
        entityId: first.id,
        authorId: userId.admin,
        body: 'Reproduced it. The GL period was not opened after the month rollover. Working on it.',
      },
    });
    await prisma.activity.create({
      data: {
        title: 'Call ERP vendor about GL period config',
        assignedToId: userId.admin,
        createdById: userId.admin,
        dueAt: new Date(Date.now() + 24 * 3600 * 1000),
        entityType: EntityType.TICKET,
        entityId: first.id,
      },
    });
    await prisma.auditLog.create({
      data: {
        entityType: EntityType.TICKET,
        entityId: first.id,
        action: 'COMMENT_ADDED',
        summary: 'added a comment',
        actorId: userId['sara.k'],
      },
    });
  }

  console.log(`Demo data ready: ${USERS.length} users, ${TEAMS.length} teams, ${created} tickets.`);
  console.log(`All demo logins use password: ${PASSWORD}`);
  console.log('e.g.  admin@demo.opshub  /  sara.k@demo.opshub  /  lena.m@demo.opshub');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
