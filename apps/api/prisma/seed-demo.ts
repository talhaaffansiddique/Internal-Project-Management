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
  for (const et of [
    EntityType.TICKET,
    EntityType.PROJECT,
    EntityType.TASK,
    EntityType.MEETING,
  ]) {
    await prisma.notification.deleteMany({ where: { entityType: et } });
    await prisma.auditLog.deleteMany({ where: { entityType: et } });
    await prisma.activity.deleteMany({ where: { entityType: et } });
    await prisma.follower.deleteMany({ where: { entityType: et } });
    await prisma.attachment.deleteMany({ where: { entityType: et } });
    await prisma.commentMention.deleteMany({ where: { comment: { entityType: et } } });
    await prisma.comment.deleteMany({ where: { entityType: et } });
  }
  await prisma.meetingParticipant.deleteMany({});
  await prisma.meeting.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.project.deleteMany({});
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

  // ---------- Projects & tasks ----------
  const PROJECTS: Array<{
    title: string;
    type: string;
    status: string;
    owner: string;
    members: string[];
    start: string;
    target: string;
    tasks: Array<[string, string, string?, string?]>; // [title, status, assignee?, priority?]
  }> = [
    {
      title: 'B2B Sales Development',
      type: 'sales_initiative',
      status: 'in_progress',
      owner: 'lena.m',
      members: ['lena.m', 'yusuf.a', 'sara.k'],
      start: '2026-08-01',
      target: '2026-11-30',
      tasks: [
        ['Build target-customer list', 'done', 'lena.m'],
        ['Prepare sales presentation', 'in_review', 'lena.m', 'high'],
        ['Schedule customer meetings', 'in_progress', 'yusuf.a'],
        ['Send quotations', 'todo', 'lena.m', 'normal'],
        ['Follow up & finalize agreement', 'todo'],
      ],
    },
    {
      title: 'ERP Month-End Stabilisation',
      type: 'operations',
      status: 'in_progress',
      owner: 'admin',
      members: ['admin', 'sara.k', 'omar.d'],
      start: '2026-09-01',
      target: '2026-10-15',
      tasks: [
        ['Document current month-end steps', 'done', 'sara.k'],
        ['Fix GL period rollover config', 'in_progress', 'admin', 'high'],
        ['Add validation for closed periods', 'todo', 'admin'],
        ['Train finance team on new checklist', 'todo', 'sara.k'],
      ],
    },
    {
      title: 'Warehouse Barcode Rollout',
      type: 'it_rollout',
      status: 'at_risk',
      owner: 'omar.d',
      members: ['omar.d', 'admin', 'hassan.r'],
      start: '2026-08-15',
      target: '2026-12-20',
      tasks: [
        ['Choose scanner model', 'done', 'omar.d'],
        ['Pilot on one aisle', 'in_progress', 'hassan.r', 'normal'],
        ['Print & apply shelf labels', 'todo', 'omar.d'],
        ['Roll out to all aisles', 'todo'],
      ],
    },
    {
      title: 'HR Onboarding Revamp',
      type: 'hr',
      status: 'planned',
      owner: 'nadia.f',
      members: ['nadia.f'],
      start: '2026-10-01',
      target: '2026-12-01',
      tasks: [
        ['Draft new onboarding checklist', 'todo', 'nadia.f'],
        ['Collect feedback from recent hires', 'todo', 'nadia.f'],
      ],
    },
  ];

  let projCount = 0;
  let taskCount = 0;
  for (const proj of PROJECTS) {
    const memberIds = [...new Set([...proj.members, proj.owner])];
    const p = await prisma.project.create({
      data: {
        title: proj.title,
        type: proj.type,
        statusKey: proj.status,
        ownerId: userId[proj.owner],
        startDate: new Date(proj.start),
        targetDate: new Date(proj.target),
        members: { create: memberIds.map((m) => ({ userId: userId[m] })) },
      },
    });
    projCount += 1;
    await prisma.auditLog.create({
      data: {
        entityType: EntityType.PROJECT,
        entityId: p.id,
        action: 'CREATED',
        summary: `created project PRJ-${String(p.number).padStart(4, '0')}`,
        actorId: userId[proj.owner],
      },
    });
    for (const [title, status, assignee, priority] of proj.tasks) {
      await prisma.task.create({
        data: {
          projectId: p.id,
          title,
          statusKey: status,
          assigneeId: assignee ? userId[assignee] : null,
          priority: priority ?? null,
          createdById: userId[proj.owner],
        },
      });
      taskCount += 1;
    }
  }

  // ---------- Meetings ----------
  const day = 24 * 60 * 60 * 1000;
  const at = (offsetDays: number, hour: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    d.setHours(hour, 0, 0, 0);
    return d;
  };
  const MEETINGS: Array<{
    title: string;
    agenda: string;
    organizer: string;
    participants: string[];
    start: Date;
    durMin: number;
    location?: string;
    link?: string;
    project?: string;
  }> = [
    {
      title: 'Weekly IT Sync',
      agenda: 'Open tickets, printer issue, O365 migration status.',
      organizer: 'admin',
      participants: ['hassan.r', 'omar.d'],
      start: at(1, 10),
      durMin: 30,
      link: 'https://meet.example.com/it-sync',
    },
    {
      title: 'B2B Sales Review',
      agenda: 'Pipeline, target-customer list, quotation status.',
      organizer: 'lena.m',
      participants: ['yusuf.a', 'sara.k'],
      start: at(2, 14),
      durMin: 60,
      location: 'Conference Room A',
      project: 'B2B Sales Development',
    },
    {
      title: 'Month-End Close Prep',
      agenda: 'GL period fix, checklist walkthrough, owners for each step.',
      organizer: 'admin',
      participants: ['sara.k', 'omar.d'],
      start: at(4, 9),
      durMin: 45,
      link: 'https://meet.example.com/month-end',
      project: 'ERP Month-End Stabilisation',
    },
    {
      title: 'Warehouse Barcode Kickoff',
      agenda: 'Scanner model, pilot aisle, label printing plan.',
      organizer: 'omar.d',
      participants: ['admin', 'hassan.r'],
      start: at(-3, 11),
      durMin: 60,
      location: 'Warehouse floor',
      project: 'Warehouse Barcode Rollout',
    },
  ];

  const projectIdByTitle = new Map(
    (await prisma.project.findMany({ select: { id: true, title: true } })).map(
      (p) => [p.title, p.id],
    ),
  );

  let meetCount = 0;
  for (const m of MEETINGS) {
    const parts = [...new Set(m.participants)].filter((p) => p !== m.organizer);
    const meeting = await prisma.meeting.create({
      data: {
        title: m.title,
        agenda: m.agenda,
        startsAt: m.start,
        endsAt: new Date(m.start.getTime() + m.durMin * 60 * 1000),
        organizerId: userId[m.organizer],
        location: m.location ?? null,
        onlineLink: m.link ?? null,
        projectId: m.project ? projectIdByTitle.get(m.project) ?? null : null,
        participants: {
          create: parts.map((p, i) => ({
            userId: userId[p],
            // give the past meeting some responses + attendance
            response:
              m.start.getTime() < Date.now()
                ? i === 0
                  ? 'ACCEPTED'
                  : 'TENTATIVE'
                : 'PENDING',
            respondedAt: m.start.getTime() < Date.now() ? new Date() : null,
            attended: m.start.getTime() < Date.now() && i === 0,
          })),
        },
      },
    });
    await prisma.auditLog.create({
      data: {
        entityType: EntityType.MEETING,
        entityId: meeting.id,
        action: 'CREATED',
        summary: `scheduled meeting MTG-${String(meeting.number).padStart(4, '0')}`,
        actorId: userId[m.organizer],
      },
    });
    meetCount += 1;
  }
  void day;

  console.log(
    `Demo data ready: ${USERS.length} users, ${TEAMS.length} teams, ${created} tickets, ${projCount} projects, ${taskCount} tasks, ${meetCount} meetings.`,
  );
  console.log(`All demo logins use password: ${PASSWORD}`);
  console.log('e.g.  admin@demo.opshub  /  sara.k@demo.opshub  /  lena.m@demo.opshub');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
