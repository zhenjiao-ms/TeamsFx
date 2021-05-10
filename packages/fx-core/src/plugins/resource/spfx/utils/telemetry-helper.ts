// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Constants, TelemetryKey, TelemetryValue } from "./constants";
import { PluginContext, SystemError, UserError } from "@microsoft/teamsfx-api";

export class telemetryHelper {
  static sendSuccessEvent(
    ctx: PluginContext,
    eventName: string,
    properties: { [key: string]: string } = {},
    measurements: { [key: string]: number } = {}
  ): void {
    properties[TelemetryKey.Component] = Constants.PLUGIN_NAME;
    properties[TelemetryKey.Success] = TelemetryValue.Success;

    ctx.telemetryReporter?.sendTelemetryEvent(
      eventName,
      properties,
      measurements
    );
  }

  static sendErrorEvent(
    ctx: PluginContext,
    eventName: string,
    e: SystemError | UserError,
    properties: { [key: string]: string } = {},
    measurements: { [key: string]: number } = {}
  ): void {
    properties[TelemetryKey.Component] = Constants.PLUGIN_NAME;
    properties[TelemetryKey.Success] = TelemetryValue.Fail;

    if (e instanceof SystemError) {
      properties[TelemetryKey.ErrorType] = TelemetryValue.SystemError;
    } else if (e instanceof UserError) {
      properties[TelemetryKey.ErrorType] = TelemetryValue.UserError;
    }
    properties[TelemetryKey.ErrorMessage] = e.message;

    ctx.telemetryReporter?.sendTelemetryEvent(
      eventName,
      properties,
      measurements
    );
  }
}
