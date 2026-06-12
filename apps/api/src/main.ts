import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000' });

  const config = new DocumentBuilder()
    .setTitle('LMS Provana API')
    .setDescription('Learning Management & Professional Growth Platform — modular monolith')
    .setVersion('0.1.0')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  console.log(`API on http://localhost:${port} (docs at /docs, dev personas at /dev/personas)`);
}

void bootstrap();
