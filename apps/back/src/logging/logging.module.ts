import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { type AppConfig, appConfig } from '../config/index.js';
import { ClsModule } from 'nestjs-cls';
import { AppLogger } from './app-logger.js';
import { IdentifierHasher } from './identifier-hasher.js';
import { loggingConfig } from './logging.config.js';

/**
 * Logging: stdout logger (readable or JSON), per-flow log context
 * (nestjs-cls), identifier hashing.
 * Technical, knows no business concept. Global: logging is used everywhere.
 *
 * The logger is set in main.ts (`app.useLogger(app.get(AppLogger))`).
 */
@Global()
@Module({
  // no middleware/interceptor mounted: contexts are opened with runInLogContext() at entry points
  imports: [
    ClsModule.forRoot({ global: true }),
    ConfigModule.forFeature(loggingConfig),
  ],
  providers: [
    {
      provide: AppLogger,
      // JSON for Loki in production, Nest's readable format elsewhere
      useFactory: (appConfig: AppConfig) =>
        new AppLogger(appConfig.isProduction ? 'json' : 'pretty'),
      inject: [appConfig.KEY],
    },
    IdentifierHasher,
  ],
  exports: [AppLogger, IdentifierHasher],
})
export class LoggingModule {}
