import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { appConfig } from './config/index.js';
import { LoggingModule } from './logging/index.js';
import { TicketsModule } from './tickets/index.js';

@Module({
  imports: [
    // reads .env into process.env; each module validates its own namespace
    // (ConfigModule.forFeature), appConfig is shared by everyone
    ConfigModule.forRoot({ isGlobal: true, load: [appConfig] }),
    LoggingModule,
    TicketsModule,
  ],
})
export class AppModule {}
