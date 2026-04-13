import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { TaskHoldEntity } from '../entities/task-hold.entity';
import { TaskEntity } from '../entities/task.entity';

@Injectable()
export class HoldAutoApproverJob {
  private readonly logger = new Logger(HoldAutoApproverJob.name);

  constructor(
    @InjectRepository(TaskHoldEntity)
    private readonly holdRepo: Repository<TaskHoldEntity>,
    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,
  ) {}

  @Cron('*/5 * * * *', { timeZone: 'Asia/Makassar' })
  async handle(): Promise<void> {
    const now = new Date();

    const overdue = await this.holdRepo.find({
      where: {
        review_status: 'pending',
        auto_approve_at: LessThanOrEqual(now),
      },
    });

    for (const hold of overdue) {
      this.logger.log(
        `Hold auto-approve: hold ${hold.id} for task ${hold.task_id}`,
      );

      const task = await this.taskRepo.findOne({ where: { id: hold.task_id } });

      // Calculate next business day for reschedule
      const rescheduleDate = new Date(hold.held_at);
      rescheduleDate.setDate(rescheduleDate.getDate() + 1);
      // Skip Sunday
      if (rescheduleDate.getDay() === 0) rescheduleDate.setDate(rescheduleDate.getDate() + 1);

      const rescheduleDateStr = rescheduleDate.toISOString().split('T')[0];

      await this.holdRepo.update(hold.id, {
        review_status: 'approved',
        reviewed_at: now,
        reschedule_date: rescheduleDateStr,
        is_auto_approved: true,
      });

      await this.taskRepo.update(hold.task_id, {
        status: 'rescheduled',
        scheduled_at: new Date(rescheduleDateStr) as never,
      });
    }
  }
}
