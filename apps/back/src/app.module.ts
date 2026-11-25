import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CompaniesModule } from './companies/index.js';
import { appConfig } from './config/index.js';
import { LoggingModule } from './logging/index.js';
import { TicketsModule } from './tickets/index.js';

@Module({
  imports: [
    // reads .env into process.env; each module validates its own namespace
    // (ConfigModule.forFeature), appConfig is shared by everyone
    ConfigModule.forRoot({ isGlobal: true, load: [appConfig] }),
    LoggingModule,
    // creates the default company at startup when PENNYLANE_API_TOKEN is set
    CompaniesModule,
    TicketsModule,
  ],
})
export class AppModule {}
