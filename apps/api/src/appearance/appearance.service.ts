import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SKINS, type Skin } from './appearance.dto.js';

const SETTING_KEY = 'appearance.skin';
const DEFAULT_SKIN: Skin = 'default';

@Injectable()
export class AppearanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getSkin(): Promise<Skin> {
    const row = await this.prisma.systemSetting.findUnique({
      where: { key: SETTING_KEY },
    });
    const value = row?.value;
    return (SKINS as readonly string[]).includes(value ?? '')
      ? (value as Skin)
      : DEFAULT_SKIN;
  }

  async setSkin(skin: Skin, actorId: string): Promise<Skin> {
    await this.prisma.systemSetting.upsert({
      where: { key: SETTING_KEY },
      create: { key: SETTING_KEY, value: skin },
      update: { value: skin },
    });
    // Lightweight trail — who changed the company-wide look and when.
    // eslint-disable-next-line no-console
    console.log(`[Appearance] ${actorId} set the company theme to "${skin}"`);
    return skin;
  }
}
