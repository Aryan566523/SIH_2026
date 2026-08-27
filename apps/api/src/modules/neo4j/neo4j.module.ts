import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Neo4jService } from './neo4j.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: Neo4jService,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const neo4j = require('neo4j-driver');
        const driver = neo4j.driver(
          config.get('NEO4J_URI', 'bolt://localhost:7687'),
          neo4j.auth.basic(
            config.get('NEO4J_USER', 'neo4j'),
            config.get('NEO4J_PASSWORD', 'chainsentinel_dev_2026'),
          ),
        );
        return new Neo4jService(driver);
      },
    },
  ],
  exports: [Neo4jService],
})
export class Neo4jModule {}
