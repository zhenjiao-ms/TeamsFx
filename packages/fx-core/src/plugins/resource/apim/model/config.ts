// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import {ConfigValue, ReadonlySolutionConfig} from "@microsoft/teamsfx-api";
import {
    TeamsToolkitComponent,
    ComponentRetryLifeCycle,
    LifeCycleCommands,
    SolutionConfigKeys,
    AadPluginConfigKeys,
    FunctionPluginConfigKeys,
    ApimPluginConfigKeys,
} from "../constants";
import {AssertConfigNotEmpty, BuildError, InvalidConfigValue, InvalidPropertyType, NoPluginConfig} from "../error";
import {INamingRule, NamingRules} from "../util/namingRules";

export interface IApimPluginConfig {
    resourceGroupName?: string;
    serviceName?: string;
    productId?: string;
    oAuthServerId?: string;
    apimClientAADObjectId?: string;
    apimClientAADClientId?: string;
    apimClientAADClientSecret?: string;
    apiPrefix?: string;
    versionSetId?: string;
    apiPath?: string;
    apiDocumentPath?: string;
}

export interface IFunctionPluginConfig {
    functionEndpoint: string;
}

export interface IAadPluginConfig {
    objectId: string;
    clientId: string;
    oauth2PermissionScopeId: string;
    applicationIdUris: string;
}

export interface ISolutionConfig {
    subscriptionId: string;
    resourceNameSuffix: string;
    teamsAppTenantId: string;
    resourceGroupName: string;
    location: string;
}

export class ApimPluginConfig implements IApimPluginConfig {
    // TODO update @microsoft/teamsfx-api to the latest version
    private readonly config: Map<string, ConfigValue>;
    constructor(config: Map<string, ConfigValue>) {
        this.config = config;
    }

    get resourceGroupName(): string | undefined {
        return this.getValue(ApimPluginConfigKeys.resourceGroupName, NamingRules.resourceGroupName);
    }
    set resourceGroupName(value: string | undefined) {
        this.setValue(ApimPluginConfigKeys.resourceGroupName, value);
    }
    get serviceName(): string | undefined {
        return this.getValue(ApimPluginConfigKeys.serviceName, NamingRules.apimServiceName);
    }
    set serviceName(value: string | undefined) {
        this.setValue(ApimPluginConfigKeys.serviceName, value);
    }
    get productId(): string | undefined {
        return this.getValue(ApimPluginConfigKeys.productId, NamingRules.productId);
    }
    set productId(value: string | undefined) {
        this.setValue(ApimPluginConfigKeys.productId, value);
    }
    get oAuthServerId(): string | undefined {
        return this.getValue(ApimPluginConfigKeys.oAuthServerId, NamingRules.oAuthServerId);
    }
    set oAuthServerId(value: string | undefined) {
        this.setValue(ApimPluginConfigKeys.oAuthServerId, value);
    }
    get apimClientAADObjectId(): string | undefined {
        return this.getValue(ApimPluginConfigKeys.apimClientAADObjectId, NamingRules.apimClientAADObjectId);
    }
    set apimClientAADObjectId(value: string | undefined) {
        this.setValue(ApimPluginConfigKeys.apimClientAADObjectId, value);
    }
    get apimClientAADClientId(): string | undefined {
        return this.getValue(ApimPluginConfigKeys.apimClientAADClientId, NamingRules.apimClientAADClientId);
    }
    set apimClientAADClientId(value: string | undefined) {
        this.setValue(ApimPluginConfigKeys.apimClientAADClientId, value);
    }
    get apimClientAADClientSecret(): string | undefined {
        return this.getValue(ApimPluginConfigKeys.apimClientAADClientSecret);
    }
    set apimClientAADClientSecret(value: string | undefined) {
        this.setValue(ApimPluginConfigKeys.apimClientAADClientSecret, value);
    }
    get apiPrefix(): string | undefined {
        return this.getValue(ApimPluginConfigKeys.apiPrefix, NamingRules.apiPrefix);
    }
    set apiPrefix(value: string | undefined) {
        this.setValue(ApimPluginConfigKeys.apiPrefix, value);
    }
    get versionSetId(): string | undefined {
        return this.getValue(ApimPluginConfigKeys.versionSetId, NamingRules.versionSetId);
    }
    set versionSetId(value: string | undefined) {
        this.setValue(ApimPluginConfigKeys.versionSetId, value);
    }
    get apiPath(): string | undefined {
        return this.getValue(ApimPluginConfigKeys.apiPath, NamingRules.apiPath);
    }
    set apiPath(value: string | undefined) {
        this.setValue(ApimPluginConfigKeys.apiPath, value);
    }
    get apiDocumentPath(): string | undefined {
        return this.getValue(ApimPluginConfigKeys.apiDocumentPath);
    }
    set apiDocumentPath(value: string | undefined) {
        this.setValue(ApimPluginConfigKeys.apiDocumentPath, value);
    }

    private getValue(key: string, namingRule?: INamingRule): string | undefined {
        const value = this.config.get(key);
        if (typeof value !== "string" && typeof value !== "undefined") {
            throw BuildError(InvalidPropertyType, key, "string");
        }

        if (namingRule && typeof value === "string") {
            const message = NamingRules.validate(value, namingRule);
            if (message) {
                throw BuildError(InvalidConfigValue, TeamsToolkitComponent.ApimPlugin, key, message);
            }
        }
        return value;
    }

    private setValue(key: string, value: string | undefined) {
        this.config.set(key, value);
    }
}

export class FunctionPluginConfig implements IFunctionPluginConfig {
    private readonly configOfOtherPlugins: ReadonlySolutionConfig;
    constructor(configOfOtherPlugins: ReadonlySolutionConfig) {
        this.configOfOtherPlugins = configOfOtherPlugins;
    }

    get functionEndpoint(): string {
        return this.checkAndGet(FunctionPluginConfigKeys.functionEndpoint);
    }

    private checkAndGet(key: string): string {
        return checkAndGetOtherPluginConfig(this.configOfOtherPlugins, TeamsToolkitComponent.FunctionPlugin, key);
    }
}

export class AadPluginConfig implements IAadPluginConfig {
    private readonly configOfOtherPlugins: ReadonlySolutionConfig;
    constructor(configOfOtherPlugins: ReadonlySolutionConfig) {
        this.configOfOtherPlugins = configOfOtherPlugins;
    }

    get objectId(): string {
        return this.checkAndGet(AadPluginConfigKeys.objectId);
    }
    get clientId(): string {
        return this.checkAndGet(AadPluginConfigKeys.clientId);
    }
    get oauth2PermissionScopeId(): string {
        return this.checkAndGet(AadPluginConfigKeys.oauth2PermissionScopeId);
    }
    get applicationIdUris(): string {
        return this.checkAndGet(AadPluginConfigKeys.applicationIdUris);
    }

    private checkAndGet(key: string): string {
        return checkAndGetOtherPluginConfig(this.configOfOtherPlugins, TeamsToolkitComponent.AadPlugin, key);
    }
}

export class SolutionConfig implements ISolutionConfig {
    private readonly configOfOtherPlugins: ReadonlySolutionConfig;
    constructor(configOfOtherPlugins: ReadonlySolutionConfig) {
        this.configOfOtherPlugins = configOfOtherPlugins;
    }

    get subscriptionId(): string {
        return this.checkAndGet(SolutionConfigKeys.subscriptionId);
    }
    get resourceNameSuffix(): string {
        return this.checkAndGet(SolutionConfigKeys.resourceNameSuffix);
    }
    get teamsAppTenantId(): string {
        return this.checkAndGet(SolutionConfigKeys.teamsAppTenantId);
    }
    get resourceGroupName(): string {
        return this.checkAndGet(SolutionConfigKeys.resourceGroupName);
    }
    get location(): string {
        return this.checkAndGet(SolutionConfigKeys.location);
    }

    private checkAndGet(key: string): string {
        return checkAndGetOtherPluginConfig(this.configOfOtherPlugins, TeamsToolkitComponent.Solution, key);
    }
}

function checkAndGetOtherPluginConfig(configOfOtherPlugins: ReadonlySolutionConfig, component: TeamsToolkitComponent, key: string): string {
    const pluginConfig = configOfOtherPlugins.get(component);
    if (!pluginConfig) {
        throw BuildError(NoPluginConfig, component, LifeCycleCommands[ComponentRetryLifeCycle[component]]);
    }

    const value = AssertConfigNotEmpty(component, key, pluginConfig.get(key));
    if (typeof value !== "string") {
        throw BuildError(InvalidPropertyType, key, "string");
    }
    return value;
}
