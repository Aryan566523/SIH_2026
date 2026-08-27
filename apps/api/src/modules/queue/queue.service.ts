import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private jobQueues: Map<string, any[]> = new Map();

  constructor() {
    this.jobQueues.set('investigation', []);
    this.jobQueues.set('watchlist', []);
    this.jobQueues.set('risk', []);
  }

  async addJob(queue: string, data: any): Promise<string> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const job = { id: jobId, data, status: 'pending', createdAt: new Date() };

    if (!this.jobQueues.has(queue)) {
      this.jobQueues.set(queue, []);
    }
    this.jobQueues.get(queue)!.push(job);

    this.logger.log(`Job ${jobId} added to queue: ${queue}`);
    return jobId;
  }

  async getJob(queue: string, jobId: string): Promise<any> {
    const jobs = this.jobQueues.get(queue) || [];
    return jobs.find((j) => j.id === jobId) || null;
  }

  async getQueueStats() {
    const stats: Record<string, number> = {};
    for (const [name, jobs] of this.jobQueues) {
      stats[name] = jobs.filter((j) => j.status === 'pending').length;
    }
    return stats;
  }
}
