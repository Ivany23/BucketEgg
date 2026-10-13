import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import './common/bigint-json.js';
import { PortugueseValidationPipe } from './common/validation-pt.js';

/**
 * Configuração partilhada entre o arranque real (main.ts) e os testes e2e,
 * para que os testes exercitem exatamente o mesmo pipeline de validação.
 */
export function setupApp(app: INestApplication) {
  const config = app.get(ConfigService);

  // Atrás de um balanceador o IP real do cliente vem em X-Forwarded-For.
  const trustProxy = config.get<string>('TRUST_PROXY');
  (app as NestExpressApplication).set(
    'trust proxy',
    trustProxy === 'true' ? true : trustProxy === 'false' ? false : /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy,
  );
  app.use(helmet());
  // gzip nas respostas JSON/CSV: muito menos dados em redes móveis lentas.
  // Ficheiros XLSX já são comprimidos e são ignorados automaticamente.
  app.use(compression({ threshold: 1024 }));
  app.enableCors({
    origin: config.get<string>('CORS_ORIGINS').split(',').map((o) => o.trim()),
    credentials: true,
    // O frontend lê o nome do ficheiro exportado (XLSX/CSV) neste cabeçalho.
    exposedHeaders: ['Content-Disposition'],
  });
  app.useGlobalPipes(
    new PortugueseValidationPipe({
      whitelist: true, // remove campos não declarados nos DTOs (evita mass-assignment)
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();

  const doc = new DocumentBuilder()
    .setTitle('BucketEgg Route-to-Market API')
    .setDescription(
      'API multi-tenant de automação de força de vendas (inspirada no Beatroute).\n\n' +
        '**Fluxo:** `POST /auth/register` → (se `needsOnboarding`) `POST /organizations` → ' +
        '`POST /projects` → lojas, beats, rotas, visitas, encomendas e dashboard.\n\n' +
        'Use o botão **Authorize** com o `access_token` devolvido no login.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, doc), {
    jsonDocumentUrl: 'docs/openapi.json',
    swaggerOptions: { persistAuthorization: true },
  });
}
