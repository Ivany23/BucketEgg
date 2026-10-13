import { ApiProperty } from '@nestjs/swagger';
import { IsLatitude, IsLongitude } from 'class-validator';

export class LocationDto {
  @ApiProperty({ example: -25.9692 })
  @IsLatitude()
  lat: number;

  @ApiProperty({ example: 32.5732 })
  @IsLongitude()
  lng: number;
}
