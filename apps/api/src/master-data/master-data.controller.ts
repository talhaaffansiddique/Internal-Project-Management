import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { MasterDataService } from './master-data.service.js';
import { Roles } from '../auth/roles.decorator.js';
import {
  CreateValueDto,
  ReorderDto,
  UpdateValueDto,
} from './master-data.dto.js';

@Controller('master-data')
export class MasterDataController {
  constructor(private readonly svc: MasterDataService) {}

  @Get('types')
  types() {
    return this.svc.listTypes();
  }

  @Get(':typeKey')
  list(
    @Param('typeKey') typeKey: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.svc.listValues(typeKey, includeInactive === 'true');
  }

  @Post(':typeKey')
  @Roles('SUPER_ADMIN')
  create(@Param('typeKey') typeKey: string, @Body() dto: CreateValueDto) {
    return this.svc.createValue(typeKey, dto);
  }

  @Post(':typeKey/reorder')
  @Roles('SUPER_ADMIN')
  reorder(@Param('typeKey') typeKey: string, @Body() dto: ReorderDto) {
    return this.svc.reorder(typeKey, dto.orderedIds);
  }

  @Patch(':typeKey/:id')
  @Roles('SUPER_ADMIN')
  update(
    @Param('typeKey') typeKey: string,
    @Param('id') id: string,
    @Body() dto: UpdateValueDto,
  ) {
    return this.svc.updateValue(typeKey, id, dto);
  }

  @Delete(':typeKey/:id')
  @Roles('SUPER_ADMIN')
  remove(@Param('typeKey') typeKey: string, @Param('id') id: string) {
    return this.svc.deleteValue(typeKey, id);
  }
}
