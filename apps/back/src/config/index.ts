/** Public API of the config module: other modules import from here only. */
export { type AppConfig, appConfig } from './app.config.js';
export { InvalidConfigError, validatedConfig } from './validated-config.js';
