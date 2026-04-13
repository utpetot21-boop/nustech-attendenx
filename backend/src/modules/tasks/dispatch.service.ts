import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';

import { TaskEntity } from './entities/task.entity';
import { TaskAssignmentEntity } from './entities/task-assignment.entity';
import { UserEntity } from '../users/entities/user.entity';
import { VisitEntity } from '../visits/entities/visit.entity';
import { OsrmService } from '../../services/osrm.service';

// Confirm deadline in minutes per priority
const CONFIRM_DEADLINE: Record<string, number> = {
  normal: 60,
  high: 30,
  urgent: 15,
};

// Escalation threshold in minutes (no technician found)
const ESCALATION_THRESHOLD: Record<string, number> = {
  normal: 120, // escalate to high after 2 hours
  high: 60,    // escalate to urgent after 1 hour
};

const PRIORITY_ORDER = ['low', 'normal', 'high', 'urgent'];

@Injectable()
export class DispatchService {
  private readonly logger = new Logger(DispatchService.name);

  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,
    @InjectRepository(TaskAssignmentEntity)
    private readonly assignRepo: Repository<TaskAssignmentEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(VisitEntity)
    private readonly visitRepo: Repository<VisitEntity>,
    private readonly osrm: OsrmService,
  ) {}

  /**
   * Offer task to a user (direct or broadcast).
   * Sets confirm_deadline based on priority.
   */
  async offerTask(taskId: string, userId: string): Promise<TaskAssignmentEntity> {
    const task = await this.taskRepo.findOneOrFail({ where: { id: taskId } });

    // Mark previous current assignment as not current
    await this.assignRepo.update(
      { task_id: taskId, is_current: true },
      { is_current: false },
    );

    const deadlineMinutes = CONFIRM_DEADLINE[task.priority] ?? 60;
    const offeredAt = new Date();

    const assignment = this.assignRepo.create({
      task_id: taskId,
      user_id: userId,
      status: 'offered',
      offered_at: offeredAt,
      is_current: true,
    });

    // Set confirm_deadline on task
    const confirmDeadline = new Date(offeredAt.getTime() + deadlineMinutes * 60_000);
    await this.taskRepo.update(taskId, {
      assigned_to: userId,
      confirm_deadline: confirmDeadline,
      status: 'pending_confirmation',
    });

    return this.assignRepo.save(assignment);
  }

  /**
   * Auto-assign job: runs every 30 seconds.
   * Finds tasks in pending_confirmation where confirm_deadline has passed.
   * Picks best available technician (not currently on visit) and re-offers.
   */
  async runAutoAssign(): Promise<void> {
    const now = new Date();

    const timedOutTasks = await this.taskRepo.find({
      where: { status: 'pending_confirmation' },
      relations: ['assignments'],
    });

    for (const task of timedOutTasks) {
      if (!task.confirm_deadline || task.confirm_deadline > now) continue;

      this.logger.log(`Auto-assign: task ${task.id} timed out, finding replacement.`);

      // Mark current assignment as auto_assigned
      const current = task.assignments?.find((a) => a.is_current);
      if (current) {
        await this.assignRepo.update(current.id, {
          status: 'auto_assigned',
          responded_at: now,
          is_current: false,
        });
      }

      // Find best available technician
      const candidate = await this.findAvailableTechnician(task);
      if (candidate) {
        await this.offerTask(task.id, candidate.id);
        this.logger.log(
          `Auto-assign: task ${task.id} → offered to ${candidate.id}`,
        );
      } else {
        // No one available, keep unassigned
        await this.taskRepo.update(task.id, {
          assigned_to: null,
          status: 'unassigned',
          confirm_deadline: null,
        });
        this.logger.warn(`Auto-assign: no available technician for task ${task.id}`);
      }
    }
  }

  /**
   * Escalation job: runs every 5 minutes.
   * Escalates priority if task is unhandled beyond threshold.
   */
  async runEscalationCheck(): Promise<void> {
    const now = new Date();

    const unhandledTasks = await this.taskRepo.find({
      where: [{ status: 'unassigned' }, { status: 'pending_confirmation' }],
    });

    for (const task of unhandledTasks) {
      const ageMinutes = (now.getTime() - task.created_at.getTime()) / 60_000;
      const threshold = ESCALATION_THRESHOLD[task.priority];

      if (threshold === undefined) continue; // urgent has no escalation
      if (ageMinutes < threshold) continue;

      const nextPriorityIdx = PRIORITY_ORDER.indexOf(task.priority) + 1;
      if (nextPriorityIdx >= PRIORITY_ORDER.length) continue;

      const newPriority = PRIORITY_ORDER[nextPriorityIdx];
      this.logger.log(
        `Escalation: task ${task.id} ${task.priority} → ${newPriority}`,
      );

      await this.taskRepo.update(task.id, {
        priority: newPriority as never,
      });
    }
  }

  // ────────────────────────────────────────────────────────────────────────────

  private async findAvailableTechnician(
    task: TaskEntity,
  ): Promise<UserEntity | null> {
    // Technicians not currently on a visit
    const busyUserIds = (
      await this.visitRepo.find({ where: { status: 'ongoing' } })
    ).map((v) => v.user_id);

    const candidates = await this.userRepo
      .createQueryBuilder('u')
      .innerJoin('u.role', 'r')
      .where('r.name IN (:...roles)', { roles: ['karyawan', 'manager'] })
      .andWhere(busyUserIds.length > 0 ? 'u.id NOT IN (:...busyIds)' : '1=1', {
        busyIds: busyUserIds,
      })
      .andWhere('u.is_active = true')
      .getMany();

    if (!candidates.length) return null;

    // If task has no destination coordinates, fall back to dept/first
    const taskLat = (task as any).dest_lat as number | null;
    const taskLng = (task as any).dest_lng as number | null;

    if (!taskLat || !taskLng) {
      if (task.broadcast_dept_id) {
        const deptCandidate = candidates.find(
          (u: UserEntity & { dept_id?: string }) => u.dept_id === task.broadcast_dept_id,
        );
        if (deptCandidate) return deptCandidate;
      }
      return candidates[0] ?? null;
    }

    // Sort candidates by OSRM distance to task destination
    const withDistance = await Promise.all(
      candidates.map(async (u) => {
        const uLat = (u as any).last_lat as number | null;
        const uLng = (u as any).last_lng as number | null;
        if (!uLat || !uLng) return { user: u, distance: Infinity };
        try {
          const route = await this.osrm.getRoute(uLat, uLng, taskLat, taskLng);
          return { user: u, distance: route.distance };
        } catch {
          const dist = this.osrm.haversineDistance(uLat, uLng, taskLat, taskLng);
          return { user: u, distance: dist };
        }
      }),
    );

    withDistance.sort((a, b) => a.distance - b.distance);
    this.logger.log(
      `Auto-assign nearest: ${withDistance.slice(0, 3).map((w) => `${(w.user as any).full_name}(${Math.round(w.distance)}m)`).join(', ')}`,
    );

    return withDistance[0]?.user ?? null;
  }
}
