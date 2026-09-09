import {
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export enum UserStatusDto {
  ACTIVE = 'ACTIVE',
  INVITED = 'INVITED',
  DISABLED = 'DISABLED',
}

export class ListUsersQuery {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsEnum(UserStatusDto) status?: UserStatusDto;
  @IsOptional() @IsString() roleKey?: string;
}

export class CreateUserDto {
  @IsString() @MinLength(2) fullName!: string;
  @IsEmail() email!: string;
  @IsString() @MinLength(8, { message: 'Temporary password must be at least 8 characters' })
  password!: string;

  @IsOptional() @IsUUID() primaryDepartmentId?: string;
  @IsOptional() @IsUUID() designationId?: string;
  @IsOptional() @IsUUID() supervisorId?: string;

  @IsOptional() @IsArray() @IsString({ each: true }) roleKeys?: string[];
}

export class UpdateUserDto {
  @IsOptional() @IsString() @MinLength(2) fullName?: string;
  @IsOptional() @IsUUID() primaryDepartmentId?: string;
  @IsOptional() @IsUUID() designationId?: string;
  @IsOptional() @IsUUID() supervisorId?: string;
}

export class UpdateUserStatusDto {
  @IsEnum(UserStatusDto) status!: UserStatusDto;
}

export class AssignRolesDto {
  @IsArray() @IsString({ each: true }) roleKeys!: string[];
}
