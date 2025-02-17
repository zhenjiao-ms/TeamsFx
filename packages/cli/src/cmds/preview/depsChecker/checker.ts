// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// NOTE:
// DO NOT EDIT this file in function plugin.
// The source of truth of this file is in packages/vscode-extension/src/debug/depsChecker.
// If you need to edit this file, please edit it in the above folder
// and run the scripts (tools/depsChecker/copyfiles.sh or tools/depsChecker/copyfiles.ps1 according to your OS)
// to copy you changes to function plugin.

import { isLinux, Messages, defaultHelpLink, DepsCheckerEvent } from "./common";
import { DepsCheckerError, NodeNotFoundError, NodeNotSupportedError } from "./errors";

export interface IDepsChecker {
  isEnabled(): Promise<boolean>;
  isInstalled(): Promise<boolean>;
  install(): Promise<void>;
  getDepsInfo(): Promise<DepsInfo>;
}

export interface IDepsAdapter {
  displayLearnMore: (message: string, link: string) => Promise<boolean>;
  displayWarningMessage: (
    message: string,
    buttonText: string,
    action: () => Promise<boolean>
  ) => Promise<boolean>;
  showOutputChannel: () => void;

  hasTeamsfxBackend(): Promise<boolean>;
  hasTeamsfxBot(): Promise<boolean>;
  dotnetCheckerEnabled(): Promise<boolean>;
  funcToolCheckerEnabled(): Promise<boolean>;
  ngrokCheckerEnabled(): Promise<boolean>;
  nodeCheckerEnabled(): Promise<boolean>;
  runWithProgressIndicator(callback: () => Promise<void>): Promise<void>;
  getResourceDir(): string;
}

export interface IDepsLogger {
  debug(message: string): Promise<boolean>;
  info(message: string): Promise<boolean>;
  warning(message: string): Promise<boolean>;
  error(message: string): Promise<boolean>;

  printDetailLog(): Promise<void>;
  cleanup(): void;
}

export interface IDepsTelemetry {
  sendEvent(
    eventName: DepsCheckerEvent,
    properties?: { [p: string]: string },
    timecost?: number
  ): void;
  sendEventWithDuration(eventName: DepsCheckerEvent, action: () => Promise<void>): Promise<void>;
  sendUserErrorEvent(eventName: DepsCheckerEvent, errorMessage: string): void;
  sendSystemErrorEvent(eventName: DepsCheckerEvent, errorMessage: string, errorStack: string): void;
}

export interface DepsInfo {
  name: string;
  installVersion?: string;
  supportedVersions: string[];
  details: Map<string, string>;
}

export class DepsChecker {
  private readonly _adapter: IDepsAdapter;
  private readonly _logger: IDepsLogger;
  private readonly _checkers: Array<IDepsChecker>;

  constructor(logger: IDepsLogger, adapter: IDepsAdapter, checkers: Array<IDepsChecker>) {
    this._logger = logger;
    this._adapter = adapter;
    this._checkers = checkers;
  }

  // check & install
  public async resolve(): Promise<boolean> {
    const shouldContinue = true;

    const validCheckers = await this.check();

    // stop the process when validChecker is null.
    if (validCheckers === null) {
      return !shouldContinue;
    }

    // go to next step when no need to check.
    if (validCheckers.length === 0) {
      this._logger.cleanup();
      return shouldContinue;
    }

    if (isLinux()) {
      const confirmMessage = await this.generateMsg(validCheckers);
      this._logger.cleanup();
      return await this._adapter.displayLearnMore(confirmMessage, defaultHelpLink);
    }

    this._adapter.showOutputChannel();
    for (const checker of validCheckers) {
      try {
        await checker.install();
      } catch (error) {
        await this._logger.printDetailLog();
        this._logger.cleanup();
        await this._logger.error(
          `Failed to install '${checker.constructor.name}', error = '${error}'`
        );
        const continueNext = await this.handleError(error);
        if (!continueNext) {
          return !shouldContinue;
        }
      }
    }
    this._logger.cleanup();

    return shouldContinue;
  }

  private async check(): Promise<Array<IDepsChecker> | null> {
    const validCheckers = new Array<IDepsChecker>();
    for (const checker of this._checkers) {
      try {
        if ((await checker.isEnabled()) && !(await checker.isInstalled())) {
          validCheckers.push(checker);
        }
      } catch (error) {
        await this._logger.debug(
          `Failed to check '${checker.constructor.name}', error = '${error}'`
        );
        const continueNext = await this.handleError(error);
        if (!continueNext) {
          return null;
        }
      }
    }
    return validCheckers;
  }

  private async generateMsg(checkers: Array<IDepsChecker>): Promise<string> {
    const supportedPackages = [];
    for (const checker of checkers) {
      const info = await checker.getDepsInfo();
      const supportedVersions = info.supportedVersions.map((version) => "v" + version).join(" or ");
      const supportedPackage = `${info.name} (${supportedVersions})`;
      supportedPackages.push(supportedPackage);
    }
    const supportedMessage = supportedPackages.join(" and ");
    return Messages.linuxDepsNotFound.split("@SupportedPackages").join(supportedMessage);
  }

  private async handleError(error: Error): Promise<boolean> {
    return DepsChecker.handleErrorWithDisplay(error, this._adapter);
  }

  public static async handleErrorWithDisplay(
    error: Error,
    adapter: IDepsAdapter
  ): Promise<boolean> {
    if (error instanceof NodeNotSupportedError) {
      return await adapter.displayLearnMore(
        error.message,
        (error as NodeNotSupportedError).helpLink
      );
    } else if (error instanceof NodeNotFoundError) {
      return await adapter.displayLearnMore(error.message, (error as NodeNotFoundError).helpLink);
    } else if (error instanceof DepsCheckerError) {
      return await adapter.displayLearnMore(error.message, (error as DepsCheckerError).helpLink);
    } else {
      return await adapter.displayLearnMore(Messages.defaultErrorMessage, defaultHelpLink);
    }
  }
}
