// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
"use strict";

import * as fs from "fs-extra";
import { Func, FxError, Platform, Plugin, PluginContext, Result, err, ok, VsCodeEnv, AzureSolutionSettings } from "@microsoft/teamsfx-api";
import * as os from "os";

import { LocalCertificateManager } from "./certificate";
import { AadPlugin, FunctionPlugin, RuntimeConnectorPlugin, SpfxPlugin, SolutionPlugin, FrontendHostingPlugin, BotPlugin, LocalEnvBotKeys } from "./constants";
import { LocalDebugConfigKeys, LocalEnvFrontendKeys, LocalEnvBackendKeys, LocalEnvAuthKeys, LocalEnvCertKeys } from "./constants";
import * as Launch from "./launch";
import * as Settings from "./settings";
import * as Tasks from "./tasks";
import { LocalEnvProvider } from "./localEnv";
import { LocalBotEndpointNotConfigured, MissingStep, NgrokTunnelNotConnected, InvalidLocalBotEndpointFormat } from "./util/error";
import { prepareLocalAuthService } from "./util/localService";
import { getNgrokHttpUrl } from "./util/ngrok";
import { getCodespaceName, getCodespaceUrl } from "./util/codespace";
import { TelemetryUtils, TelemetryEventName } from "./util/telemetry";

export class LocalDebugPlugin implements Plugin {

    public async scaffold(ctx: PluginContext): Promise<Result<any, FxError>> {
        const selectedPlugins = (ctx.projectSettings?.solutionSettings as AzureSolutionSettings)?.activeResourcePlugins;
        const isSpfx = selectedPlugins?.some((pluginName) => pluginName === SpfxPlugin.Name);
        const includeFrontend = selectedPlugins?.some((pluginName) => pluginName === FrontendHostingPlugin.Name);
        const includeBackend = selectedPlugins?.some((pluginName) => pluginName === FunctionPlugin.Name);
        const includeBot = selectedPlugins?.some((pluginName) => pluginName === BotPlugin.Name);
        const programmingLanguage: string = ctx.configOfOtherPlugins?.get(SolutionPlugin.Name)?.get(SolutionPlugin.ProgrammingLanguage) as string;

        const telemetryProperties = {
            platform: ctx.platform as string,
            spfx: isSpfx ? "true" : "false",
            frontend: includeFrontend ? "true" : "false",
            function: includeBackend ? "true" : "false",
            bot: includeBot ? "true" : "false",
            "programming-language": programmingLanguage,
        }
        TelemetryUtils.init(ctx);
        TelemetryUtils.sendStartEvent(TelemetryEventName.scaffold, telemetryProperties);

        // scaffold for both vscode and cli
        if (ctx.platform === Platform.VSCode || ctx.platform === Platform.CLI)
        {
            if (isSpfx) {
                // Only generate launch.json and tasks.json for SPFX
                const launchConfigurations = Launch.generateSpfxConfigurations();
                const tasks = Tasks.generateSpfxTasks();
                const tasksInputs = Tasks.generateInputs();

                //TODO: save files via context api
                await fs.ensureDir(`${ctx.root}/.vscode/`);
                await fs.writeJSON(
                    `${ctx.root}/.vscode/launch.json`, {
                        version: "0.2.0",
                        configurations: launchConfigurations
                    }, {
                        spaces: 4,
                        EOL: os.EOL
                    });

                await fs.writeJSON(
                    `${ctx.root}/.vscode/tasks.json`, {
                        version: "2.0.0",
                        tasks: tasks,
                        inputs: tasksInputs
                    }, {
                        spaces: 4,
                        EOL: os.EOL
                    });

            } else {
                const launchConfigurations = Launch.generateConfigurations(includeFrontend, includeBackend, includeBot);
                const launchCompounds = Launch.generateCompounds(includeFrontend, includeBackend, includeBot);

                const tasks = Tasks.generateTasks(includeFrontend, includeBackend, includeBot, programmingLanguage);

                const localEnvProvider = new LocalEnvProvider(ctx.root);

                //TODO: save files via context api
                await fs.ensureDir(`${ctx.root}/.vscode/`);
                await fs.writeJSON(
                    `${ctx.root}/.vscode/launch.json`, {
                        version: "0.2.0",
                        configurations: launchConfigurations,
                        compounds: launchCompounds
                    }, {
                        spaces: 4,
                        EOL: os.EOL
                    });

                await fs.writeJSON(
                    `${ctx.root}/.vscode/tasks.json`, {
                        version: "2.0.0",
                        tasks: tasks
                    }, {
                        spaces: 4,
                        EOL: os.EOL
                    });

                await localEnvProvider.saveLocalEnv(localEnvProvider.initialLocalEnvs(includeFrontend, includeBackend, includeBot));

                if (includeFrontend) {
                    ctx.config.set(LocalDebugConfigKeys.TrustDevelopmentCertificate, "true");
                }

                if (includeBackend) {
                    await fs.writeJSON(
                        `${ctx.root}/.vscode/settings.json`, Settings.generateSettings(), {
                            spaces: 4,
                            EOL: os.EOL
                        });
                }

                if (includeBot) {
                    ctx.config.set(LocalDebugConfigKeys.SkipNgrok, "false");
                    ctx.config.set(LocalDebugConfigKeys.LocalBotEndpoint, "");
                }
            }
        }

        TelemetryUtils.sendSuccessEvent(TelemetryEventName.scaffold, telemetryProperties);
        return ok(undefined);
    }

    public async localDebug(ctx: PluginContext): Promise<Result<any, FxError>> {
        const vscEnv = ctx.answers?.getString("vscenv");
        const includeFrontend = ctx.configOfOtherPlugins?.has(FrontendHostingPlugin.Name);
        const includeBackend = ctx.configOfOtherPlugins?.has(FunctionPlugin.Name);
        const includeBot = ctx.configOfOtherPlugins?.has(BotPlugin.Name);
        const skipNgrok = ctx.config?.get(LocalDebugConfigKeys.SkipNgrok) as string;

        const telemetryProperties = {
            platform: ctx.platform as string,
            vscenv: vscEnv as string,
            frontend: includeFrontend ? "true" : "false",
            function: includeBackend ? "true" : "false",
            bot: includeBot ? "true" : "false",
            "skip-ngrok": skipNgrok,
        }
        TelemetryUtils.init(ctx);
        TelemetryUtils.sendStartEvent(TelemetryEventName.localDebug, telemetryProperties);

        // setup configs used by other plugins
        // TODO: dynamicly determine local ports
        if (ctx.platform === Platform.VSCode)
        {
            let localTabEndpoint: string;
            let localTabDomain: string;
            let localAuthEndpoint: string;
            let localFuncEndpoint: string;

            if (vscEnv === VsCodeEnv.codespaceBrowser || vscEnv === VsCodeEnv.codespaceVsCode) {
                const codespaceName = await getCodespaceName();

                localTabEndpoint = getCodespaceUrl(codespaceName, 3000);
                localTabDomain = (new URL(localTabEndpoint)).host;
                localAuthEndpoint =  getCodespaceUrl(codespaceName, 5000);
                localFuncEndpoint =  getCodespaceUrl(codespaceName, 7071);
            } else {
                localTabDomain = "localhost";
                localTabEndpoint = "https://localhost:3000";
                localAuthEndpoint = "http://localhost:5000";
                localFuncEndpoint = "http://localhost:7071";
            }

            ctx.config.set(LocalDebugConfigKeys.LocalAuthEndpoint, localAuthEndpoint);

            if (includeFrontend) {
                ctx.config.set(LocalDebugConfigKeys.LocalTabEndpoint, localTabEndpoint);
                ctx.config.set(LocalDebugConfigKeys.LocalTabDomain, localTabDomain);
            }

            if (includeBackend)
            {
                ctx.config.set(LocalDebugConfigKeys.LocalFunctionEndpoint, localFuncEndpoint);
            }

            if (includeBot) {
                if (skipNgrok?.trim().toLowerCase() === "true") {
                    const localBotEndpoint = ctx.config.get(LocalDebugConfigKeys.LocalBotEndpoint) as string;
                    if (localBotEndpoint === undefined) {
                        const error = LocalBotEndpointNotConfigured();
                        TelemetryUtils.sendErrorEvent(TelemetryEventName.localDebug, error);
                        return err(error);
                    }
                    const botEndpointRegex = /https:\/\/.*(:\d+)?/g;
                    if (!botEndpointRegex.test(localBotEndpoint)) {
                        const error = InvalidLocalBotEndpointFormat(localBotEndpoint);
                        TelemetryUtils.sendErrorEvent(TelemetryEventName.localDebug, error);
                        return err(error);
                    }
                    ctx.config.set(LocalDebugConfigKeys.LocalBotEndpoint, localBotEndpoint);
                    ctx.config.set(LocalDebugConfigKeys.LocalBotDomain, localBotEndpoint.slice(8));
                } else {
                    const ngrokHttpUrl = await getNgrokHttpUrl(3978);
                    if (!ngrokHttpUrl) {
                        const error = NgrokTunnelNotConnected();
                        TelemetryUtils.sendErrorEvent(TelemetryEventName.localDebug, error);
                        return err(error);
                    } else {
                        ctx.config.set(LocalDebugConfigKeys.LocalBotEndpoint, ngrokHttpUrl);
                        ctx.config.set(LocalDebugConfigKeys.LocalBotDomain, ngrokHttpUrl.slice(8));
                    }
                }
            }
        }

        TelemetryUtils.sendSuccessEvent(TelemetryEventName.localDebug, telemetryProperties);
        return ok(undefined);
    }

    public async postLocalDebug(ctx: PluginContext): Promise<Result<any, FxError>> {
        const includeFrontend = ctx.configOfOtherPlugins?.has(FrontendHostingPlugin.Name);
        const includeBackend = ctx.configOfOtherPlugins?.has(FunctionPlugin.Name);
        const includeBot = ctx.configOfOtherPlugins?.has(BotPlugin.Name);
        const trustDevCert = ctx.config?.get(LocalDebugConfigKeys.TrustDevelopmentCertificate) as string;

        const telemetryProperties = {
            platform: ctx.platform as string,
            frontend: includeFrontend ? "true" : "false",
            function: includeBackend ? "true" : "false",
            bot: includeBot ? "true" : "false",
            "trust-development-certificate": trustDevCert,
        }
        TelemetryUtils.init(ctx);
        TelemetryUtils.sendStartEvent(TelemetryEventName.postLocalDebug, telemetryProperties);

        if (ctx.platform === Platform.VSCode)
        {
            const includeFrontend = ctx.configOfOtherPlugins.has(FrontendHostingPlugin.Name);
            const includeBackend = ctx.configOfOtherPlugins.has(FunctionPlugin.Name);
            const includeBot = ctx.configOfOtherPlugins.has(BotPlugin.Name);

            const localEnvProvider = new LocalEnvProvider(ctx.root);
            const localEnvs = await localEnvProvider.loadLocalEnv(includeFrontend, includeBackend, includeBot);

            // configs
            const localDebugConfigs = ctx.config;
            const aadConfigs = ctx.configOfOtherPlugins.get(AadPlugin.Name);
            const runtimeConnectorConfigs = ctx.configOfOtherPlugins.get(RuntimeConnectorPlugin.Name);
            const solutionConfigs = ctx.configOfOtherPlugins.get(SolutionPlugin.Name);
            const clientId = aadConfigs?.get(AadPlugin.LocalClientId) as string;
            const clientSecret = aadConfigs?.get(AadPlugin.LocalClientSecret) as string;
            const teamsAppTenantId = solutionConfigs?.get(SolutionPlugin.TeamsAppTenantId) as string;
            const teamsMobileDesktopAppId = aadConfigs?.get(AadPlugin.TeamsMobileDesktopAppId) as string;
            const teamsWebAppId = aadConfigs?.get(AadPlugin.TeamsWebAppId) as string;
            const localAuthPackagePath = runtimeConnectorConfigs?.get(RuntimeConnectorPlugin.FilePath) as string;

            if (includeFrontend) {
                // frontend local envs
                localEnvs[LocalEnvFrontendKeys.TeamsFxEndpoint] = localDebugConfigs.get(LocalDebugConfigKeys.LocalAuthEndpoint) as string;
                localEnvs[LocalEnvFrontendKeys.LoginUrl] = `${localDebugConfigs.get(LocalDebugConfigKeys.LocalTabEndpoint) as string}/auth-start.html`;
                localEnvs[LocalEnvFrontendKeys.ClientId] = clientId;

                // auth local envs (auth is only required by frontend)
                localEnvs[LocalEnvAuthKeys.ClientId] = clientId;
                localEnvs[LocalEnvAuthKeys.ClientSecret] = clientSecret;
                localEnvs[LocalEnvAuthKeys.IdentifierUri] = aadConfigs?.get(AadPlugin.LocalAppIdUri) as string;
                localEnvs[LocalEnvAuthKeys.AadMetadataAddress] = `https://login.microsoftonline.com/${teamsAppTenantId}/v2.0/.well-known/openid-configuration`;
                localEnvs[LocalEnvAuthKeys.OauthAuthority] = `https://login.microsoftonline.com/${teamsAppTenantId}`;
                localEnvs[LocalEnvAuthKeys.TabEndpoint] = localDebugConfigs.get(LocalDebugConfigKeys.LocalTabEndpoint) as string;
                localEnvs[LocalEnvAuthKeys.AllowedAppIds] = [teamsMobileDesktopAppId, teamsWebAppId].join(";");
                localEnvs[LocalEnvAuthKeys.ServicePath] = await prepareLocalAuthService(localAuthPackagePath);

                if (includeBackend) {
                    localEnvs[LocalEnvFrontendKeys.FuncEndpoint] = localDebugConfigs.get(LocalDebugConfigKeys.LocalFunctionEndpoint) as string;
                    localEnvs[LocalEnvFrontendKeys.FuncName] = ctx.configOfOtherPlugins.get(FunctionPlugin.Name)?.get(FunctionPlugin.DefaultFunctionName) as string;

                    // function local envs
                    localEnvs[LocalEnvBackendKeys.ClientId] = clientId;
                    localEnvs[LocalEnvBackendKeys.ClientSecret] = clientSecret;
                    localEnvs[LocalEnvBackendKeys.AuthorityHost] = "https://login.microsoftonline.com";
                    localEnvs[LocalEnvBackendKeys.TenantId] = teamsAppTenantId;
                    localEnvs[LocalEnvBackendKeys.ApiEndpoint] = localDebugConfigs.get(LocalDebugConfigKeys.LocalFunctionEndpoint) as string;
                    localEnvs[LocalEnvBackendKeys.ApplicationIdUri] = aadConfigs?.get(AadPlugin.LocalAppIdUri) as string;
                    localEnvs[LocalEnvBackendKeys.AllowedAppIds] = [teamsMobileDesktopAppId, teamsWebAppId].join(";");
                }

                // local certificate
                try {
                    const needTrust = (trustDevCert === undefined) || (trustDevCert.trim().toLowerCase() === "true");
                    const certManager = new LocalCertificateManager(ctx);
                    const localCert = await certManager.setupCertificate(needTrust);
                    if (localCert) {
                        localEnvs[LocalEnvCertKeys.SslCrtFile] = localCert.certPath;
                        localEnvs[LocalEnvCertKeys.SslKeyFile] = localCert.keyPath;
                    }
                } catch (error) {
                    // do not break if cert error
                }
            }

            if (includeBot) {
                // bot local env
                const botConfigs = ctx.configOfOtherPlugins.get(BotPlugin.Name);
                localEnvs[LocalEnvBotKeys.BotId] = botConfigs?.get(BotPlugin.LocalBotId) as string;
                localEnvs[LocalEnvBotKeys.BotPassword] = botConfigs?.get(BotPlugin.LocalBotPassword) as string;
                localEnvs[LocalEnvBotKeys.ClientId] = clientId;
                localEnvs[LocalEnvBotKeys.ClientSecret] = clientSecret;
                localEnvs[LocalEnvBotKeys.TenantID] = teamsAppTenantId;
                localEnvs[LocalEnvBotKeys.OauthAuthority] = "https://login.microsoftonline.com";
                localEnvs[LocalEnvBotKeys.LoginEndpoint] = `${localDebugConfigs.get(LocalDebugConfigKeys.LocalBotEndpoint) as string}/auth-start.html`;
                localEnvs[LocalEnvBotKeys.ApplicationIdUri] = aadConfigs?.get(AadPlugin.LocalAppIdUri) as string;

                if (includeBackend) {
                    localEnvs[LocalEnvBackendKeys.ApiEndpoint] = localDebugConfigs.get(LocalDebugConfigKeys.LocalFunctionEndpoint) as string;
                }
            }

            await localEnvProvider.saveLocalEnv(localEnvs);
        }

        TelemetryUtils.sendSuccessEvent(TelemetryEventName.postLocalDebug, telemetryProperties);
        return ok(undefined);
    }

    public async callFunc(func: Func, ctx: PluginContext): Promise<Result<any, FxError>> {
        if (func.method == "getLaunchInput") {
            const env = func.params as string;
            const solutionConfigs = ctx.configOfOtherPlugins.get(SolutionPlugin.Name);
            if (env === "remote") {
                // return remote teams app id
                const remoteId = solutionConfigs?.get(SolutionPlugin.RemoteTeamsAppId) as string;
                if(/^[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/.test(remoteId))
                {
                    return ok(remoteId);
                } else {
                    return err(MissingStep("launching remote", "TeamsFx: Provision and TeamsFx: Deploy"));
                }
            } else {
                // return local teams app id
                return ok(solutionConfigs?.get(SolutionPlugin.LocalTeamsAppId) as string);
            }
        } else if (func.method === "getProgrammingLanguage") {
            const solutionConfigs = ctx.configOfOtherPlugins.get(SolutionPlugin.Name);
            return ok(solutionConfigs?.get(SolutionPlugin.ProgrammingLanguage) as string);
        }

        return ok(undefined);
    }
}

export default new LocalDebugPlugin();
