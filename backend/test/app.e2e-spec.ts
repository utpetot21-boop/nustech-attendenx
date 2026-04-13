/**
 * Integration Tests — AttendenX Backend API
 * Menguji full HTTP pipeline: routing, guards, DTOs, dan response shape.
 * Database diganti mock agar test bisa berjalan tanpa infrastruktur.
 *
 * Run: npm run test:e2e --workspace=backend
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';

// ── Modules under test ──────────────────────────────────────────────────────
import { AuthModule } from '../src/modules/auth/auth.module';
import { AttendanceModule } from '../src/modules/attendance/attendance.module';
import { VisitsModule } from '../src/modules/visits/visits.module';

// ── Entities (for getRepositoryToken keys) ─────────────────────────────────
import { UserEntity } from '../src/modules/users/entities/user.entity';
import { RefreshTokenEntity } from '../src/modules/users/entities/refresh-token.entity';
import { UserDeviceEntity } from '../src/modules/users/entities/user-device.entity';
import { AttendanceEntity } from '../src/modules/attendance/entities/attendance.entity';
import { UserScheduleEntity } from '../src/modules/schedule/entities/user-schedule.entity';
import { LocationEntity } from '../src/modules/locations/entities/location.entity';
import { NationalHolidayEntity } from '../src/modules/schedule/entities/national-holiday.entity';
import { VisitEntity } from '../src/modules/visits/entities/visit.entity';
import { VisitPhotoEntity } from '../src/modules/visits/entities/visit-photo.entity';
import { ServiceReportEntity } from '../src/modules/visits/entities/service-report.entity';
import { ClientEntity } from '../src/modules/clients/entities/client.entity';
import { ThrottlerModule } from '@nestjs/throttler';

// ── Test fixtures ───────────────────────────────────────────────────────────
const USER_ID = 'e2e-user-uuid-001';
const PASSWORD_PLAIN = 'Password1';

const makeRepo = (overrides: Record<string, jest.Mock> = {}) => ({
  findOne: jest.fn(),
  find: jest.fn().mockResolvedValue([]),
  save: jest.fn((e) => Promise.resolve({ id: 'saved-id', ...e })),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
  create: jest.fn((data) => data),
  upsert: jest.fn().mockResolvedValue({}),
  createQueryBuilder: jest.fn().mockReturnValue({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getMany: jest.fn().mockResolvedValue([]),
  }),
  ...overrides,
});

// ── App factory ─────────────────────────────────────────────────────────────
async function createTestApp(): Promise<INestApplication> {
  const passwordHash = await bcrypt.hash(PASSWORD_PLAIN, 10);

  const mockUser: Partial<UserEntity> = {
    id: USER_ID,
    email: 'technician@nustech.test',
    name: 'Test Technician',
    password_hash: passwordHash,
    is_active: true,
    must_change_password: false,
    role: { id: 'role-01', name: 'technician' } as any,
    role_id: 'role-01',
    department_id: 'dept-01',
    location_id: 'loc-01',
  };

  const userRepoMock = makeRepo({
    findOne: jest.fn().mockResolvedValue(mockUser),
  });
  const refreshTokenRepoMock = makeRepo({
    findOne: jest.fn().mockResolvedValue(null),
  });

  // Attendance mocks
  const attendanceRepoMock = makeRepo({
    findOne: jest.fn().mockResolvedValue(null), // default: belum check-in
  });
  const scheduleRepoMock = makeRepo({
    findOne: jest.fn().mockResolvedValue({
      id: 'sched-01',
      user_id: USER_ID,
      date: new Date().toISOString().split('T')[0],
      shift_type: { id: 'shift-01', name: 'Pagi', start_time: '08:00', end_time: '17:00' },
    }),
  });
  const locationRepoMock = makeRepo({
    findOne: jest.fn().mockResolvedValue({
      id: 'loc-01',
      name: 'Kantor Pusat',
      lat: -8.5569, lng: 125.5780,
      geofence_radius: 500,
    }),
  });

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [
      ThrottlerModule.forRoot([{ name: 'short', ttl: 1000, limit: 100 }]),
      AuthModule,
      AttendanceModule,
      VisitsModule,
    ],
  })
    .overrideProvider(ConfigService)
    .useValue({
      get: (key: string) => {
        const cfg: Record<string, any> = {
          'app.jwtSecret': 'test-secret-key-e2e',
          'app.jwtRefreshSecret': 'test-refresh-secret-e2e',
          'app.jwtExpiresIn': '15m',
          'app.jwtRefreshExpiresIn': '7d',
          'app.osrmBaseUrl': 'http://localhost:5000',
          JWT_SECRET: 'test-secret-key-e2e',
          JWT_REFRESH_SECRET: 'test-refresh-secret-e2e',
        };
        return cfg[key] ?? null;
      },
    })
    // Auth repos
    .overrideProvider(getRepositoryToken(UserEntity)).useValue(userRepoMock)
    .overrideProvider(getRepositoryToken(RefreshTokenEntity)).useValue(refreshTokenRepoMock)
    .overrideProvider(getRepositoryToken(UserDeviceEntity)).useValue(makeRepo())
    // Attendance repos
    .overrideProvider(getRepositoryToken(AttendanceEntity)).useValue(attendanceRepoMock)
    .overrideProvider(getRepositoryToken(UserScheduleEntity)).useValue(scheduleRepoMock)
    .overrideProvider(getRepositoryToken(LocationEntity)).useValue(locationRepoMock)
    .overrideProvider(getRepositoryToken(NationalHolidayEntity)).useValue(makeRepo({ find: jest.fn().mockResolvedValue([]) }))
    // Visits repos
    .overrideProvider(getRepositoryToken(VisitEntity)).useValue(makeRepo())
    .overrideProvider(getRepositoryToken(VisitPhotoEntity)).useValue(makeRepo())
    .overrideProvider(getRepositoryToken(ServiceReportEntity)).useValue(makeRepo())
    .overrideProvider(getRepositoryToken(ClientEntity)).useValue(makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'aaaaaaaa-bbbb-cccc-dddd-ffffffffffff', name: 'Test Client', lat: -8.56, lng: 125.58 }),
    }))
    .compile();

  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return app;
}

// ── Helper ──────────────────────────────────────────────────────────────────
async function loginAndGetToken(app: INestApplication): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email: 'technician@nustech.test', password: PASSWORD_PLAIN })
    .expect(200);
  return res.body.access_token as string;
}

// ════════════════════════════════════════════════════════════════════════════
// TEST SUITES
// ════════════════════════════════════════════════════════════════════════════

describe('Auth API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => { app = await createTestApp(); });
  afterAll(async () => { await app.close(); });

  // ── POST /auth/login ────────────────────────────────────────────
  describe('POST /api/v1/auth/login', () => {
    it('berhasil login dengan kredensial valid → 200 + access_token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'technician@nustech.test', password: PASSWORD_PLAIN })
        .expect(200);

      expect(res.body).toHaveProperty('access_token');
      expect(res.body).toHaveProperty('refresh_token');
      expect(res.body.access_token).toBeTruthy();
    });

    it('menolak password salah → 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'technician@nustech.test', password: 'WrongPass1' })
        .expect(401);

      expect(res.body.message).toBeDefined();
    });

    it('menolak payload tidak valid (email bukan email) → 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'bukan-email', password: PASSWORD_PLAIN })
        .expect(400);
    });

    it('menolak payload kosong → 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({})
        .expect(400);
    });
  });

  // ── POST /auth/logout ───────────────────────────────────────────
  describe('POST /api/v1/auth/logout', () => {
    it('menolak akses tanpa token → 401', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .expect(401);
    });

    it('berhasil logout dengan token valid → 204', async () => {
      const token = await loginAndGetToken(app);
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(204);
    });
  });

  // ── POST /auth/change-password ──────────────────────────────────
  describe('POST /api/v1/auth/change-password', () => {
    it('menolak tanpa auth → 401', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/change-password')
        .send({ current_password: PASSWORD_PLAIN, new_password: 'NewPass123' })
        .expect(401);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('Attendance API (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    accessToken = await loginAndGetToken(app);
  });
  afterAll(async () => { await app.close(); });

  // ── POST /attendance/check-in ───────────────────────────────────
  describe('POST /api/v1/attendance/check-in', () => {
    it('menolak tanpa auth → 401', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/attendance/check-in')
        .send({ lat: -8.5569, lng: 125.5780, method: 'pin' })
        .expect(401);
    });

    it('berhasil check-in dengan koordinat valid → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/attendance/check-in')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          lat: -8.5569,
          lng: 125.5780,
          method: 'pin',
        })
        .expect(201);

      expect(res.body).toBeDefined();
    });

    it('menolak payload tidak valid (tanpa koordinat) → 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/attendance/check-in')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ method: 'pin' }) // lat/lng hilang
        .expect(400);
    });
  });

  // ── GET /attendance/today ───────────────────────────────────────
  describe('GET /api/v1/attendance/today', () => {
    it('menolak tanpa auth → 401', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/attendance/today')
        .expect(401);
    });

    it('berhasil dengan token → 200', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/attendance/today')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });
  });

  // ── POST /attendance/check-out ──────────────────────────────────
  describe('POST /api/v1/attendance/check-out', () => {
    it('menolak tanpa auth → 401', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/attendance/check-out')
        .send({ method: 'manual', lat: -8.5569, lng: 125.5780 })
        .expect(401);
    });

    it('menolak jika belum check-in → 400 atau 404', async () => {
      // attendanceRepo.findOne return null (belum check-in)
      const res = await request(app.getHttpServer())
        .post('/api/v1/attendance/check-out')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ method: 'manual', lat: -8.5569, lng: 125.5780 });

      expect([400, 404]).toContain(res.status);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('Visits API (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    accessToken = await loginAndGetToken(app);
  });
  afterAll(async () => { await app.close(); });

  // ── GET /visits/route ───────────────────────────────────────────
  describe('GET /api/v1/visits/route', () => {
    it('menolak tanpa auth → 401', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/visits/route?originLat=-8.55&originLng=125.57&destLat=-8.56&destLng=125.58')
        .expect(401);
    });

    it('berhasil dengan koordinat valid → 200 + distance/duration', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/visits/route')
        .query({ originLat: '-8.5569', originLng: '125.5780', destLat: '-8.5600', destLng: '125.5850' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // OSRM akan fallback ke haversine karena tidak ada server running
      expect(res.body).toHaveProperty('distance');
      expect(res.body).toHaveProperty('duration');
      expect(typeof res.body.distance).toBe('number');
    });
  });

  // ── POST /visits/check-in ───────────────────────────────────────
  describe('POST /api/v1/visits/check-in', () => {
    it('menolak tanpa auth → 401', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/visits/check-in')
        .send({ task_id: 'task-001', client_id: 'client-001', lat: -8.5569, lng: 125.5780 })
        .expect(401);
    });

    it('menolak payload tidak valid (tanpa task_id) → 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/visits/check-in')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ lat: -8.5569, lng: 125.5780 }) // task_id & client_id hilang
        .expect(400);
    });

    it('berhasil check-in kunjungan dengan data valid → 201', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/visits/check-in')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          task_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          client_id: 'aaaaaaaa-bbbb-cccc-dddd-ffffffffffff',
          lat: -8.5569,
          lng: 125.5780,
        })
        .expect(201);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('JWT Guard (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => { app = await createTestApp(); });
  afterAll(async () => { await app.close(); });

  it('menolak token palsu → 401', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/attendance/today')
      .set('Authorization', 'Bearer ini.token.palsu')
      .expect(401);
  });

  it('menolak token kadaluarsa → 401', async () => {
    const jwtService = new JwtService({ secret: 'test-secret-key-e2e' });
    const expiredToken = jwtService.sign(
      { sub: USER_ID, email: 'test@test.com' },
      { expiresIn: '-1s' },
    );
    await request(app.getHttpServer())
      .get('/api/v1/attendance/today')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);
  });

  it('menolak tanpa header Authorization → 401', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/attendance/today')
      .expect(401);
  });
});
