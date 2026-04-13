import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { LeaveService } from './leave.service';
import { LeaveBalanceEntity } from './entities/leave-balance.entity';
import { LeaveRequestEntity } from './entities/leave-request.entity';
import { LeaveBalanceLogEntity } from './entities/leave-balance-log.entity';
import { PendingDeductionEntity } from './entities/pending-deduction.entity';
import { LeaveObjectionEntity } from './entities/leave-objection.entity';
import { CompanyLeaveConfigEntity } from './entities/company-leave-config.entity';
import { UserEntity } from '../users/entities/user.entity';
import { NationalHolidayEntity } from '../schedule/entities/national-holiday.entity';

const USER_ID = 'user-uuid-456';
const MANAGER_ID = 'manager-uuid-789';
const YEAR = new Date().getFullYear();

const makeRepo = (overrides: Record<string, jest.Mock> = {}) => ({
  findOne: jest.fn(),
  find: jest.fn().mockResolvedValue([]),
  save: jest.fn((e) => Promise.resolve({ id: 'saved-id', ...e })),
  update: jest.fn().mockResolvedValue({}),
  create: jest.fn((data) => data),
  createQueryBuilder: jest.fn().mockReturnValue({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getMany: jest.fn().mockResolvedValue([]),
    getCount: jest.fn().mockResolvedValue(0),
  }),
  ...overrides,
});

const mockBalance = (days = 10): LeaveBalanceEntity => ({
  id: 'bal-001',
  user_id: USER_ID,
  year: YEAR,
  balance_days: days,
  used_days: 2,
  accrued_this_year: days + 2,
  expired_days: 0,
} as unknown as LeaveBalanceEntity);

const mockConfig = (): CompanyLeaveConfigEntity => ({
  id: 'cfg-001',
  max_leave_days_per_year: 12,
  monthly_accrual_amount: 1,
  objection_window_hours: 24,
  carry_over_max: 5,
} as unknown as CompanyLeaveConfigEntity);

describe('LeaveService', () => {
  let service: LeaveService;
  let balanceRepo: ReturnType<typeof makeRepo>;
  let requestRepo: ReturnType<typeof makeRepo>;
  let logRepo: ReturnType<typeof makeRepo>;
  let deductionRepo: ReturnType<typeof makeRepo>;
  let objectionRepo: ReturnType<typeof makeRepo>;
  let configRepo: ReturnType<typeof makeRepo>;
  let userRepo: ReturnType<typeof makeRepo>;
  let holidayRepo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    balanceRepo   = makeRepo();
    requestRepo   = makeRepo();
    logRepo       = makeRepo();
    deductionRepo = makeRepo();
    objectionRepo = makeRepo();
    configRepo    = makeRepo();
    userRepo      = makeRepo();
    holidayRepo   = makeRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveService,
        { provide: getRepositoryToken(LeaveBalanceEntity),       useValue: balanceRepo },
        { provide: getRepositoryToken(LeaveRequestEntity),       useValue: requestRepo },
        { provide: getRepositoryToken(LeaveBalanceLogEntity),    useValue: logRepo },
        { provide: getRepositoryToken(PendingDeductionEntity),   useValue: deductionRepo },
        { provide: getRepositoryToken(LeaveObjectionEntity),     useValue: objectionRepo },
        { provide: getRepositoryToken(CompanyLeaveConfigEntity), useValue: configRepo },
        { provide: getRepositoryToken(UserEntity),               useValue: userRepo },
        { provide: getRepositoryToken(NationalHolidayEntity),    useValue: holidayRepo },
      ],
    }).compile();

    service = module.get<LeaveService>(LeaveService);
  });

  // ── getBalance ───────────────────────────────────────────────────────────────
  describe('getBalance()', () => {
    it('mengembalikan balance yang ada', async () => {
      const bal = mockBalance(8);
      balanceRepo.findOne.mockResolvedValueOnce(bal);
      const result = await service.getBalance(USER_ID);
      expect(result).toEqual(bal);
    });

    it('membuat balance baru jika belum ada untuk tahun ini', async () => {
      balanceRepo.findOne.mockResolvedValueOnce(null);
      const newBal = mockBalance(0);
      balanceRepo.create.mockReturnValueOnce(newBal);
      balanceRepo.save.mockResolvedValueOnce(newBal);
      const result = await service.getBalance(USER_ID);
      expect(balanceRepo.save).toHaveBeenCalledTimes(1);
      expect(result).toBeDefined();
    });
  });

  // ── createRequest ────────────────────────────────────────────────────────────
  describe('createRequest()', () => {
    it('berhasil membuat pengajuan cuti jika saldo cukup', async () => {
      balanceRepo.findOne.mockResolvedValueOnce(mockBalance(5)); // 5 hari tersedia
      holidayRepo.find.mockResolvedValueOnce([]); // tidak ada libur nasional
      const saved = { id: 'req-001', user_id: USER_ID, type: 'cuti', total_days: 2, status: 'pending' };
      requestRepo.create.mockReturnValueOnce(saved);
      requestRepo.save.mockResolvedValueOnce(saved);

      const result = await service.createRequest(USER_ID, {
        type: 'cuti',
        start_date: '2026-05-05',
        end_date: '2026-05-06',
        reason: 'Liburan',
      });
      expect(result.status).toBe('pending');
    });

    it('melempar BadRequestException jika saldo cuti tidak cukup', async () => {
      balanceRepo.findOne.mockResolvedValueOnce(mockBalance(1)); // hanya 1 hari
      holidayRepo.find.mockResolvedValueOnce([]);

      await expect(service.createRequest(USER_ID, {
        type: 'cuti',
        start_date: '2026-05-05',
        end_date: '2026-05-07', // 3 hari kerja
        reason: 'Test',
      })).rejects.toThrow(BadRequestException);
    });

    it('berhasil membuat pengajuan izin tanpa cek saldo', async () => {
      holidayRepo.find.mockResolvedValueOnce([]);
      const saved = { id: 'req-002', user_id: USER_ID, type: 'izin', total_days: 1, status: 'pending' };
      requestRepo.create.mockReturnValueOnce(saved);
      requestRepo.save.mockResolvedValueOnce(saved);

      const result = await service.createRequest(USER_ID, {
        type: 'izin',
        start_date: '2026-05-05',
        end_date: '2026-05-05',
        reason: 'Urusan keluarga',
      });
      // balanceRepo tidak dipanggil untuk izin
      expect(balanceRepo.findOne).not.toHaveBeenCalled();
      expect(result.type).toBe('izin');
    });

    it('melempar BadRequestException untuk rentang tanggal tidak valid (sabtu-minggu)', async () => {
      holidayRepo.find.mockResolvedValueOnce([]);
      // 2026-05-09 = Sabtu, 2026-05-10 = Minggu — tidak ada hari kerja
      await expect(service.createRequest(USER_ID, {
        type: 'cuti',
        start_date: '2026-05-09',
        end_date: '2026-05-10',
        reason: 'Test weekend',
      })).rejects.toThrow(BadRequestException);
    });
  });

  // ── approveRequest ───────────────────────────────────────────────────────────
  describe('approveRequest()', () => {
    it('berhasil approve pengajuan cuti dan memotong saldo', async () => {
      const req = { id: 'req-001', user_id: USER_ID, type: 'cuti', total_days: 2, status: 'pending' };
      requestRepo.findOne.mockResolvedValueOnce(req);
      balanceRepo.findOne.mockResolvedValueOnce(mockBalance(5));
      requestRepo.findOne.mockResolvedValueOnce({ ...req, status: 'approved' });

      const result = await service.approveRequest('req-001', MANAGER_ID);
      expect(balanceRepo.update).toHaveBeenCalledWith(
        'bal-001',
        expect.objectContaining({ balance_days: 3 }), // 5 - 2
      );
      expect(logRepo.create).toHaveBeenCalled();
    });

    it('melempar BadRequestException jika pengajuan bukan pending', async () => {
      requestRepo.findOne.mockResolvedValueOnce({ id: 'req-001', status: 'approved' });
      await expect(service.approveRequest('req-001', MANAGER_ID))
        .rejects.toThrow(BadRequestException);
    });

    it('melempar NotFoundException jika pengajuan tidak ditemukan', async () => {
      requestRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.approveRequest('not-exist', MANAGER_ID))
        .rejects.toThrow(NotFoundException);
    });
  });

  // ── processAlfa (pemotongan saldo alfa) ──────────────────────────────────────
  describe('processAlfa()', () => {
    it('membuat pending_deduction jika tidak ada saldo yang memadai', async () => {
      balanceRepo.findOne.mockResolvedValueOnce(mockBalance(0)); // saldo 0
      configRepo.findOne.mockResolvedValueOnce(mockConfig());
      deductionRepo.findOne.mockResolvedValueOnce(null); // tidak ada deduction existing
      deductionRepo.create.mockReturnValueOnce({ id: 'ded-001', user_id: USER_ID });
      deductionRepo.save.mockResolvedValueOnce({ id: 'ded-001' });

      await expect(service.processAlfa(USER_ID, 'att-001')).resolves.not.toThrow();
    });

    it('tidak membuat duplikat deduction jika sudah ada untuk attendance yang sama', async () => {
      balanceRepo.findOne.mockResolvedValueOnce(mockBalance(0));
      configRepo.findOne.mockResolvedValueOnce(mockConfig());
      deductionRepo.findOne.mockResolvedValueOnce({ id: 'existing-ded' }); // sudah ada

      await service.processAlfa(USER_ID, 'att-001');
      expect(deductionRepo.save).not.toHaveBeenCalled(); // tidak buat baru
    });
  });

  // ── runMonthlyAccrual ────────────────────────────────────────────────────────
  describe('runMonthlyAccrual()', () => {
    it('menambah saldo 1 hari untuk semua user aktif', async () => {
      configRepo.findOne.mockResolvedValueOnce(mockConfig());
      const activeUsers = [
        { id: 'u1', is_active: true },
        { id: 'u2', is_active: true },
      ];
      userRepo.find.mockResolvedValueOnce(activeUsers);
      // Untuk setiap user, getBalance dipanggil
      balanceRepo.findOne.mockResolvedValue(mockBalance(5));

      await service.runMonthlyAccrual();
      // update harus dipanggil 2x (untuk 2 user)
      expect(balanceRepo.update).toHaveBeenCalledTimes(2);
    });
  });
});
