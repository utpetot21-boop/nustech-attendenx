import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';

import { RefreshTokenEntity } from '../users/entities/refresh-token.entity';
import { UserDeviceEntity } from '../users/entities/user-device.entity';
import { UserEntity } from '../users/entities/user.entity';
import { AuthService } from './auth.service';

const mockUser = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  email: 'test@test.com',
  name: 'Test User',
  employee_id: 'EMP-001',
  phone: '08123456789',
  password_hash: bcrypt.hashSync('Test@1234', 1),
  role: { id: 'role-id', name: 'karyawan', permissions: [], can_delegate: false, can_approve: false },
  role_id: 'role-id',
  is_active: true,
  must_change_password: false,
};

const mockRepo = () => ({
  findOne: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  create: jest.fn((data) => data),
  upsert: jest.fn(),
});

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: ReturnType<typeof mockRepo>;
  let refreshRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(UserEntity),
          useValue: mockRepo(),
        },
        {
          provide: getRepositoryToken(RefreshTokenEntity),
          useValue: mockRepo(),
        },
        {
          provide: getRepositoryToken(UserDeviceEntity),
          useValue: mockRepo(),
        },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn().mockResolvedValue('token') },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const map: Record<string, unknown> = {
                'app.jwtSecret': 'test-secret',
                'app.jwtRefreshSecret': 'test-refresh-secret',
                'app.jwtAccessExpires': '15m',
                'app.jwtRefreshExpires': '7d',
                'app.bcryptRounds': 1,
              };
              return map[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    userRepo = module.get(getRepositoryToken(UserEntity));
    refreshRepo = module.get(getRepositoryToken(RefreshTokenEntity));
  });

  describe('login', () => {
    it('berhasil login dengan kredensial valid', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      refreshRepo.save.mockResolvedValue({});
      refreshRepo.create.mockImplementation((data) => data);

      const result = await service.login({
        email: 'test@test.com',
        password: 'Test@1234',
      });

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(result.user.email).toBe('test@test.com');
    });

    it('gagal login dengan password salah', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      await expect(
        service.login({ email: 'test@test.com', password: 'WrongPass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('gagal login jika user tidak ditemukan', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(
        service.login({ email: 'notfound@test.com', password: 'any' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('gagal login jika user tidak aktif', async () => {
      userRepo.findOne.mockResolvedValue({ ...mockUser, is_active: false });
      await expect(
        service.login({ email: 'test@test.com', password: 'Test@1234' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('changePassword', () => {
    it('berhasil ganti password', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      userRepo.update.mockResolvedValue({});
      refreshRepo.update.mockResolvedValue({});

      await expect(
        service.changePassword(mockUser.id, 'Test@1234', 'NewPass@5678'),
      ).resolves.not.toThrow();
    });

    it('gagal jika password baru tidak memenuhi syarat', async () => {
      await expect(
        service.changePassword(mockUser.id, 'Test@1234', 'weakpass'),
      ).rejects.toThrow(BadRequestException);
    });

    it('gagal jika password lama salah', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      await expect(
        service.changePassword(mockUser.id, 'WrongPass', 'NewPass@5678'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('setPin', () => {
    it('berhasil set PIN 6 digit', async () => {
      userRepo.update.mockResolvedValue({});
      await expect(service.setPin(mockUser.id, '123456')).resolves.not.toThrow();
    });

    it('gagal jika PIN kurang dari 6 digit', async () => {
      await expect(service.setPin(mockUser.id, '1234')).rejects.toThrow(BadRequestException);
    });

    it('gagal jika PIN mengandung huruf', async () => {
      await expect(service.setPin(mockUser.id, '12345a')).rejects.toThrow(BadRequestException);
    });
  });
});
