import { Body, Controller, Get, Patch } from '@nestjs/common';
import { Public } from '../auth/public.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { AppearanceService } from './appearance.service.js';
import { SetSkinDto } from './appearance.dto.js';

/**
 * Company-wide visual theme ("skin"). Readable by anyone, including the
 * signed-out login page; changeable only by a Super Admin (brief-adjacent —
 * this is a look-and-feel setting, not a data-access control).
 */
@Controller('appearance')
export class AppearanceController {
  constructor(private readonly appearance: AppearanceService) {}

  @Public()
  @Get()
  async get() {
    return { skin: await this.appearance.getSkin() };
  }

  @Patch()
  @Roles('SUPER_ADMIN')
  async set(@Body() dto: SetSkinDto, @CurrentUser('id') userId: string) {
    return { skin: await this.appearance.setSkin(dto.skin, userId) };
  }
}
