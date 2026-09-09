import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
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
  console.log('Seed complete: system_settings populated.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
