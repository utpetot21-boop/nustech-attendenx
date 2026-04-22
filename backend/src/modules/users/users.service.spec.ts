import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { UserEntity } from './entities/user.entity';
import { UsersService } from './users.service';

const mockUser = {
  id: 'user-id-1',
  employee_id: 'EMP-001',
  name: 'Ahmad',
  email: 'ahmad@test.com',
  phone: '08123456789',
  role_id: 'role-id',
  is_active: true,
  must_change_password: true,
};

const mockRepo = () => ({
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  create: jest.fn((data) => data),
  update: jest.fn(),
  delete: jest.fn(),
});

describe('UsersService', () => {
  let service: UsersService;
  let repo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(UserEntity), useValue: mockRepo() },
      ],
    }).compile();

    service = module.get(UsersService);
    repo = module.get(getRepositoryToken(UserEntity));
  });

  describe('findOne', () => {
    it('mengembalikan user jika ditemukan', async () => {
      repo.findOne.mockResolvedValue(mockUser);
      const user = await service.findOne('user-id-1');
      expect(user.employee_id).toBe('EMP-001');
    });

    it('throw NotFoundException jika tidak ditemukan', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne('unknown-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('berhasil buat user baru', async () => {
      repo.findOne.mockResolvedValue(null); // tidak ada duplikat
      repo.save.mockResolvedValue(mockUser);

      const result = await service.create({
        employee_id: 'EMP-002',
        full_name: 'Budi',
        email: 'budi@test.com',
        phone: '08198765432',
        role_id: 'role-id',
      });

      expect(repo.save).toHaveBeenCalled();
    });

    it('throw ConflictException jika email sudah ada', async () => {
      repo.findOne.mockResolvedValueOnce(mockUser); // email sudah ada

      await expect(
        service.create({
          employee_id: 'EMP-003',
          full_name: 'Cici',
          email: 'ahmad@test.com',
          phone: '08111111111',
          role_id: 'role-id',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('soft delete: set is_active = false', async () => {
      repo.findOne.mockResolvedValue(mockUser);
      repo.update.mockResolvedValue({});

      await service.remove('user-id-1');
      expect(repo.update).toHaveBeenCalledWith('user-id-1', { is_active: false });
    });
  });
});
