import {
  IsEnum,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { TicketVisibility } from '@prisma/client';

export class ListTicketsQuery {
  @IsOptional() @IsIn(['all', 'mine', 'team', 'unassigned', 'following'])
  view?: 'all' | 'mine' | 'team' | 'unassigned' | 'following';
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() statusKey?: string;
  @IsOptional() @IsString() priority?: string;
  @IsOptional() @IsUUID() assigneeId?: string;
  @IsOptional() @IsUUID() teamId?: string;
  @IsOptional() @IsString() q?: string;
}

export class CreateTicketDto {
  @IsString() @MinLength(3) subject!: string;
  @IsString() type!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsObject() fields?: Record<string, unknown>;
  @IsOptional() @IsEnum(TicketVisibility) visibility?: TicketVisibility;
  @IsOptional() @IsUUID() teamId?: string;
  @IsOptional() @IsString() priority?: string;
  @IsOptional() @IsUUID() categoryId?: string;
}

export class UpdateTicketDto {
  @IsOptional() @IsString() @MinLength(3) subject?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsObject() fields?: Record<string, unknown>;
  @IsOptional() @IsEnum(TicketVisibility) visibility?: TicketVisibility;
  @IsOptional() @IsUUID() teamId?: string;
  @IsOptional() @IsString() priority?: string;
  @IsOptional() @IsUUID() categoryId?: string;
}

export class AssignTicketDto {
  @IsOptional() @IsUUID() assigneeId?: string | null;
}

export class ChangeStatusDto {
  @IsString() statusKey!: string;
  @IsOptional() @IsString() comment?: string;
}

export class CloseTicketDto {
  @IsOptional() @IsString() comment?: string;
}

export class ReopenTicketDto {
  @IsString() @MinLength(3, { message: 'A reopen reason is required' })
  reason!: string;
}
