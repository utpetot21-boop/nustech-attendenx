import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { isWithinGeofence } from '@nustech/shared';
import { LocationEntity } from './entities/location.entity';
import type { CreateLocationDto } from './dto/create-location.dto';

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(LocationEntity)
    private locationRepo: Repository<LocationEntity>,
  ) {}

  findAll() {
    return this.locationRepo.find({ where: { is_active: true }, order: { name: 'ASC' } });
  }

  async findOne(id: string) {
    const loc = await this.locationRepo.findOne({ where: { id } });
    if (!loc) throw new NotFoundException(`Lokasi ${id} tidak ditemukan`);
    return loc;
  }

  create(dto: CreateLocationDto) {
    return this.locationRepo.save(this.locationRepo.create(dto));
  }

  async update(id: string, dto: Partial<CreateLocationDto>) {
    await this.findOne(id);
    await this.locationRepo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.locationRepo.update(id, { is_active: false });
  }

  /**
   * Validasi apakah user berada dalam geofence salah satu lokasi aktif
   */
  async validateGeofence(
    userLat: number,
    userLng: number,
  ): Promise<{ isValid: boolean; location: LocationEntity | null; distance: number }> {
    const locations = await this.findAll();

    for (const loc of locations) {
      const distance = Math.round(
        // Gunakan validator dari shared
        isWithinGeofence(userLat, userLng, loc.lat, loc.lng, loc.radius_meter)
          ? 0
          : 999999,
      );

      if (distance === 0) {
        return { isValid: true, location: loc, distance: 0 };
      }
    }

    // Hitung jarak ke lokasi terdekat untuk pesan error
    return { isValid: false, location: null, distance: 0 };
  }
}
