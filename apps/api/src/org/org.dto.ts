import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateDepartmentDto {
  @IsString() @MinLength(2) name!: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateDepartmentDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class CreateTeamDto {
  @IsString() @MinLength(2) name!: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsString() description?: string;
}

export class UpdateTeamDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class AddTeamMemberDto {
  @IsUUID() userId!: string;
}

export class CreateDesignationDto {
  @IsString() @MinLength(2) name!: string;
}

export class UpdateDesignationDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class CreateBranchDto {
  @IsString() @MinLength(2) name!: string;
  @IsOptional() @IsString() address?: string;
}

export class UpdateBranchDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
