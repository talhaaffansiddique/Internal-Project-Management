import { Module } from '@nestjs/common';
import {
  DepartmentsController,
  TeamsController,
  RolesReadController,
  DesignationsController,
  BranchesController,
} from './org.controller.js';
import { DepartmentsService } from './departments.service.js';
import { TeamsService } from './teams.service.js';
import {
  DesignationsService,
  BranchesService,
} from './simple-masters.service.js';

@Module({
  controllers: [
    DepartmentsController,
    TeamsController,
    RolesReadController,
    DesignationsController,
    BranchesController,
  ],
  providers: [
    DepartmentsService,
    TeamsService,
    DesignationsService,
    BranchesService,
  ],
  exports: [DepartmentsService, TeamsService],
})
export class OrgModule {}
