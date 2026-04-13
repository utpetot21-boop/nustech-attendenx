import { apiClient } from './api';

export interface ServiceReport {
  id: string;
  report_number: string | null;
  visit_id: string;
  client_pic_name: string | null;
  tech_signature_url: string | null;
  client_signature_url: string | null;
  client_signature_type: 'digital' | 'photo_upload' | null;
  signed_at: string | null;
  pdf_url: string | null;
  pdf_generated_at: string | null;
  is_locked: boolean;
  sent_to_client: boolean;
  created_at: string;
  technician?: { full_name: string };
  client?: { name: string };
  visit?: {
    check_in_at: string;
    check_out_at: string | null;
    duration_minutes: number | null;
    work_description: string | null;
    findings: string | null;
    recommendations: string | null;
  };
}

// Create draft BA
export async function createServiceReport(
  visitId: string,
  clientPicName?: string,
): Promise<ServiceReport> {
  const res = await apiClient.post(
    `/service-reports?visit_id=${visitId}`,
    { client_pic_name: clientPicName ?? null },
  );
  return res.data;
}

// Tanda tangan teknisi (base64 PNG)
export async function signTechnician(reportId: string, signatureBase64: string): Promise<ServiceReport> {
  const res = await apiClient.post(`/service-reports/${reportId}/sign-technician`, {
    signature_base64: signatureBase64,
  });
  return res.data;
}

// Tanda tangan klien (digital)
export async function signClientDigital(
  reportId: string,
  clientPicName: string,
  signatureBase64: string,
): Promise<ServiceReport> {
  const res = await apiClient.post(`/service-reports/${reportId}/sign-client`, {
    client_pic_name: clientPicName,
    signature_type: 'digital',
    signature_base64: signatureBase64,
  });
  return res.data;
}

// List milik teknisi
export async function getMyServiceReports(month?: string): Promise<ServiceReport[]> {
  const params = month ? `?month=${month}` : '';
  const res = await apiClient.get(`/service-reports/me${params}`);
  return res.data;
}

// Detail
export async function getServiceReport(id: string): Promise<ServiceReport> {
  const res = await apiClient.get(`/service-reports/${id}`);
  return res.data;
}

// Download PDF URL (returns blob URL for sharing)
export function getPdfUrl(id: string): string {
  return `/service-reports/${id}/pdf`;
}
