/** Public API of the config module: other modules import from here only. */
export { type AppConfig, appConfig } from './app.config.js';
export {
  DEFAULT_EDITION,
  type Edition,
  EDITIONS,
  refusedIn,
  withEdition,
} from './edition.js';
export { InvalidConfigError, validatedConfig } from './validated-config.js';
