import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum ClientSignatureType {
  DIGITAL = 'digital',
  PHOTO_UPLOAD = 'photo_upload',
}

export class SignClientDto {
  @IsString()
  @MaxLength(120)
  client_pic_name: string;

  @IsEnum(ClientSignatureType)
  signature_type: ClientSignatureType;

  /**
   * Wajib jika signature_type = 'digital'
   * base64 PNG dari signature pad
   */
  @IsOptional()
  @IsString()
  signature_base64?: string;
}
