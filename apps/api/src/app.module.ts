import * as path from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { CasesModule } from './modules/cases/cases.module';
import { InvestigationsModule } from './modules/investigations/investigations.module';
import { WalletsModule } from './modules/wallets/wallets.module';
import { GraphModule } from './modules/graph/graph.module';
import { VaspModule } from './modules/vasp/vasp.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { WatchlistModule } from './modules/watchlist/watchlist.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SearchModule } from './modules/search/search.module';
import { AdminModule } from './modules/admin/admin.module';
import { HealthModule } from './modules/health/health.module';
import { BlockchainModule } from './modules/blockchain/blockchain.module';
import { BlockchainConfigModule } from './modules/blockchain-config/blockchain-config.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { QueueModule } from './modules/queue/queue.module';
import { WebSocketModule } from './modules/websocket/websocket.module';
import { Neo4jModule } from './modules/neo4j/neo4j.module';
import { RiskModule } from './modules/risk/risk.module';
import { AuditModule } from './modules/audit/audit.module';
import { FraudCampaignsModule } from './modules/fraud-campaigns/fraud-campaigns.module';
import { CrossChainTransfersModule } from './modules/cross-chain-transfers/cross-chain-transfers.module';
import { EvidenceModule } from './modules/evidence/evidence.module';
import { VerificationModule } from './modules/verification/verification.module';
import { TracingModule } from './modules/tracing/tracing.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', path.resolve(process.cwd(), '.env'), path.resolve(__dirname, '..', '..', '..', '.env')],
    }),

    // Database (Supports SQLite for zero-docker standalone execution & PostgreSQL)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const dbUrl = config.get<string>('DATABASE_URL', '');
        const dbType = config.get<string>('DATABASE_TYPE', dbUrl.startsWith('postgres') ? 'postgres' : 'sqlite');

        if (dbType === 'postgres' && dbUrl.startsWith('postgres')) {
          return {
            type: 'postgres',
            url: dbUrl,
            autoLoadEntities: true,
            synchronize: true,
            logging: config.get('NODE_ENV') === 'development',
            ssl: dbUrl.includes('supabase.com') ? { rejectUnauthorized: false } : (config.get('NODE_ENV') === 'production' ? { rejectUnauthorized: false } : false),
          };
        }

        const dbPath = config.get<string>('DATABASE_PATH', path.resolve(process.cwd(), 'chainsentinel.sqlite'));
        return {
          type: 'sqlite',
          database: dbPath,
          autoLoadEntities: true,
          synchronize: true,
          logging: false,
        };
      },
    }),

    // JWT
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET', 'super_secret_jwt_chainsentinel_dev_2026_key_for_development'),
        signOptions: { expiresIn: config.get('JWT_EXPIRATION', '15m') },
      }),
      global: true,
    }),

    // Neo4j
    Neo4jModule,

    // Features
    AuthModule,
    UsersModule,
    OrganizationsModule,
    CasesModule,
    InvestigationsModule,
    WalletsModule,
    GraphModule,
    VaspModule,
    AlertsModule,
    WatchlistModule,
    ReportsModule,
    SearchModule,
    AdminModule,
    HealthModule,
    BlockchainModule,
    BlockchainConfigModule,
    DashboardModule,
    QueueModule,
    WebSocketModule,
    RiskModule,
    AuditModule,
    FraudCampaignsModule,
    CrossChainTransfersModule,
    EvidenceModule,
    VerificationModule,
    TracingModule,
  ],
})
export class AppModule {}



