import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(private readonly config: ConfigService) {
    const accountId = config.get<string>('R2_ACCOUNT_ID') ?? '';
    const accessKeyId = config.get<string>('R2_ACCESS_KEY_ID') ?? '';
    const secretAccessKey = config.get<string>('R2_SECRET_ACCESS_KEY') ?? '';
    this.bucket = config.get<string>('R2_BUCKET') ?? config.get<string>('R2_BUCKET_NAME') ?? 'attendenx-storage';
    this.publicUrl = (config.get<string>('R2_PUBLIC_URL') ?? 'http://localhost/storage').replace(/\/$/, '');

    this.s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  /**
   * Upload buffer to R2.
   * @param folder  e.g. 'visits/photos/original'
   * @param ext     file extension without dot, e.g. 'jpg'
   * @param buffer  file buffer
   * @param mimeType e.g. 'image/jpeg'
   * @returns public URL
   */
  async upload(
    folder: string,
    ext: string,
    buffer: Buffer,
    mimeType = 'image/jpeg',
  ): Promise<string> {
    const key = `${folder}/${randomUUID()}.${ext}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    return `${this.publicUrl}/${key}`;
  }

  async delete(url: string): Promise<void> {
    try {
      const key = url.replace(`${this.publicUrl}/`, '');
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (err) {
      this.logger.warn(`Failed to delete object: ${url}`, err);
    }
  }
}
