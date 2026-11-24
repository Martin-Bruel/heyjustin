import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { type AppConfig, appConfig } from './config/index.js';
import { AppLogger } from './logging/index.js';

async function bootstrap() {
  // logs emitted while the app starts are buffered, then printed by AppLogger
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(AppLogger));
  // run onApplicationShutdown on SIGTERM/SIGINT (e.g. closes the Discord connection)
  app.enableShutdownHooks();
  await app.listen(app.get<AppConfig>(appConfig.KEY).port);
}
await bootstrap();
