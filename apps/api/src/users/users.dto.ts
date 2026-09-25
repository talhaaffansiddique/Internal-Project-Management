import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
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

  @IsOptional()
  @Matches(/^\+[1-9]\d{6,14}$/, {
    message: 'Phone number must be in international format, e.g. +923001234567',
  })
  phoneNumber?: string | null;

  @IsOptional() @IsBoolean() whatsappOptIn?: boolean;
}

export class UpdateUserStatusDto {
  @IsEnum(UserStatusDto) status!: UserStatusDto;
}

export class AssignRolesDto {
  @IsArray() @IsString({ each: true }) roleKeys!: string[];
}
