import type {
  AttendanceStatus,
  CheckinMethod,
  CheckoutMethod,
  ScheduleType,
} from '../constants/status';

export interface IAttendance {
  id: string;
  user_id: string;
  user_schedule_id?: string;
  date: string; // ISO date YYYY-MM-DD
  schedule_type?: ScheduleType;
  shift_start?: string; // HH:mm
  shift_end?: string;   // HH:mm
  tolerance_minutes: number;
  check_in_at?: Date;
  check_in_method?: CheckinMethod;
  check_in_lat?: number;
  check_in_lng?: number;
  check_in_location_id?: string;
  check_out_at?: Date;
  check_out_method?: CheckoutMethod;
  checkout_earliest?: Date; // check_in_at + 8 jam
  status: AttendanceStatus;
  late_minutes: number;
  overtime_minutes: number;
  is_holiday_work: boolean;
  notes?: string;
  created_at: Date;
}

export interface IShiftType {
  id: string;
  name: string;
  start_time: string; // HH:mm
  end_time: string;   // HH:mm
  duration_minutes: number; // HARUS 480
  tolerance_minutes: number;
  color_hex: string;
  department_id?: string;
  is_active: boolean;
  created_by: string;
  created_at: Date;
}

export interface IOfficeHoursConfig {
  id: string;
  user_id?: string;
  department_id?: string;
  start_time: string; // HH:mm
  end_time: string;   // HH:mm
  duration_minutes: number; // HARUS 480
  work_days: string[]; // ['Mon','Tue','Wed','Thu','Fri']
  tolerance_minutes: number;
  effective_date: string; // ISO date
  created_by: string;
  created_at: Date;
}

export interface IUserSchedule {
  id: string;
  user_id: string;
  shift_type_id?: string;
  schedule_type: ScheduleType;
  date: string;
  start_time: string;
  end_time: string;
  tolerance_minutes: number;
  is_holiday: boolean;
  is_day_off: boolean;
  created_at: Date;
}

export interface INationalHoliday {
  id: string;
  date: string;
  name: string;
  year: number;
  is_active: boolean;
  is_collective_leave: boolean;
}

export interface ICheckInPayload {
  method: CheckinMethod;
  lat: number;
  lng: number;
  pin?: string;      // jika method = 'pin'
  qr_code?: string;  // jika method = 'qr'
}

export interface ICheckoutValidation {
  can_checkout: boolean;
  checkout_earliest: Date;
  remaining_seconds: number;
  message?: string;
}
