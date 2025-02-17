// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { DepsLogger } from "./depsLogger";
import { DepsTelemetry } from "./depsTelemetry";
import { DepsType, DepsInfo, DepsChecker } from "./depsChecker";
import { CheckerFactory } from "./checkerFactory";
import { DepsCheckerError } from "./depsError";

export type DepsOptions = {
  fastFail?: boolean;
};

export type DependencyStatus = {
  name: string;
  type: DepsType;
  isInstalled: boolean;
  command: string;
  details: {
    isLinuxSupported: boolean;
    supportedVersions: string[];
    binFolder?: string;
  };
  error?: DepsCheckerError;
};

export class DepsManager {
  private static readonly _depsOrders = [
    DepsType.AzureNode,
    DepsType.FunctionNode,
    DepsType.SpfxNode,
    DepsType.Dotnet,
    DepsType.FuncCoreTools,
    DepsType.Ngrok,
  ];

  private readonly _logger;
  private readonly _telemetry;

  constructor(logger: DepsLogger, telemetry: DepsTelemetry) {
    if (!logger) {
      throw Error("Logger is undefined.");
    }
    if (!telemetry) {
      throw Error("Logger is undefined.");
    }

    this._logger = logger;
    this._telemetry = telemetry;
  }

  /**
   * Ensure dependencies installed.
   * Installation Orders:
   *      Node, Dotnet, FuncCoreTools, Ngrok
   * @param dependencies Dependency types. If it is empty, do nothing.
   * @param options If fastFail is false, it will continue even if one of the dependencies fails to install. Default value is true.
   */
  public async ensureDependencies(
    dependencies: DepsType[],
    { fastFail = true }: DepsOptions
  ): Promise<DependencyStatus[]> {
    if (!dependencies || dependencies.length == 0) {
      return [];
    }

    const orderedDeps: DepsType[] = this.sortBySequence(dependencies, DepsManager._depsOrders);
    const result: DependencyStatus[] = [];
    let shouldInstall = true;
    for (const type of orderedDeps) {
      const status: DependencyStatus = await this.resolve(type, shouldInstall);
      result.push(status);

      if (fastFail && !status.isInstalled) {
        shouldInstall = false;
      }
    }
    return result;
  }

  private async resolve(type: DepsType, shouldInstall: boolean): Promise<DependencyStatus> {
    const checker: DepsChecker = CheckerFactory.createChecker(type, this._logger, this._telemetry);
    let isInstalled = false;
    let error = undefined;

    if (shouldInstall) {
      const result = await checker.resolve();

      isInstalled = result.isOk() && result.value;
      error = result.isErr() ? result.error : undefined;
    }

    const depsInfo: DepsInfo = await checker.getDepsInfo();
    const binFolder = depsInfo.details.has("binFolder")
      ? depsInfo.details.get("binFolder")
      : undefined;
    return {
      name: depsInfo.name,
      type: type,
      isInstalled: isInstalled,
      command: await checker.command(),
      details: {
        isLinuxSupported: depsInfo.isLinuxSupported,
        supportedVersions: depsInfo.supportedVersions,
        binFolder: binFolder,
      },
      error: error,
    };
  }

  private sortBySequence(dependencies: DepsType[], sequence: DepsType[]): DepsType[] {
    return dependencies
      .filter((value) => value != null)
      .sort((a, b) => sequence.indexOf(a) - sequence.indexOf(b));
  }
}
