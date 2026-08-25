import { Type } from 'class-transformer';
import { IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { DeviceInfoDto } from './device-info.dto';

export class VerifyEmailDto {
  @IsString()
  @MinLength(1)
  token!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => DeviceInfoDto)
  deviceInfo?: DeviceInfoDto;
}
