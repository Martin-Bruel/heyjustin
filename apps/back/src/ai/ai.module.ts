import { AiModule as NestAiModule } from '@nestjs/ai';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AI_LOG_EVENTS } from './ai-log-events.js';
import { AI_MODELS } from './ai-models.js';
import { createModelFactory } from './ai-providers.js';
import { type AiConfig, aiConfig } from './ai.config.js';
import { DocumentReaderService } from './document-reader.service.js';

/**
 * Language models for the app, through @nestjs/ai. Technical module: it knows
 * the providers, never the business (prompts and schemas belong to the
 * modules that call it). Exports task-level services (DocumentReaderService),
 * not the raw AiService: what is sent to the model and how its failures are
 * reported stays here.
 */
@Module({
  imports: [
    NestAiModule.forRootAsync({
      imports: [ConfigModule.forFeature(aiConfig)],
      inject: [aiConfig.KEY],
      useFactory: (config: AiConfig) => {
        const logger = new Logger('AiModule');
        return {
          models: {
            [AI_MODELS.extraction]: createModelFactory(config)(
              config.extractionModel,
            ),
          },
          defaults: {
            timeout: '60s',
            retry: { attempts: 3 },
            // a receipt is a few thousand tokens: this only stops a runaway call
            budget: { maxTokens: 50_000 },
          },
          // usage only (tokens, duration, model): prompts and answers hold customers' data
          onUsage: (event) =>
            logger.log('AI model called', {
              event: AI_LOG_EVENTS.modelCalled,
              label: event.label,
              provider: event.model.provider,
              modelId: event.model.modelId,
              step: event.step,
              attempt: event.attempt,
              fallback: event.fallback,
              inputTokens: event.usage.inputTokens,
              outputTokens: event.usage.outputTokens,
              reasoningTokens: event.usage.reasoningTokens,
              durationMs: event.durationMs,
              finishReason: event.finishReason,
            }),
          // no agent functions (tools) in this app: nothing to scan
          include: [],
        };
      },
    }),
  ],
  providers: [DocumentReaderService],
  exports: [DocumentReaderService],
})
export class AiModule {}
