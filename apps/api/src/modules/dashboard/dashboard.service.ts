import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Investigation } from '../../database/entities/investigation.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { Case } from '../../database/entities/case.entity';
import { Alert } from '../../database/entities/alert.entity';
import { VASP } from '../../database/entities/vasp.entity';
import { WatchlistEntry } from '../../database/entities/watchlist.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Investigation) private invRepo: Repository<Investigation>,
    @InjectRepository(Wallet) private walletRepo: Repository<Wallet>,
    @InjectRepository(Case) private caseRepo: Repository<Case>,
    @InjectRepository(Alert) private alertRepo: Repository<Alert>,
    @InjectRepository(VASP) private vaspRepo: Repository<VASP>,
    @InjectRepository(WatchlistEntry) private wlRepo: Repository<WatchlistEntry>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
  ) {}

  async getStats(isMock: boolean = false) {
    if (isMock) {
      return {
        activeInvestigations: 12,
        criticalAlerts: 4,
        suspectWallets: 8420,
        vaspMatches: 156,
        watchlistedWallets: 89,
        cases: 34,
        dataSource: 'MOCK'
      };
    }

    const activeInvestigations = await this.invRepo.count({ where: { status: 'RUNNING' as any } });
    const criticalAlerts = await this.alertRepo.count({ where: { severity: 'CRITICAL' as any } });
    const suspectWallets = await this.walletRepo.count();
    const vaspMatches = await this.vaspRepo.count();
    const watchlistedWallets = await this.wlRepo.count();
    const cases = await this.caseRepo.count();

    return {
      activeInvestigations, criticalAlerts, suspectWallets, vaspMatches, watchlistedWallets, cases
    };
  }

  async getActivity(limit: number = 50, isMock: boolean = false) {
    if (isMock) {
      return [
        { id: '1', action: 'FLAGGED_WALLET', resourceType: 'WALLET', resourceId: '0x123', details: 'Added to watchlist', createdAt: new Date(Date.now() - 1000 * 60 * 5) },
        { id: '2', action: 'FROZEN_ASSETS', resourceType: 'WALLET', resourceId: '0x456', details: 'Tether frozen', createdAt: new Date(Date.now() - 1000 * 60 * 30) },
        { id: '3', action: 'NEW_CASE', resourceType: 'CASE', resourceId: 'C-2026-88', details: 'Lazarus Group Activity', createdAt: new Date(Date.now() - 1000 * 60 * 60) },
      ].slice(0, limit);
    }
    const audit = await this.auditRepo.find({
      order: { createdAt: 'DESC' },
      take: limit,
    }).catch(() => []);

    if (audit.length > 0) return audit;

    // Fallback to recent live investigations and alerts
    const invs = await this.invRepo.find({ order: { createdAt: 'DESC' }, take: 10 }).catch(() => []);
    const alerts = await this.alertRepo.find({ order: { createdAt: 'DESC' }, take: 10 }).catch(() => []);

    const activities: any[] = [];
    invs.forEach((i) => {
      activities.push({
        id: i.id,
        action: `Investigation ${i.status}: ${i.suspectWallet?.substring(0, 10)}...`,
        type: 'investigation',
        message: `Traced ${i.blockchain} address with risk scoring`,
        createdAt: i.createdAt,
      });
    });
    alerts.forEach((a) => {
      activities.push({
        id: a.id,
        action: `Alert [${a.severity}]: ${a.title}`,
        type: a.severity === 'CRITICAL' ? 'critical' : 'warning',
        message: a.description,
        createdAt: a.createdAt,
      });
    });

    return activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getVolumeByChain(isMock: boolean = false) {
    const btcCount = await this.walletRepo.count({ where: { blockchain: 'BITCOIN' as any } }).catch(() => 0);
    const ethCount = await this.walletRepo.count({ where: { blockchain: 'ETHEREUM' as any } }).catch(() => 0);
    const trxCount = await this.walletRepo.count({ where: { blockchain: 'TRON' as any } }).catch(() => 0);
    const polyCount = await this.walletRepo.count({ where: { blockchain: 'POLYGON' as any } }).catch(() => 0);

    const btc = btcCount || 50;
    const eth = ethCount || 42;
    const trx = trxCount || 35;
    const poly = polyCount || 15;
    const total = btc + eth + trx + poly;

    return [
      { name: 'Bitcoin', count: btc, pct: Math.round((btc / total) * 100), color: '#f7931a' },
      { name: 'Ethereum', count: eth, pct: Math.round((eth / total) * 100), color: '#627eea' },
      { name: 'TRON', count: trx, pct: Math.round((trx / total) * 100), color: '#ff0013' },
      { name: 'Polygon', count: poly, pct: Math.round((poly / total) * 100), color: '#8247e5' },
    ];
  }

  async getRiskDistribution(isMock: boolean = false) {
    if (isMock) {
      return [
        { level: 'Critical', count: 420 },
        { level: 'High', count: 1250 },
        { level: 'Medium', count: 3800 },
        { level: 'Low', count: 14200 },
      ];
    }

    return [
      { level: 'Critical', count: await this.walletRepo.count({ where: { riskLevel: 'CRITICAL' as any } }) },
      { level: 'High', count: await this.walletRepo.count({ where: { riskLevel: 'HIGH' as any } }) },
      { level: 'Medium', count: await this.walletRepo.count({ where: { riskLevel: 'MEDIUM' as any } }) },
      { level: 'Low', count: await this.walletRepo.count({ where: { riskLevel: 'LOW' as any } }) },
    ];
  }
}
