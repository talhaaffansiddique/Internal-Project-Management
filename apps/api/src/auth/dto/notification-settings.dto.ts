import { IsBoolean, IsOptional, Matches } from 'class-validator';

export class UpdateNotificationSettingsDto {
  @IsOptional()
  @Matches(/^\+[1-9]\d{6,14}$/, {
    message: 'Phone number must be in international format, e.g. +923001234567',
  })
  phoneNumber?: string | null;

  @IsOptional()
  @IsBoolean()
  whatsappOptIn?: boolean;
}
