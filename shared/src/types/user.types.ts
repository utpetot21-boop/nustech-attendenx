import type { Role } from '../constants/roles';
import type { ScheduleType } from '../constants/status';

export interface IUser {
  id: string;
  employee_id: string;
  name: string;
  email: string;
  phone: string;
  role_id: string;
  role?: IRole;
  department_id: string;
  department?: IDepartment;
  location_id: string;
  location?: ILocation;
  schedule_type: ScheduleType;
  is_senior: boolean;
  avatar_url?: string;
  is_active: boolean;
  must_change_password: boolean;
  last_login_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface IRole {
  id: string;
  name: Role;
  permissions: string[];
  can_delegate: boolean;
  can_approve: boolean;
  created_at: Date;
}

export interface IDepartment {
  id: string;
  name: string;
  code?: string;
  manager_id?: string;
  created_at: Date;
}

export interface ILocation {
  id: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  radius_meter: number;
  is_active: boolean;
}

export interface IUserDevice {
  id: string;
  user_id: string;
  fcm_token: string;
  device_name?: string;
  platform: 'android' | 'ios';
  app_version?: string;
  is_active: boolean;
  last_active_at: Date;
  created_at: Date;
}

export interface IClient {
  id: string;
  name: string;
  pic_name?: string;
  pic_phone?: string;
  pic_email?: string;
  address?: string;
  lat?: number;
  lng?: number;
  radius_meter: number;
  is_active: boolean;
  created_at: Date;
}
