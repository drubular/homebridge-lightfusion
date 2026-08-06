import type { Logger } from 'homebridge';

import { LOG_PREFIX } from './settings.js';

export class LightFusionLogger {
  public constructor(private readonly logger: Logger) {}

  public info(message: string): void {
    this.logger.info(`${LOG_PREFIX} ${message}`);
  }

  public warn(message: string): void {
    this.logger.warn(`${LOG_PREFIX} ${message}`);
  }

  public error(message: string): void {
    this.logger.error(`${LOG_PREFIX} ${message}`);
  }

  public debug(message: string): void {
    this.logger.debug(`${LOG_PREFIX} ${message}`);
  }
}