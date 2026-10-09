import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 全局前缀：前端请求统一带 /api 前缀，这里补上，controller 内不再重复写 /api
  app.setGlobalPrefix('api');

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );

  // 静态目录（应用内 /uploads 由 app.module ServeStaticModule 处理，这里为绝对路径兜底）
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  const port = parseInt(process.env.PORT || '3000', 10);
  await app.listen(port, '0.0.0.0');
  console.log(`[wx-server] listening on http://0.0.0.0:${port}`);
}

bootstrap().catch((err) => {
  console.error('[wx-server] bootstrap failed:', err);
  process.exit(1);
});