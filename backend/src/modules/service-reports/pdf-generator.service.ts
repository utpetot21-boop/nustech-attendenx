import { Injectable, Logger } from '@nestjs/common';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import puppeteer from 'puppeteer';

export interface ServiceReportData {
  report_number: string;
  created_at_fmt: string;
  printed_at: string;
  technician_name: string;
  client_name: string;
  client_pic_name: string;
  check_in_at_fmt: string;
  check_out_at_fmt: string;
  duration_text: string;
  check_in_address: string;
  check_in_lat: string;
  check_in_lng: string;
  gps_valid: boolean;
  work_description: string;
  findings: string;
  recommendations: string;
  materials_used: Array<{ name: string; qty: number; unit: string; notes?: string }>;
  form_sections: Array<{
    title: string;
    fields: Array<{ label: string; field_type: string; value: string; is_required: boolean }>;
  }>;
  before_photos: Array<{ url: string; caption?: string }>;
  during_photos: Array<{ url: string; caption?: string }>;
  after_photos: Array<{ url: string; caption?: string }>;
  has_requirements?: boolean;
  requirement_photos?: Array<{
    label: string;
    phase: string;
    photos: Array<{ url: string; caption?: string }>;
  }>;
  tech_signature_url: string | null;
  client_signature_url: string | null;
  is_locked: boolean;
  company_name: string;
  company_address: string;
}

@Injectable()
export class PdfGeneratorService {
  private readonly logger = new Logger(PdfGeneratorService.name);
  private template: HandlebarsTemplateDelegate | null = null;

  constructor() {
    this.registerHelpers();
    this.loadTemplate();
  }

  private registerHelpers() {
    Handlebars.registerHelper('inc', (value: number) => value + 1);
  }

  private loadTemplate() {
    try {
      const templatePath = path.join(__dirname, 'templates', 'service-report.hbs');
      const src = fs.readFileSync(templatePath, 'utf-8');
      this.template = Handlebars.compile(src);
    } catch (err) {
      this.logger.error('Failed to load service-report template', err);
    }
  }

  // Fetch URL → base64 data URI. Returns null on failure (image will be missing, not crash).
  private async toDataUri(url: string | null): Promise<string | null> {
    if (!url) return null;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      const ct = res.headers.get('content-type') ?? 'image/jpeg';
      return `data:${ct};base64,${buf.toString('base64')}`;
    } catch {
      this.logger.warn(`Failed to fetch image for PDF: ${url}`);
      return null;
    }
  }

  private buildFooterTemplate(data: ServiceReportData): string {
    return `<div style="width:100%;box-sizing:border-box;padding:0 32px;display:flex;justify-content:space-between;align-items:center;font-size:9px;color:#888;font-family:Arial,sans-serif;">
      <span>${data.report_number}</span>
      <span>Halaman <span class="pageNumber"></span> dari <span class="totalPages"></span></span>
      <span>${data.company_name}</span>
    </div>`;
  }

  async generate(data: ServiceReportData): Promise<Buffer> {
    if (!this.template) this.loadTemplate();

    // Pre-fetch all images as base64 so Puppeteer makes zero external requests
    const allPhotoUrls = [
      ...(data.has_requirements && data.requirement_photos
        ? data.requirement_photos.flatMap((r) => r.photos.map((p) => p.url))
        : [
            ...data.before_photos.map((p) => p.url),
            ...data.during_photos.map((p) => p.url),
            ...data.after_photos.map((p) => p.url),
          ]),
      data.tech_signature_url,
      data.client_signature_url,
    ];

    const dataUris = await Promise.all(allPhotoUrls.map((u) => this.toDataUri(u)));
    const uriMap = new Map<string, string | null>(
      allPhotoUrls.map((u, i) => [u ?? '', dataUris[i]]),
    );

    const embedPhotos = (photos: Array<{ url: string; caption?: string }>) =>
      photos.map((p) => ({ ...p, url: uriMap.get(p.url) ?? p.url }));

    const embeddedData: ServiceReportData = {
      ...data,
      before_photos: embedPhotos(data.before_photos),
      during_photos: embedPhotos(data.during_photos),
      after_photos: embedPhotos(data.after_photos),
      requirement_photos: data.requirement_photos?.map((r) => ({
        ...r,
        photos: embedPhotos(r.photos),
      })),
      tech_signature_url: uriMap.get(data.tech_signature_url ?? '') ?? data.tech_signature_url,
      client_signature_url: uriMap.get(data.client_signature_url ?? '') ?? data.client_signature_url,
    };

    const html = this.template!(embeddedData);

    const browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
      ],
    });

    try {
      const page = await browser.newPage();
      // domcontentloaded cukup — semua gambar sudah di-embed sebagai base64
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: { top: '0', bottom: '14mm', left: '0', right: '0' },
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: this.buildFooterTemplate(data),
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  }
}
