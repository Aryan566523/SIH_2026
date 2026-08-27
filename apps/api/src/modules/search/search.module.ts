import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { Case } from '../../database/entities/case.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { VASP } from '../../database/entities/vasp.entity';
import { NormalizedTransaction } from '../../database/entities/normalized-transaction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Case, Wallet, VASP, NormalizedTransaction])],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
