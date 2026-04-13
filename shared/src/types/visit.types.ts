import type { VisitPhotoPhase, VisitStatus } from '../constants/status';

export interface IVisit {
  id: string;
  task_id?: string;
  user_id: string;
  client_id: string;
  client?: {
    id: string;
    name: string;
    address?: string;
    lat?: number;
    lng?: number;
  };
  scheduled_date: string;
  scheduled_time?: string;
  purpose?: string;
  status: VisitStatus;
  check_in_at?: Date;
  check_in_lat?: number;
  check_in_lng?: number;
  check_in_address?: string; // reverse geocoded
  check_out_at?: Date;
  check_out_lat?: number;
  check_out_lng?: number;
  distance_to_client?: number; // meter
  travel_time_minutes?: number;
  photos?: IVisitPhoto[];
  service_report?: IServiceReport;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

export interface IVisitPhoto {
  id: string;
  visit_id: string;
  phase: VisitPhotoPhase;
  original_url: string;
  watermarked_url: string;
  lat: number;
  lng: number;
  address?: string;
  taken_at: Date;
  order_num: number;
}

export interface IServiceReport {
  id: string;
  visit_id: string;
  report_number: string; // BA-YYYY/MM/NNN
  title: string;
  description: string;
  findings?: string;
  actions_taken?: string;
  recommendations?: string;
  technician_signature_url?: string;
  client_signature_url?: string;
  client_name?: string;
  client_title?: string;
  pdf_url?: string;
  signed_at?: Date;
  created_at: Date;
}

export interface IWatermarkData {
  name: string;
  employee_id: string;
  lat: number;
  lng: number;
  address: string;
  timestamp: Date;
  app_name: string; // 'Nustech-AttendenX'
}
