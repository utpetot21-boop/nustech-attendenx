import type { LeaveLogType, LeaveStatus, LeaveType } from '../constants/status';

export interface ILeaveBalance {
  id: string;
  user_id: string;
  year: number;
  balance_days: number;
  accrued_monthly: number;
  accrued_holiday: number;
  used_days: number;
  expired_days: number;
  last_accrual_month?: number;
  last_accrual_date?: string;
  updated_at: Date;
}

export interface ILeaveRequest {
  id: string;
  user_id: string;
  type: LeaveType;
  start_date: string;
  end_date: string;
  total_days: number;
  reason?: string;
  attachment_url?: string;
  status: LeaveStatus;
  approved_by?: string;
  approved_at?: Date;
  reject_reason?: string;
  created_at: Date;
}

export interface ILeaveBalanceLog {
  id: string;
  user_id: string;
  type: LeaveLogType;
  amount: number;
  balance_after: number;
  reference_id?: string;
  notes?: string;
  created_at: Date;
}

export interface ICompanyLeaveConfig {
  id: string;
  max_leave_days_per_year: number;
  monthly_accrual_amount: number;
  holiday_work_credit: number;
  alfa_deduction_amount: number;
  objection_window_hours: number;
  expiry_reminder_days: number[];
  effective_date: string;
  updated_by?: string;
  updated_at: Date;
}

export interface IPendingDeduction {
  id: string;
  user_id: string;
  attendance_id: string;
  deduction_amount: number;
  reason: string;
  objection_deadline: Date;
  processed_at?: Date;
  cancelled_at?: Date;
  created_at: Date;
}

export interface ILeaveObjection {
  id: string;
  pending_deduction_id: string;
  user_id: string;
  reason: string;
  attachment_url?: string;
  status: LeaveStatus;
  reviewed_by?: string;
  reviewed_at?: Date;
  created_at: Date;
}
