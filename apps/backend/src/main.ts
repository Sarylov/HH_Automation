import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.setGlobalPrefix('api');

  const port = Number(process.env.PORT ?? 3000);
  // Bind loopback explicitly so a second process on 127.0.0.1:PORT fails loud
  // (Windows can otherwise split 0.0.0.0 vs 127.0.0.1 listeners).
  const host = process.env.HOST ?? '127.0.0.1';
  await app.listen(port, host);
}

void bootstrap();
