import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class PostCommentDto {
  @IsString() @MinLength(1) body!: string;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) mentions?: string[];
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) attachmentIds?: string[];
}

export class EditCommentDto {
  @IsString() @MinLength(1) body!: string;
}

export class AddFollowerDto {
  @IsUUID() userId!: string;
}

export class LinkAttachmentDto {
  @IsUUID() attachmentId!: string;
}

export class CreateActivityDto {
  @IsString() @MinLength(1) title!: string;
  @IsUUID() assignedToId!: string;
  @IsDateString() dueAt!: string;
  @IsOptional() @IsString() entityType?: string;
  @IsOptional() @IsUUID() entityId?: string;
}

export class UpdateActivityDto {
  @IsOptional() @IsString() @MinLength(1) title?: string;
  @IsOptional() @IsUUID() assignedToId?: string;
  @IsOptional() @IsDateString() dueAt?: string;
}
