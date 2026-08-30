import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';
import { Organization } from './entities/organization.entity';
import { Session } from './entities/session.entity';
import { Case } from './entities/case.entity';
import { Complaint } from './entities/complaint.entity';
import { Investigation } from './entities/investigation.entity';
import { InvestigationJob } from './entities/investigation-job.entity';
import { Wallet } from './entities/wallet.entity';
import { NormalizedTransaction } from './entities/normalized-transaction.entity';
import { VASP } from './entities/vasp.entity';
import { Alert } from './entities/alert.entity';
import { WatchlistEntry } from './entities/watchlist.entity';
import { RiskAssessment } from './entities/risk-assessment.entity';
import { WalletCluster } from './entities/wallet-cluster.entity';
import { AuditLog } from './entities/audit-log.entity';
import { Report } from './entities/report.entity';
import { CrossChainTransfer } from './entities/cross-chain-transfer.entity';

const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL || 'postgresql://chainsentinel:chainsentinel_dev_2026@localhost:5432/chainsentinel',
  entities: [
    User, Organization, Case, Complaint, Investigation, InvestigationJob,
    Session, Wallet, NormalizedTransaction, VASP, Alert, WatchlistEntry, RiskAssessment,
    WalletCluster, AuditLog, Report, CrossChainTransfer,
  ],
  synchronize: true,
  logging: false,
});

async function createAdmin() {
  await dataSource.initialize();
  console.log('Database connected.');

  const orgRepo = dataSource.getRepository(Organization);
  const userRepo = dataSource.getRepository(User);

  let org = await orgRepo.findOne({ where: { code: 'CCIU' } });
  if (!org) {
    org = orgRepo.create({
      name: 'Cyber Crime Investigation Unit',
      code: 'CCIU',
      isActive: true,
      settings: { theme: 'dark', notifications: true },
    });
    await orgRepo.save(org);
    console.log(`Organization created: ${org.id}`);
  }

  const email = 'admin@sih.com';
  const password = 'Admin@123';
  const passwordHash = await bcrypt.hash(password, 12);

  let user = await userRepo.findOne({ where: { email } });
  if (user) {
    user.passwordHash = passwordHash;
    user.role = 'SUPER_ADMIN' as any;
    user.isActive = true;
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    await userRepo.save(user);
    console.log(`✅ User ${email} updated successfully with Super Admin role!`);
  } else {
    user = userRepo.create({
      email,
      firstName: 'SIH',
      lastName: 'Admin',
      passwordHash,
      role: 'SUPER_ADMIN' as any,
      organizationId: org.id,
      isActive: true,
    });
    await userRepo.save(user);
    console.log(`✅ User ${email} created successfully with Super Admin role!`);
  }

  console.log(`Credentials:`);
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log(`  Role:     SUPER_ADMIN`);

  await dataSource.destroy();
}

createAdmin().catch((err) => {
  console.error('Error creating admin account:', err);
  process.exit(1);
});
