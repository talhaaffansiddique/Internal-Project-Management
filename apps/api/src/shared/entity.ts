import { BadRequestException } from '@nestjs/common';
import { EntityType } from '@prisma/client';

const URL_TO_ENTITY: Record<string, EntityType> = {
  ticket: EntityType.TICKET,
  tickets: EntityType.TICKET,
  project: EntityType.PROJECT,
  projects: EntityType.PROJECT,
  task: EntityType.TASK,
  tasks: EntityType.TASK,
  meeting: EntityType.MEETING,
  meetings: EntityType.MEETING,
  training: EntityType.TRAINING,
  trainings: EntityType.TRAINING,
  procurement: EntityType.PROCUREMENT_REQUEST,
  'procurement-request': EntityType.PROCUREMENT_REQUEST,
  'procurement-requests': EntityType.PROCUREMENT_REQUEST,
};

/** Maps a URL segment (e.g. "tickets") to the EntityType enum. */
export function parseEntityType(segment: string): EntityType {
  const type = URL_TO_ENTITY[segment?.toLowerCase()];
  if (!type) {
    throw new BadRequestException(`Unknown entity type: ${segment}`);
  }
  return type;
}
