// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import * as vscode from "vscode";
import Reporter from "vscode-extension-telemetry";
import { TelemetryReporter } from "@microsoft/teamsfx-api";
import { getPackageVersion } from "../utils/commonUtils";

/**
 *  VSCode telemetry reporter used by fx-core.
 *  Usage:
 *    let reporter = new VSCodeTelemetryReporter(key, extensionVersion, extensionId)
 *  Illustrate:
 *    key = <'the application insights key'>, 'aiKey' in package.json
 *    extensionVersion = '<extension version>', extension version will be reported as a property with each event
 *    extensionId = '<your extension unique name>', all events will be prefixed with this event name. eg: 'extensionId/eventname'
 */
export class VSCodeTelemetryReporter extends vscode.Disposable implements TelemetryReporter {
  private readonly reporter: Reporter;
  private readonly extVersion: string;

  constructor(key: string, extensionVersion: string, extensionId: string) {
    super(() => this.reporter.dispose());
    this.reporter = new Reporter(extensionId, extensionVersion, key, true);
    this.extVersion = getPackageVersion(extensionVersion);
  }

  sendTelemetryErrorEvent(
    eventName: string,
    properties?: { [p: string]: string },
    measurements?: { [p: string]: number },
    errorProps?: string[]
  ): void {
    this.reporter.sendTelemetryErrorEvent(eventName, properties, measurements, errorProps);
  }

  sendTelemetryEvent(
    eventName: string,
    properties?: { [p: string]: string },
    measurements?: { [p: string]: number }
  ): void {
    this.reporter.sendTelemetryEvent(eventName, properties, measurements);
  }

  sendTelemetryException(
    error: Error,
    properties?: { [p: string]: string },
    measurements?: { [p: string]: number }
  ): void {
    this.reporter.sendTelemetryException(error, properties, measurements);
  }
}
