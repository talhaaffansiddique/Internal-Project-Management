import {
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateValueDto {
  @IsString() @MinLength(1) label!: string;
  @IsOptional() @IsString() key?: string;
  @IsOptional() @IsUUID() parentId?: string;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsObject() meta?: Record<string, unknown>;
}

export class UpdateValueDto {
  @IsOptional() @IsString() @MinLength(1) label?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
  // Accepts a UUID to move, or null to clear the parent.
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsUUID()
  parentId?: string | null;
  @IsOptional() @IsObject() meta?: Record<string, unknown>;
}

export class ReorderDto {
  @IsArray() @IsUUID('4', { each: true }) orderedIds!: string[];
}
