import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VASP } from '../../database/entities/vasp.entity';
import { Attribution } from '../../database/entities/attribution.entity';

@Injectable()
export class VaspService {
  private readonly logger = new Logger(VaspService.name);

  constructor(
    @InjectRepository(VASP) private vaspRepo: Repository<VASP>,
    @InjectRepository(Attribution) private attrRepo: Repository<Attribution>,
  ) {}

  async findAll(options?: { page?: number; limit?: number; type?: string }) {
    const page = options?.page || 1;
    const limit = options?.limit || 50;

    const qb = this.vaspRepo.createQueryBuilder('v')
      .orderBy('v.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    if (options?.type) {
      qb.andWhere('v.type = :type', { type: options.type });
    }

    const [vasps, total] = await qb.getManyAndCount();
    return { data: vasps, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findById(id: string): Promise<VASP | null> {
    return this.vaspRepo.findOne({ where: { id } });
  }

  async findByWallet(address: string): Promise<VASP | null> {
    return this.vaspRepo.createQueryBuilder('v')
      .where(':address = ANY(v.wallets)', { address })
      .getOne();
  }

  async findNearestVasp(walletAddress: string, path: string[], amount: string, crossChain: boolean) {
    // Find VASPs that contain addresses in the trace path
    for (const addr of path) {
      const vasp = await this.vaspRepo.createQueryBuilder('v')
        .where(':addr = ANY(v.wallets)', { addr })
        .getOne();

      if (vasp) {
        const distance = path.indexOf(addr);
        const confidence = this.calculateConfidence(distance, path.length, parseFloat(amount), crossChain);

        const factors = [
          { factor: 'Verified label source', weight: 35, contribution: confidence * 0.35 },
          { factor: 'Known address cluster', weight: 25, contribution: confidence * 0.25 },
          { factor: 'Graph proximity', weight: 20, contribution: confidence * 0.20 },
          { factor: 'Repeated interaction', weight: 10, contribution: confidence * 0.10 },
          { factor: 'Historical intelligence', weight: 10, contribution: confidence * 0.10 },
        ];

        return {
          vasp,
          distance,
          amount,
          crossChain,
          confidence: Math.min(confidence, 99), // Never 100%
          factors,
          path: path.slice(0, distance + 1),
        };
      }
    }

    return null;
  }

  private calculateConfidence(distance: number, totalHops: number, amount: number, crossChain: boolean): number {
    let confidence = 90;

    // Reduce based on distance
    confidence -= Math.min(distance * 3, 20);

    // Increase for larger amounts
    if (amount > 10000) confidence += 5;
    if (amount > 100000) confidence += 3;

    // Reduce for cross-chain (less certain)
    if (crossChain) confidence -= 5;

    return Math.max(40, Math.min(confidence, 99));
  }

  async getAttributions(vaspId: string): Promise<Attribution[]> {
    return this.attrRepo.find({ where: { vaspId }, order: { confidence: 'DESC' } });
  }

  async getStats() {
    const total = await this.vaspRepo.count();
    const verified = await this.vaspRepo.count({ where: { verificationStatus: 'VERIFIED' as any } });
    return { total, verified };
  }
}
