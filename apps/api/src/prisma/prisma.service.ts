import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  onModuleInit(): void {
    // Connect in the background so a slow/unreachable database never blocks
    // API startup. Queries still work once the connection is established.
    this.$connect()
      .then(() => this.logger.log('Database connected'))
      .catch((err: unknown) =>
        this.logger.error(
          'Database connection failed — check DATABASE_URL in apps/api/.env',
          err as Error,
        ),
      );
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
