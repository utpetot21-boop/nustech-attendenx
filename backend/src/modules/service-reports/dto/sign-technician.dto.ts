import { IsString } from 'class-validator';

/** Body = multipart/form-data: field "signature" (base64 PNG atau file upload ditangani controller) */
export class SignTechnicianDto {
  /** base64 PNG dari signature pad */
  @IsString()
  signature_base64: string;
}
