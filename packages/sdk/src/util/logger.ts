// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { name, version } from "../packageMetadata";

/**
 * Interface for customized logger.
 * @beta
 */
export interface Logger {
  /**
   * Writes to error level logging or lower.
   */
  error(message: string): void;
  /**
   * Writes to warning level logging or lower.
   */
  warn(message: string): void;
  /**
   * Writes to info level logging or lower.
   */
  info(message: string): void;
  /**
   * Writes to verbose level logging.
   */
  verbose(message: string): void;
}

/**
 * Log function for customized logging.
 * 
 * @beta
 */
export type LogFunction = (level: LogLevel, message: string) => void;

/**
 * Log level.
 *
 * @beta
 */
export enum LogLevel {
  /**
   * Show verbose, information, warning and error message.
   */
  Verbose,
  /**
   * Show information, warning and error message.
   */
  Info,
  /**
   * Show warning and error message.
   */
  Warn,
  /**
   * Show error message.
   */
  Error
}

/**
 * Update log level helper.
 *
 * @param { LogLevel } level - log level in configuration
 *
 * @beta
 */
export function setLogLevel(level: LogLevel): void {
  internalLogger.level = level;
}

/**
 * Get log level.
 *
 * @returns Log level
 *
 * @beta
 */
export function getLogLevel(): LogLevel {
  return internalLogger.level;
}

class InternalLogger {
  public level: LogLevel = LogLevel.Info;

  public customLogger: Logger | undefined;
  public customLogFunction: LogFunction | undefined;
  private defaultLogger: Logger = {
    verbose: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error
  };

  public error(message: string): void {
    this.log(LogLevel.Error, (x: Logger) => x.error, message);
  }

  public warn(message: string): void {
    this.log(LogLevel.Warn, (x: Logger) => x.warn, message);
  }

  public info(message: string): void {
    this.log(LogLevel.Info, (x: Logger) => x.info, message);
  }

  public verbose(message: string): void {
    this.log(LogLevel.Verbose, (x: Logger) => x.verbose, message);
  }

  private log(
    logLevel: LogLevel,
    logFunction: (x: Logger) => (message: string) => void,
    message: string
  ): void {
    if (message.trim() === "") {
      return;
    }
    const timestamp = new Date().toUTCString();
    const logHeader = `[${timestamp}] : ${name}@${version} : ${LogLevel[logLevel]} - `;
    const logMessage = `${logHeader}${message}`;
    if (this.level <= logLevel) {
      if (this.customLogger) {
        logFunction(this.customLogger)(logMessage);
      } else if (this.customLogFunction) {
        this.customLogFunction(logLevel, logMessage);
      } else {
        logFunction(this.defaultLogger)(logMessage);
      }
    }
  }
}

/**
 * Logger instance used internally
 *
 * @internal
 */
export const internalLogger: InternalLogger = new InternalLogger();

/**
 * Set custom logger. Use the output function if it's set. Priority is higher than setLogFunction.
 *
 * @param {Logger} logger - custom logger. If it's undefined, custom logger will be cleared.
 *
 * @beta
 */
export function setLogger(logger?: Logger): void {
  internalLogger.customLogger = logger;
}

/**
 * Set custom log function. Use the function if it's set. Priority is lower than setLogger.
 *
 * @param {LogFunction} logFunction - custom log function. If it's undefined, custom log function will be cleared.
 *
 * @beta
 */
export function setLogFunction(logFunction?: LogFunction): void {
  internalLogger.customLogFunction = logFunction;
}
