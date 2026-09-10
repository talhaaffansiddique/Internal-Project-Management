import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { TrainingType } from '@prisma/client';

export class ListTrainingQuery {
  @IsOptional() @IsIn(['all', 'mine']) view?: 'all' | 'mine';
  @IsOptional() @IsString() statusKey?: string;
  @IsOptional() @IsString() categoryKey?: string;
  @IsOptional() @IsString() q?: string;
}

export class CreateTrainingDto {
  @IsString() @MinLength(3) topic!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() categoryKey?: string;
  @IsEnum(TrainingType) type!: TrainingType;
  @IsUUID() trainerId!: string;
  @IsOptional() @IsDateString() scheduledAt?: string;
  @IsArray() @IsUUID('4', { each: true }) participantIds!: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) checklist?: string[];
}

export class UpdateTrainingDto {
  @IsOptional() @IsString() @MinLength(3) topic?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() categoryKey?: string;
  @IsOptional() @IsEnum(TrainingType) type?: TrainingType;
  @IsOptional() @IsUUID() trainerId?: string;
  @IsOptional() @IsDateString() scheduledAt?: string;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) participantIds?: string[];
}

export class ChangeTrainingStatusDto {
  @IsString() statusKey!: string;
}

export class ChecklistItemDto {
  @IsString() @MinLength(1) label!: string;
}

export class ToggleChecklistDto {
  @IsBoolean() done!: boolean;
}

export class AddParticipantDto {
  @IsUUID() userId!: string;
}

export class AcknowledgeDto {
  @IsIn(['CONFIRMED', 'NEEDS_FOLLOW_UP']) result!: 'CONFIRMED' | 'NEEDS_FOLLOW_UP';
  @IsOptional() @IsString() comment?: string;
}
