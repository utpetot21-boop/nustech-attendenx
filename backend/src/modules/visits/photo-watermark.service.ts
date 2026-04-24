import { Injectable, Logger } from '@nestjs/common';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import sharp from 'sharp';

export interface WatermarkInput {
  imageBuffer: Buffer;
  takenAt: Date;    // will be formatted as WITA
  lat: number;
  lng: number;
  district: string;
  province: string;
  locationName: string; // client name or location label
  source?: 'camera' | 'gallery' | 'admin'; // affects watermark content
}

export interface WatermarkResult {
  originalBuffer: Buffer;
  watermarkedBuffer: Buffer;
  thumbnailBuffer: Buffer;
  fileSizeKb: number;
}

@Injectable()
export class PhotoWatermarkService {
  private readonly logger = new Logger(PhotoWatermarkService.name);

  async process(input: WatermarkInput): Promise<WatermarkResult> {
    // Normalize to JPEG, max 2400px wide
    const originalBuffer = await sharp(input.imageBuffer)
      .rotate() // auto-orient EXIF
      .resize({ width: 2400, withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer();

    const watermarkedBuffer = await this.burnWatermark(originalBuffer, input);

    const thumbnailBuffer = await sharp(watermarkedBuffer)
      .resize({ width: 400 })
      .jpeg({ quality: 75 })
      .toBuffer();

    return {
      originalBuffer,
      watermarkedBuffer,
      thumbnailBuffer,
      fileSizeKb: Math.ceil(watermarkedBuffer.length / 1024),
    };
  }

  private async burnWatermark(
    imageBuffer: Buffer,
    input: WatermarkInput,
  ): Promise<Buffer> {
    const img = await loadImage(imageBuffer);
    const { width, height } = img;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);

    // ── Watermark layout ────────────────────────────────────────────────────
    const fontSize = Math.max(Math.round(width * 0.022), 18);
    ctx.font = `${fontSize}px 'DejaVu Sans', sans-serif`;

    const isGallery = input.source === 'gallery';
    const isAdmin   = input.source === 'admin';
    const witaDate  = this.toWITA(input.takenAt);
    const lines = [
      isGallery || isAdmin
        ? `📅 Upload: ${witaDate}`
        : `📅 ${witaDate}`,
      isGallery
        ? '📷 DARI GALERI — GPS tidak tersedia'
        : isAdmin
        ? '👤 Diupload oleh Admin'
        : `📍 ${input.lat.toFixed(6)}, ${input.lng.toFixed(6)}`,
      `🏘 ${input.district || '-'}`,
      `🗺 ${input.province || '-'}`,
      `📌 ${input.locationName}`,
    ];

    const lineH = fontSize * 1.5;
    const padding = fontSize * 0.8;
    const boxW = width * 0.45;
    const boxH = lines.length * lineH + padding * 2;
    const boxX = padding;
    const boxY = height - boxH - padding;

    // Semi-transparent background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    this.roundRect(ctx, boxX, boxY, boxW, boxH, fontSize * 0.5);

    // Text
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 3;
    lines.forEach((line, i) => {
      ctx.fillText(
        line,
        boxX + padding,
        boxY + padding + (i + 0.85) * lineH,
        boxW - padding * 2,
      );
    });

    return canvas.toBuffer('image/jpeg', 88);
  }

  private toWITA(date: Date): string {
    return date.toLocaleString('id-ID', {
      timeZone: 'Asia/Makassar',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }) + ' WITA';
  }

  private roundRect(
    ctx: any,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
  }
}
