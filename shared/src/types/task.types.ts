import type { DelegationStatus, TaskPriority, TaskStatus } from '../constants/status';

export interface ITask {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  created_by: string;
  assigned_to?: string;
  client_id?: string;
  location_lat?: number;
  location_lng?: number;
  location_address?: string;
  scheduled_date?: string;
  scheduled_time?: string;
  confirm_deadline?: Date; // deadline konfirmasi karyawan
  started_at?: Date;
  completed_at?: Date;
  cancelled_at?: Date;
  cancel_reason?: string;
  assignments?: ITaskAssignment[];
  delegations?: IDelegation[];
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ITaskAssignment {
  id: string;
  task_id: string;
  user_id: string;
  assigned_by: string;
  assigned_at: Date;
  confirmed_at?: Date;
  rejected_at?: Date;
  reject_reason?: string;
  is_current: boolean;
}

export interface IDelegation {
  id: string;
  task_id: string;
  from_user_id: string;
  to_user_id: string;
  reason?: string;
  status: DelegationStatus;
  approved_by?: string;
  approved_at?: Date;
  rejected_at?: Date;
  created_at: Date;
}

export interface IDispatchPayload {
  task_id: string;
  user_ids: string[];       // bisa broadcast ke beberapa karyawan
  confirm_minutes?: number; // default 15 menit
  message?: string;
}
