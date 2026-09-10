import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { MeetingResponse } from '@prisma/client';

export class ListMeetingsQuery {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsUUID() projectId?: string;
}

export class CreateMeetingDto {
  @IsString() @MinLength(3) title!: string;
  @IsOptional() @IsString() agenda?: string;
  @IsDateString() startsAt!: string;
  @IsDateString() endsAt!: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() onlineLink?: string;
  @IsOptional() @IsUUID() projectId?: string;
  @IsArray() @IsUUID('4', { each: true }) participantIds!: string[];
}

export class UpdateMeetingDto {
  @IsOptional() @IsString() @MinLength(3) title?: string;
  @IsOptional() @IsString() agenda?: string;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() endsAt?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() onlineLink?: string;
  @IsOptional() @IsUUID() projectId?: string;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) participantIds?: string[];
}

export class RsvpDto {
  @IsEnum(MeetingResponse) response!: MeetingResponse;
}

export class AttendanceEntry {
  @IsUUID() userId!: string;
  @IsBoolean() attended!: boolean;
}

export class SetAttendanceDto {
  @IsArray() @ArrayNotEmpty() attendance!: AttendanceEntry[];
}

export class SetMinutesDto {
  @IsString() minutes!: string;
}

export class ActionItemDto {
  @IsString() @MinLength(2) title!: string;
  @IsUUID() assignedToId!: string;
  @IsDateString() dueAt!: string;
}
