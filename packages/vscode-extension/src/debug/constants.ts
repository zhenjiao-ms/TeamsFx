// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export const frontendStartCommand = "frontend start";
export const backendStartCommand = "backend start";
export const authStartCommand = "auth start";
export const ngrokStartCommand = "ngrok start";
export const botStartCommand = "bot start";
export const openWenClientCommand = "launch Teams web client";
export const backendWatchCommand = "backend watch";

export const frontendProblemMatcher = "$teamsfx-frontend-watch";
export const backendProblemMatcher = "$teamsfx-backend-watch";
export const authProblemMatcher = "$teamsfx-auth-watch";
export const ngrokProblemMatcher = "$teamsfx-ngrok-watch";
export const botProblemMatcher = "$teamsfx-bot-watch";
export const tscWatchProblemMatcher = "$tsc-watch";

export const frontendFolderName = "tabs";
export const backendFolderName = "api";
export const botFolderName = "bot";

export const localEnvFileName = "local.env";
export const manifestFileName = "manifest.source.json";
export const userDataFileName = "default.userdata"; // TODO: different file name for different environment

export const frontendLocalEnvPrefix = "FRONTEND_";
export const backendLocalEnvPrefix = "BACKEND_";
export const authLocalEnvPrefix = "AUTH_";
export const authServicePathEnvKey = "AUTH_SERVICE_PATH";
export const botLocalEnvPrefix = "BOT_";

export enum ProgrammingLanguage {
  javascript = "javascript",
  typescript = "typescript"
}

export const skipNgrokConfigKey = "fx-resource-local-debug.skipNgrok";

const allAddress = "*"; // use * to represent 0.0.0.0 (IPV4)and :: (IPv6) for simplicity
const loopbackAddress = "127.0.0.1";

export const frontendPorts: [string, number][] = [[allAddress, 3000], [allAddress, 5000]];
export const backendPorts: [string, number][] = [[allAddress, 7071], [loopbackAddress, 9229]];
export const botPorts: [string, number][] = [[allAddress, 3978], [loopbackAddress, 9239]];

export const portsInUseMessage = "The following ports are already in use by other processes, please close these processes and try again";
