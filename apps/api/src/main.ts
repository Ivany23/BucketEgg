import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { Server } from 'node:http';
import { AppModule } from './app.module.js';
import { setupApp } from './setup-app.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  setupApp(app);

  const server: Server = app.getHttpServer();
  // Uploads de centenas de MB em redes móveis podem demorar: o Node corta pedidos aos 5 min por defeito.
  server.requestTimeout = 60 * 60_000;
  // Maior que o tempo de inatividade típico dos balanceadores (60 s), evita erros 502 intermitentes.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  const port = app.get(ConfigService).get<number>('PORT');
  await app.listen(port);
  Logger.log(`API em http://localhost:${port} — documentação em http://localhost:${port}/docs`, 'Bootstrap');
}
await bootstrap();
