import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ---------- Roles (brief §3) ----------
const ROLES: Array<[string, string, string, number]> = [
  ['EMPLOYEE', 'Employee', 'Create and follow own authorized tickets/requests, tasks, meetings, training and procurement as permitted.', 10],
  ['TEAM_MEMBER', 'Team Member', 'View team-shared records for teams they belong to, in addition to their own.', 20],
  ['SUPERVISOR', 'Supervisor', 'Review or route requests, supervise team work, approve or forward procurement requests.', 30],
  ['PURCHASING_FINANCE', 'Purchasing / Finance', 'Handle approved procurement requests, quotations, purchasing status and related records.', 40],
  ['DIRECTOR', 'Director', 'Receive requests forwarded for higher approval when needed.', 50],
  ['ADMIN', 'Admin', 'View all operational information; manage day-to-day system records and workflows.', 60],
  ['SUPER_ADMIN', 'Super Admin', 'Control user access, role assignments, permissions, master data and administrative settings.', 70],
];

// ---------- Organization master data ----------
const DEPARTMENTS: Array<[string, string]> = [
  ['Finance', 'FIN'],
  ['HR', 'HR'],
  ['Sales', 'SAL'],
  ['Purchase', 'PUR'],
  ['Warehouse', 'WH'],
  ['Management', 'MGMT'],
  ['IT', 'IT'],
  ['R&D', 'RND'],
];

const DESIGNATIONS = ['Officer', 'Senior Officer', 'Team Lead', 'Manager', 'Head of Department'];
const BRANCHES: Array<[string, string | null]> = [['Head Office', null]];

// ---------- Configurable master-data types + default values ----------
// tuple: [key, label, isSystem?, active?]
type V = [string, string, boolean?, boolean?];
const MASTER_DATA: Record<string, { name: string; hierarchy?: boolean; values: V[] }> = {
  ticket_types: {
    name: 'Ticket Types',
    values: [
      ['erp_issue', 'ERP Issue', true],
      ['it_issue', 'IT / Computer Issue', true],
      ['training_request', 'Training Request', true],
      ['procurement_request', 'Procurement Request', true],
      ['access_request', 'Access / Account Request', true],
      ['general_request', 'General Internal Request / Other', true],
    ],
  },
  ticket_categories: { name: 'Ticket Categories', hierarchy: true, values: [] },
  ticket_tags: { name: 'Ticket Tags', values: [] },
  priorities: {
    name: 'Priorities',
    values: [
      ['low', 'Low'],
      ['normal', 'Normal'],
      ['high', 'High'],
      ['urgent', 'Urgent'],
    ],
  },
  ticket_statuses: {
    name: 'Ticket Statuses',
    values: [
      ['new', 'New', true],
      ['assigned', 'Assigned', true],
      ['in_progress', 'In Progress', true],
      ['waiting_for_user', 'Waiting for User', true],
      ['resolved', 'Resolved', true],
      ['closed', 'Closed', true],
      ['waiting_for_vendor', 'Waiting for Vendor', true, false],
      ['escalated', 'Escalated', true, false],
    ],
  },
  project_types: {
    name: 'Project Types',
    values: [
      ['sales_initiative', 'Sales Initiative'],
      ['operations', 'Operations'],
      ['it_rollout', 'IT Rollout'],
      ['hr', 'HR'],
      ['procurement', 'Procurement'],
    ],
  },
  project_statuses: {
    name: 'Project Statuses',
    values: [
      ['planned', 'Planned'],
      ['in_progress', 'In Progress'],
      ['at_risk', 'At Risk'],
      ['delayed', 'Delayed'],
      ['on_hold', 'On Hold'],
      ['completed', 'Completed'],
    ],
  },
  task_statuses: {
    name: 'Task Statuses',
    values: [
      ['todo', 'To Do'],
      ['in_progress', 'In Progress'],
      ['in_review', 'In Review'],
      ['done', 'Done'],
    ],
  },
  meeting_types: {
    name: 'Meeting Types',
    values: [
      ['internal', 'Internal'],
      ['customer', 'Customer'],
      ['review', 'Review'],
      ['training', 'Training'],
    ],
  },
  item_categories: {
    name: 'Procurement Item Categories',
    values: [
      ['it_equipment', 'IT Equipment'],
      ['office_supplies', 'Office Supplies'],
      ['furniture', 'Furniture'],
    ],
  },
  service_categories: {
    name: 'Procurement Service Categories',
    values: [
      ['maintenance', 'Maintenance'],
      ['consulting', 'Consulting'],
      ['licensing', 'Licensing'],
    ],
  },
  vendors: { name: 'Vendors', values: [] },
  approval_types: {
    name: 'Approval Types',
    values: [
      ['standard', 'Standard'],
      ['director_approval', 'Director Approval'],
    ],
  },
  training_categories: {
    name: 'Training Categories',
    values: [
      ['erp', 'ERP'],
      ['operations', 'Operations'],
      ['compliance', 'Compliance'],
      ['sales', 'Sales'],
      ['it_security', 'IT Security'],
    ],
  },
  training_topics: { name: 'Training Topics', values: [] },
  trainers: { name: 'Trainers', values: [] },
  training_statuses: {
    name: 'Training Statuses',
    values: [
      ['requested', 'Requested', true],
      ['scheduled', 'Scheduled', true],
      ['in_progress', 'Training In Progress', true],
      ['trainer_checklist', 'Trainer Checklist', true],
      ['waiting_ack', 'Waiting for Employee Acknowledgement', true],
      ['completed', 'Completed', true],
    ],
  },
};

async function main() {
  // --- Roles ---
  for (const [key, name, description, rank] of ROLES) {
    await prisma.role.upsert({
      where: { key },
      update: { name, description, rank, isSystem: true },
      create: { key, name, description, rank, isSystem: true },
    });
  }

  // --- Departments ---
  for (const [name, code] of DEPARTMENTS) {
    await prisma.department.upsert({
      where: { name },
      update: { code, active: true },
      create: { name, code, active: true },
    });
  }

  // --- Designations ---
  for (const name of DESIGNATIONS) {
    await prisma.designation.upsert({ where: { name }, update: {}, create: { name } });
  }

  // --- Branches ---
  for (const [name, address] of BRANCHES) {
    await prisma.branch.upsert({ where: { name }, update: {}, create: { name, address } });
  }

  // --- Master data types + values ---
  for (const [typeKey, def] of Object.entries(MASTER_DATA)) {
    const type = await prisma.masterDataType.upsert({
      where: { key: typeKey },
      update: { name: def.name, allowsHierarchy: def.hierarchy ?? false, isSystem: true },
      create: { key: typeKey, name: def.name, allowsHierarchy: def.hierarchy ?? false, isSystem: true },
    });
    let sortOrder = 0;
    for (const [key, label, isSystem = false, active = true] of def.values) {
      await prisma.masterDataValue.upsert({
        where: { typeId_key: { typeId: type.id, key } },
        update: { label, isSystem, active, sortOrder },
        create: { typeId: type.id, key, label, isSystem, active, sortOrder },
      });
      sortOrder += 1;
    }
  }

  // --- Super Admin user ---
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'talhaaffansiddique@gmail.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!123';
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const itDept = await prisma.department.findUnique({ where: { name: 'IT' } });
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { fullName: 'System Administrator', status: 'ACTIVE', primaryDepartmentId: itDept?.id },
    create: {
      email: adminEmail,
      passwordHash,
      fullName: 'System Administrator',
      status: 'ACTIVE',
      primaryDepartmentId: itDept?.id,
    },
  });

  const superAdminRole = await prisma.role.findUnique({ where: { key: 'SUPER_ADMIN' } });
  if (superAdminRole) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: admin.id, roleId: superAdminRole.id } },
      update: {},
      create: { userId: admin.id, roleId: superAdminRole.id },
    });
  }

  // --- System settings ---
  await prisma.systemSetting.upsert({
    where: { key: 'app.name' },
    update: {},
    create: { key: 'app.name', value: 'OpsHub' },
  });
  await prisma.systemSetting.upsert({
    where: { key: 'app.version' },
    update: { value: 'v1.0-dev' },
    create: { key: 'app.version', value: 'v1.0-dev' },
  });

  // --- Summary ---
  const counts = {
    roles: await prisma.role.count(),
    departments: await prisma.department.count(),
    designations: await prisma.designation.count(),
    branches: await prisma.branch.count(),
    masterDataTypes: await prisma.masterDataType.count(),
    masterDataValues: await prisma.masterDataValue.count(),
    users: await prisma.user.count(),
  };
  console.log('Seed complete:', counts);
  console.log(`Super Admin login: ${adminEmail} / ${adminPassword}`);
  if (adminPassword === 'ChangeMe!123') {
    console.log('  (default password — change it after first login)');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
