import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProcurementType } from '@prisma/client';

export class ListProcurementQuery {
  @IsOptional() @IsIn(['all', 'mine']) view?: 'all' | 'mine';
  @IsOptional() @IsString() statusKey?: string;
  @IsOptional() @IsEnum(ProcurementType) type?: ProcurementType;
}

export class ProcurementItemDto {
  @IsEnum(ProcurementType) type!: ProcurementType;
  @IsString() @MinLength(3) description!: string;
  @IsOptional() @IsString() quantity?: string;
}

export class CreateProcurementDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProcurementItemDto)
  items!: ProcurementItemDto[];
  @IsString() @MinLength(3) businessReason!: string;
  @IsOptional() @IsUUID() departmentId?: string;
}

export class UpdateProcurementDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProcurementItemDto)
  items?: ProcurementItemDto[];
  @IsOptional() @IsString() @MinLength(3) businessReason?: string;
}

export class SupervisorDecisionDto {
  @IsIn(['approve_to_purchasing', 'forward_to_director', 'reject'])
  decision!: 'approve_to_purchasing' | 'forward_to_director' | 'reject';
  @IsOptional() @IsString() comment?: string;
}

export class DirectorDecisionDto {
  @IsIn(['approve', 'reject'])
  decision!: 'approve' | 'reject';
  @IsOptional() @IsString() comment?: string;
}

export class PurchaseStatusDto {
  @IsIn(['ORDERED', 'DELIVERED'])
  statusKey!: 'ORDERED' | 'DELIVERED';
}

export class CreateQuotationDto {
  @IsString() @MinLength(1) vendorName!: string;
  @IsNumber() @Min(0) amount!: number;
  @IsOptional() @IsDateString() quotationDate?: string;
  @IsOptional() @IsDateString() validUntil?: string;
  @IsOptional() @IsString() paymentTerms?: string;
  @IsOptional() @IsString() deliveryTime?: string;
  @IsOptional() @IsString() comments?: string;
  @IsOptional() @IsUUID() attachmentId?: string;
}

export class UpdateQuotationDto {
  @IsOptional() @IsString() vendorName?: string;
  @IsOptional() @IsNumber() @Min(0) amount?: number;
  @IsOptional() @IsDateString() quotationDate?: string;
  @IsOptional() @IsDateString() validUntil?: string;
  @IsOptional() @IsString() paymentTerms?: string;
  @IsOptional() @IsString() deliveryTime?: string;
  @IsOptional() @IsString() comments?: string;
}
