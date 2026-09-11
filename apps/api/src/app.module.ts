import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module.js';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { OrgModule } from './org/org.module.js';
import { MasterDataModule } from './master-data/master-data.module.js';
import { SharedModule } from './shared/shared.module.js';
import { TicketsModule } from './tickets/tickets.module.js';
import { ProjectsModule } from './projects/projects.module.js';
import { MeetingsModule } from './meetings/meetings.module.js';
import { TrainingModule } from './training/training.module.js';
import { ProcurementModule } from './procurement/procurement.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    OrgModule,
    MasterDataModule,
    SharedModule,
    TicketsModule,
    ProjectsModule,
    MeetingsModule,
    TrainingModule,
    ProcurementModule,
    HealthModule,
  ],
})
export class AppModule {}
