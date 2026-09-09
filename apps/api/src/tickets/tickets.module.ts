import { Module } from '@nestjs/common';
import {
  TicketsController,
  TicketFormsController,
} from './tickets.controller.js';
import { TicketsService } from './tickets.service.js';

@Module({
  controllers: [TicketsController, TicketFormsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
