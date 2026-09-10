import {
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class ListProjectsQuery {
  @IsOptional() @IsIn(['all', 'mine']) view?: 'all' | 'mine';
  @IsOptional() @IsString() statusKey?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() q?: string;
}

export class CreateProjectDto {
  @IsString() @MinLength(3) title!: string;
  @IsString() type!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsUUID() ownerId?: string;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) memberIds?: string[];
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() targetDate?: string;
}

export class UpdateProjectDto {
  @IsOptional() @IsString() @MinLength(3) title?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsUUID() ownerId?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() targetDate?: string;
}

export class ChangeProjectStatusDto {
  @IsString() statusKey!: string;
}

export class AddProjectMemberDto {
  @IsUUID() userId!: string;
}

export class ListTasksQuery {
  @IsOptional() @IsIn(['all', 'mine']) view?: 'all' | 'mine';
  @IsOptional() @IsString() statusKey?: string;
  @IsOptional() @IsUUID() projectId?: string;
  @IsOptional() @IsUUID() assigneeId?: string;
}

export class CreateTaskDto {
  @IsString() @MinLength(2) title!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsUUID() assigneeId?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsUUID() parentTaskId?: string;
}

export class UpdateTaskDto {
  @IsOptional() @IsString() @MinLength(2) title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsUUID() assigneeId?: string;
  @IsOptional() @IsDateString() dueDate?: string;
}

export class ChangeTaskStatusDto {
  @IsString() statusKey!: string;
}
