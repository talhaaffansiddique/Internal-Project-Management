import { Module } from '@nestjs/common';
import {
  DepartmentsController,
  TeamsController,
  RolesReadController,
  DesignationsReadController,
} from './org.controller.js';
import { DepartmentsService } from './departments.service.js';
import { TeamsService } from './teams.service.js';

@Module({
  controllers: [
    DepartmentsController,
    TeamsController,
    RolesReadController,
    DesignationsReadController,
  ],
  providers: [DepartmentsService, TeamsService],
  exports: [DepartmentsService, TeamsService],
})
export class OrgModule {}
