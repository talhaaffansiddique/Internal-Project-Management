import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  CurrentUser,
  CurrentUserRoles,
} from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { ProcurementService } from './procurement.service.js';
import {
  CreateProcurementDto,
  CreateQuotationDto,
  DirectorDecisionDto,
  ListProcurementQuery,
  PurchaseStatusDto,
  SupervisorDecisionDto,
  UpdateProcurementDto,
  UpdateQuotationDto,
} from './procurement.dto.js';

@Controller()
export class ProcurementController {
  constructor(private readonly procurement: ProcurementService) {}

  @Get('me/procurement-requests')
  mine(@CurrentUser('id') userId: string) {
    return this.procurement.mine(userId);
  }

  @Get('procurement-requests/stats')
  @Roles()
  stats(
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
  ) {
    return this.procurement.stats(userId, roles);
  }

  @Get('procurement-requests')
  @Roles()
  list(
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
    @Query() query: ListProcurementQuery,
  ) {
    return this.procurement.list(userId, roles, query);
  }

  @Get('procurement-requests/:id')
  @Roles()
  get(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
  ) {
    return this.procurement.get(id, userId, roles);
  }

  @Post('procurement-requests')
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateProcurementDto,
  ) {
    return this.procurement.create(userId, dto);
  }

  @Patch('procurement-requests/:id')
  @Roles()
  update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
    @Body() dto: UpdateProcurementDto,
  ) {
    return this.procurement.update(id, userId, roles, dto);
  }

  @Post('procurement-requests/:id/supervisor-decision')
  @Roles()
  supervisorDecision(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
    @Body() dto: SupervisorDecisionDto,
  ) {
    return this.procurement.supervisorDecision(
      id,
      userId,
      roles,
      dto.decision,
      dto.comment,
    );
  }

  @Post('procurement-requests/:id/director-decision')
  @Roles()
  directorDecision(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
    @Body() dto: DirectorDecisionDto,
  ) {
    return this.procurement.directorDecision(
      id,
      userId,
      roles,
      dto.decision,
      dto.comment,
    );
  }

  @Post('procurement-requests/:id/purchase-status')
  @Roles()
  purchaseStatus(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
    @Body() dto: PurchaseStatusDto,
  ) {
    return this.procurement.purchaseStatus(id, userId, roles, dto.statusKey);
  }

  @Post('procurement-requests/:id/quotations')
  @Roles()
  addQuotation(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
    @Body() dto: CreateQuotationDto,
  ) {
    return this.procurement.addQuotation(id, userId, roles, dto);
  }

  @Patch('procurement-quotations/:id')
  @Roles()
  updateQuotation(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
    @Body() dto: UpdateQuotationDto,
  ) {
    return this.procurement.updateQuotation(id, userId, roles, dto);
  }

  @Post('procurement-quotations/:id/select')
  @Roles()
  selectQuotation(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
  ) {
    return this.procurement.selectQuotation(id, userId, roles);
  }
}
