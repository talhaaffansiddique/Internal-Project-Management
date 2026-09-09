import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

const DB_CHECK_TIMEOUT_MS = 3000;

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    let db: 'connected' | 'disconnected' = 'disconnected';
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('db timeout')), DB_CHECK_TIMEOUT_MS),
        ),
      ]);
      db = 'connected';
    } catch {
      db = 'disconnected';
    }
    return {
      status: db === 'connected' ? 'ok' : 'degraded',
      db,
      service: 'opshub-api',
      time: new Date().toISOString(),
    };
  }
}
