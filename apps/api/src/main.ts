import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { runAutoSeed } from './database/auto-seed';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Global prefix
  app.setGlobalPrefix('api');

  // CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  });

  // Security headers
  app.use((req: any, res: any, next: any) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    // Prevent caching of sensitive API responses
    const url = req.url || '';
    if (url.startsWith('/api/auth') || url.startsWith('/api/admin')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }

    next();
  });

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('ChainSentinel AI')
    .setDescription('Real-Time Multi-Chain Crypto Fraud Attribution & Investigation API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .addTag('Authentication', 'Login, logout, token management')
    .addTag('Cases', 'Case management and complaints')
    .addTag('Investigations', 'Blockchain investigation pipeline')
    .addTag('Wallets', 'Wallet intelligence and monitoring')
    .addTag('Graph', 'Transaction graph and fund-flow analysis')
    .addTag('VASP', 'VASP attribution and intelligence')
    .addTag('Alerts', 'Real-time alert management')
    .addTag('Watchlist', 'Wallet watchlist management')
    .addTag('Reports', 'Investigation report generation')
    .addTag('Search', 'Global intelligence search')
    .addTag('Admin', 'Administration endpoints')
    .addTag('Health', 'System health monitoring')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  // Auto seed database with default credentials & admin@sih.com
  try {
    const dataSource = app.get(DataSource);
    if (dataSource && dataSource.isInitialized) {
      await runAutoSeed(dataSource);
    }
  } catch (err: any) {
    logger.warn(`Auto-seed skipped: ${err.message}`);
  }

  const port = process.env.API_PORT || 3001;
  await app.listen(port);
  logger.log(`ChainSentinel AI API running on port ${port}`);
  logger.log(`API docs available at http://localhost:${port}/docs`);
}

bootstrap();
