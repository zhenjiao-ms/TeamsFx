// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import { PluginContext, Result, Stage, QTreeNode, NodeType, FxError } from "@microsoft/teamsfx-api";

import { AADRegistration } from "./aadRegistration";
import * as factory from "./clientFactory";
import * as utils from "./utils/common";
import { createQuestions } from "./questions";
import { LanguageStrategy } from "./languageStrategy";
import { Messages } from "./resources/messages";
import { FxResult, FxBotPluginResultFactory as ResultFactory } from "./result";
import { ProgressBarConstants, DeployConfigs, FolderNames, QuestionNames, WebAppConstants, LifecycleFuncNames, TemplateProjectsConstants, AuthEnvNames, AuthValues, MaxLengths, Links } from "./constants";
import { WayToRegisterBot } from "./enums/wayToRegisterBot";
import { getZipDeployEndpoint } from "./utils/zipDeploy";

import * as appService from "@azure/arm-appservice";
import * as fs from "fs-extra";
import { CommonStrings, PluginBot, ConfigNames } from "./resources/strings";
import { DialogUtils } from "./utils/dialog";
import {
    CheckThrowSomethingMissing,
    PackDirExistenceError,
    PreconditionError, SomethingMissingError, UserInputsError,
    ValidationError
} from "./errors";
import { TeamsBotConfig } from "./configs/teamsBotConfig";
import AdmZip from "adm-zip";
import { ProgressBarFactory } from "./progressBars";
import { PluginActRoles } from "./enums/pluginActRoles";
import { ResourceNameFactory } from "./utils/resourceNameFactory";
import { AppStudio } from "./appStudio/appStudio";
import { IBotRegistration } from "./appStudio/interfaces/IBotRegistration";
import { Logger } from "./logger";
import { DeployMgr } from "./deployMgr";
import { BotAuthCredential } from "./botAuthCredential";
import { AzureOperations } from "./azureOps";

export class TeamsBotImpl {
    // Made config plubic, because expect the upper layer to fill inputs.
    public config: TeamsBotConfig = new TeamsBotConfig();
    private ctx?: PluginContext;

    public async getQuestions(stage: Stage, ctx: PluginContext): Promise<Result<QTreeNode | undefined, FxError>> {
        switch (stage) {
            case Stage.create: {
                return ResultFactory.Success(createQuestions);
            }
        }

        return ResultFactory.Success(new QTreeNode({
            type: NodeType.group
        }));
    }

    public async preScaffold(context: PluginContext): Promise<FxResult> {
        this.ctx = context;
        await this.config.restoreConfigFromContext(context);
        this.telemetryStepIn(LifecycleFuncNames.PRE_SCAFFOLD);
        Logger.info(Messages.PreScaffoldingBot);

        const rawWay = this.ctx.answers?.get(QuestionNames.WAY_TO_REGISTER_BOT);

        if (!rawWay) {
            throw new UserInputsError(QuestionNames.WAY_TO_REGISTER_BOT, rawWay as string);
        }

        const pickedWay: WayToRegisterBot = rawWay as WayToRegisterBot;

        let botRegistration = {
            botId: "",
            botPassword: "",
        };

        if (pickedWay === WayToRegisterBot.ReuseExisting) {

            botRegistration = await this.reuseExistingBotRegistration();

            this.config.scaffold.botId = botRegistration.botId;
            this.config.scaffold.botPassword = botRegistration.botPassword;

            this.updateManifest(this.config.scaffold.botId);
        }

        this.config.scaffold.wayToRegisterBot = pickedWay;

        this.config.saveConfigIntoContext(context);
        this.telemetryStepOutSuccess(LifecycleFuncNames.PRE_SCAFFOLD);

        return ResultFactory.Success();
    }

    public async scaffold(context: PluginContext): Promise<FxResult> {
        this.ctx = context;
        await this.config.restoreConfigFromContext(context);
        this.telemetryStepIn(LifecycleFuncNames.SCAFFOLD);
        Logger.info(Messages.ScaffoldingBot);

        const handler = await ProgressBarFactory.newProgressBar(ProgressBarConstants.SCAFFOLD_TITLE, ProgressBarConstants.SCAFFOLD_STEPS_NUM, this.ctx);
        await handler?.start(ProgressBarConstants.SCAFFOLD_STEP_START);

        // 1. Copy the corresponding template project into target directory.
        // Get group name.
        let group_name = TemplateProjectsConstants.GROUP_NAME_BOT;
        if (!this.config.actRoles || this.config.actRoles.length === 0) {
            throw new SomethingMissingError("act roles");
        }

        const hasBot = this.config.actRoles.includes(PluginActRoles.Bot);
        const hasMsgExt = this.config.actRoles.includes(PluginActRoles.MessageExtension);
        if (hasBot && hasMsgExt) {
            group_name = TemplateProjectsConstants.GROUP_NAME_BOT_MSGEXT;
        } else if (hasBot) {
            group_name = TemplateProjectsConstants.GROUP_NAME_BOT;
        } else {
            group_name = TemplateProjectsConstants.GROUP_NAME_MSGEXT;
        }

        await handler?.next(ProgressBarConstants.SCAFFOLD_STEP_FETCH_ZIP);
        const zipContent: AdmZip = await LanguageStrategy.getTemplateProjectZip(this.config.scaffold.programmingLanguage!, group_name);

        await handler?.next(ProgressBarConstants.SCAFFOLD_STEP_UNZIP);
        zipContent.extractAllTo(this.config.scaffold.workingDir!, true);

        this.config.saveConfigIntoContext(context);
        this.telemetryStepOutSuccess(LifecycleFuncNames.SCAFFOLD);
        Logger.info(Messages.SuccessfullyScaffoldedBot);

        return ResultFactory.Success();
    }

    public async preProvision(context: PluginContext): Promise<FxResult> {
        this.ctx = context;
        await this.config.restoreConfigFromContext(context);
        this.telemetryStepIn(LifecycleFuncNames.PRE_PROVISION);
        Logger.info(Messages.PreProvisioningBot);

        // Preconditions checking.
        CheckThrowSomethingMissing(ConfigNames.PROGRAMMING_LANGUAGE, this.config.scaffold.programmingLanguage);
        // CheckThrowSomethingMissing(ConfigNames.GRAPH_TOKEN, this.config.scaffold.graphToken);
        CheckThrowSomethingMissing(ConfigNames.SUBSCRIPTION_ID, this.config.provision.subscriptionId);
        CheckThrowSomethingMissing(ConfigNames.RESOURCE_GROUP, this.config.provision.resourceGroup);
        CheckThrowSomethingMissing(ConfigNames.LOCATION, this.config.provision.location);
        CheckThrowSomethingMissing(ConfigNames.SKU_NAME, this.config.provision.skuName);
        CheckThrowSomethingMissing(CommonStrings.SHORT_APP_NAME, this.ctx?.app.name.short);

        if (!this.config.provision.siteName) {
            this.config.provision.siteName = ResourceNameFactory.createCommonName(this.config.resourceNameSuffix, this.ctx?.app.name.short, MaxLengths.WEB_APP_SITE_NAME);
            Logger.debug(`Site name generated to use is ${this.config.provision.siteName}.`);
        }

        this.config.saveConfigIntoContext(context);
        this.telemetryStepOutSuccess(LifecycleFuncNames.PRE_PROVISION);

        return ResultFactory.Success();
    }

    public async provision(context: PluginContext): Promise<FxResult> {
        this.ctx = context;
        await this.config.restoreConfigFromContext(context);
        this.telemetryStepIn(LifecycleFuncNames.PROVISION);
        Logger.info(Messages.ProvisioningBot);

        // Create and register progress bar for cleanup.
        const handler = await ProgressBarFactory.newProgressBar(ProgressBarConstants.PROVISION_TITLE, ProgressBarConstants.PROVISION_STEPS_NUM, this.ctx);

        await handler?.start(ProgressBarConstants.PROVISION_STEP_START);

        // 1. Do bot registration.
        if (this.config.scaffold.wayToRegisterBot === WayToRegisterBot.CreateNew) {
            await handler?.next(ProgressBarConstants.PROVISION_STEP_BOT_REG);
            await this.createNewBotRegistrationOnAzure();
        }

        await handler?.next(ProgressBarConstants.PROVISION_STEP_WEB_APP);
        // 2. Provision azure web app for hosting bot project.
        await this.provisionWebApp();

        this.config.saveConfigIntoContext(context);
        this.telemetryStepOutSuccess(LifecycleFuncNames.PROVISION);
        Logger.info(Messages.SuccessfullyProvisionedBot);

        return ResultFactory.Success();
    }

    private async provisionWebApp() {

        this.telemetryStepIn(LifecycleFuncNames.PROVISION_WEB_APP);

        CheckThrowSomethingMissing(CommonStrings.SHORT_APP_NAME, this.ctx?.app.name.short);

        const serviceClientCredentials = await this.ctx?.azureAccountProvider?.getAccountCredentialAsync();
        if (!serviceClientCredentials) {
            throw new PreconditionError(Messages.FailToGetAzureCreds, [Messages.TryLoginAzure]);
        }

        // Suppose we get creds and subs from context.
        const webSiteMgmtClient = factory.createWebSiteMgmtClient(
            serviceClientCredentials,
            this.config.provision.subscriptionId!,
        );

        // 1. Provsion app service plan.
        const appServicePlanName = this.config.provision.appServicePlan ??
            ResourceNameFactory.createCommonName(this.config.resourceNameSuffix, this.ctx?.app.name.short, MaxLengths.APP_SERVICE_PLAN_NAME);
        Logger.info(Messages.ProvisioningAzureAppServicePlan);
        await AzureOperations.CreateOrUpdateAppServicePlan(webSiteMgmtClient, this.config.provision.resourceGroup!,
            appServicePlanName, utils.generateAppServicePlanConfig(this.config.provision.location!, this.config.provision.skuName!));
        Logger.info(Messages.SuccessfullyProvisionedAzureAppServicePlan);

        // 2. Provision web app.
        const siteEnvelope: appService.WebSiteManagementModels.Site = LanguageStrategy.getSiteEnvelope(
            this.config.scaffold.programmingLanguage!,
            appServicePlanName,
            this.config.provision.location!
        );

        Logger.info(Messages.ProvisioningAzureWebApp);
        const webappResponse = await AzureOperations.CreateOrUpdateAzureWebApp(webSiteMgmtClient, this.config.provision.resourceGroup!, this.config.provision.siteName!, siteEnvelope);
        Logger.info(Messages.SuccessfullyProvisionedAzureWebApp);

        if (!this.config.provision.siteEndpoint) {
            this.config.provision.siteEndpoint = `${CommonStrings.HTTPS_PREFIX}${webappResponse.defaultHostName}`;
        }

        if (!this.config.provision.redirectUri) {
            this.config.provision.redirectUri = `${this.config.provision.siteEndpoint}${CommonStrings.AUTH_REDIRECT_URI_SUFFIX}`;
        }

        if (!this.config.provision.appServicePlan) {
            this.config.provision.appServicePlan = appServicePlanName;
        }

        // Update config for manifest.json
        this.ctx!.config.set(PluginBot.VALID_DOMAIN, `${this.config.provision.siteName}.${WebAppConstants.WEB_APP_SITE_DOMAIN}`);

        this.telemetryStepOutSuccess(LifecycleFuncNames.PROVISION_WEB_APP);
    }

    public async postProvision(context: PluginContext): Promise<FxResult> {
        this.ctx = context;
        await this.config.restoreConfigFromContext(context);
        this.telemetryStepIn(LifecycleFuncNames.POST_PROVISION);

        // 1. Get required config items from other plugins.
        // 2. Update bot hosting env"s app settings.
        const botId = this.config.scaffold.botId;
        const botPassword = this.config.scaffold.botPassword;
        const teamsAppClientId = this.config.teamsAppClientId;
        const teamsAppClientSecret = this.config.teamsAppClientSecret;
        const teamsAppTenant = this.config.teamsAppTenant;
        const applicationIdUris = this.config.applicationIdUris;
        const siteEndpoint = this.config.provision.siteEndpoint;

        CheckThrowSomethingMissing(ConfigNames.BOT_ID, botId);
        CheckThrowSomethingMissing(ConfigNames.BOT_PASSWORD, botPassword);
        CheckThrowSomethingMissing(ConfigNames.AUTH_CLIENT_ID, teamsAppClientId);
        CheckThrowSomethingMissing(ConfigNames.AUTH_CLIENT_SECRET, teamsAppClientSecret);
        CheckThrowSomethingMissing(ConfigNames.AUTH_TENANT, teamsAppTenant);
        CheckThrowSomethingMissing(ConfigNames.AUTH_APPLICATION_ID_URIS, applicationIdUris);
        CheckThrowSomethingMissing(ConfigNames.SITE_ENDPOINT, siteEndpoint);

        const serviceClientCredentials = await this.ctx?.azureAccountProvider?.getAccountCredentialAsync();
        if (!serviceClientCredentials) {
            throw new PreconditionError(Messages.FailToGetAzureCreds, [Messages.TryLoginAzure]);
        }

        const webSiteMgmtClient = factory.createWebSiteMgmtClient(
            serviceClientCredentials,
            this.config.provision.subscriptionId!,
        );

        const appSettings = [
            { name: AuthEnvNames.BOT_ID, value: botId },
            { name: AuthEnvNames.BOT_PASSWORD, value: botPassword },
            { name: AuthEnvNames.M365_CLIENT_ID, value: teamsAppClientId },
            { name: AuthEnvNames.M365_CLIENT_SECRET, value: teamsAppClientSecret },
            { name: AuthEnvNames.M365_TENANT_ID, value: teamsAppTenant },
            { name: AuthEnvNames.M365_AUTHORITY_HOST, value: AuthValues.M365_AUTHORITY_HOST },
            { name: AuthEnvNames.INITIATE_LOGIN_ENDPOINT, value: `${this.config.provision.siteEndpoint}${CommonStrings.AUTH_LOGIN_URI_SUFFIX}` },
            { name: AuthEnvNames.M365_APPLICATION_ID_URI, value: applicationIdUris }
        ];

        if (this.config.provision.sqlEndpoint) {
            appSettings.push({ name: AuthEnvNames.SQL_ENDPOINT, value: this.config.provision.sqlEndpoint });
        }
        if (this.config.provision.sqlDatabaseName) {
            appSettings.push({ name: AuthEnvNames.SQL_DATABASE_NAME, value: this.config.provision.sqlDatabaseName });
        }
        if (this.config.provision.sqlUserName) {
            appSettings.push({ name: AuthEnvNames.SQL_USER_NAME, value: this.config.provision.sqlUserName });
        }
        if (this.config.provision.sqlPassword) {
            appSettings.push({ name: AuthEnvNames.SQL_PASSWORD, value: this.config.provision.sqlPassword });
        }
        if (this.config.provision.identityId) {
            appSettings.push({ name: AuthEnvNames.IDENTITY_ID, value: this.config.provision.identityId });
        }
        if (this.config.provision.functionEndpoint) {
            appSettings.push({ name: AuthEnvNames.API_ENDPOINT, value: this.config.provision.functionEndpoint });
        }

        const siteEnvelope: appService.WebSiteManagementModels.Site = LanguageStrategy.getSiteEnvelope(
            this.config.scaffold.programmingLanguage!,
            this.config.provision.appServicePlan!,
            this.config.provision.location!,
            appSettings
        );

        Logger.info(Messages.UpdatingAzureWebAppSettings);
        await AzureOperations.CreateOrUpdateAzureWebApp(webSiteMgmtClient, this.config.provision.resourceGroup!, this.config.provision.siteName!, siteEnvelope, true);
        Logger.info(Messages.SuccessfullyUpdatedAzureWebAppSettings);

        // 3. Update message endpoint for bot registration.
        switch (this.config.scaffold.wayToRegisterBot) {
            case WayToRegisterBot.CreateNew: {
                await this.updateMessageEndpointOnAzure(`${this.config.provision.siteEndpoint}${CommonStrings.MESSAGE_ENDPOINT_SUFFIX}`);
                break;
            }
            case WayToRegisterBot.ReuseExisting: {
                // Remind end developers to update message endpoint manually.
                await DialogUtils.showAndHelp(
                    context,
                    `Before running this bot, please manually update bot's message endpoint(${this.config.provision.siteEndpoint}${CommonStrings.MESSAGE_ENDPOINT_SUFFIX}). Click 'Get Help' button for more details.`,
                    Links.UPDATE_MESSAGE_ENDPOINT
                );
                break;
            }
        }

        this.config.saveConfigIntoContext(context);
        this.telemetryStepOutSuccess(LifecycleFuncNames.POST_PROVISION);

        return ResultFactory.Success();
    }

    public async preDeploy(context: PluginContext): Promise<FxResult> {
        this.ctx = context;
        await this.config.restoreConfigFromContext(context);
        this.telemetryStepIn(LifecycleFuncNames.PRE_DEPLOY);
        Logger.info(Messages.PreDeployingBot);

        // Preconditions checking.
        const packDir = this.config.scaffold.workingDir!;

        const packDirExisted = await fs.pathExists(packDir);
        if (!packDirExisted) {
            throw new PackDirExistenceError();
        }

        CheckThrowSomethingMissing(ConfigNames.SITE_ENDPOINT, this.config.provision.siteEndpoint);
        CheckThrowSomethingMissing(ConfigNames.PROGRAMMING_LANGUAGE, this.config.scaffold.programmingLanguage);
        CheckThrowSomethingMissing(ConfigNames.SUBSCRIPTION_ID, this.config.provision.subscriptionId);
        CheckThrowSomethingMissing(ConfigNames.RESOURCE_GROUP, this.config.provision.resourceGroup);

        if (!utils.isDomainValidForAzureWebApp(this.config.provision.siteEndpoint!)) {
            throw new ValidationError("siteEndpoint", this.config.provision.siteEndpoint!);
        }

        this.config.saveConfigIntoContext(context);
        this.telemetryStepOutSuccess(LifecycleFuncNames.PRE_DEPLOY);

        return ResultFactory.Success();
    }

    public async deploy(context: PluginContext): Promise<FxResult> {
        this.ctx = context;
        await this.config.restoreConfigFromContext(context);
        this.telemetryStepIn(LifecycleFuncNames.DEPLOY);
        Logger.info(Messages.DeployingBot);

        if (!this.config.scaffold.workingDir) {
            throw new PreconditionError(Messages.WorkingDirIsMissing, []);
        }

        const deployTimeCandidate = Date.now();
        const deployMgr = new DeployMgr(this.config.scaffold.workingDir);
        await deployMgr.init();
        const needsRedeploy = await deployMgr.needsToRedeploy();
        if (!needsRedeploy) {
            Logger.debug(Messages.SkipDeployNoUpdates);
            return ResultFactory.Success();
        }

        const handler = await ProgressBarFactory.newProgressBar(ProgressBarConstants.DEPLOY_TITLE, ProgressBarConstants.DEPLOY_STEPS_NUM, this.ctx);

        await handler?.start(ProgressBarConstants.DEPLOY_STEP_START);

        const packDir = this.config.scaffold.workingDir;

        await handler?.next(ProgressBarConstants.DEPLOY_STEP_NPM_INSTALL);

        await LanguageStrategy.localBuild(this.config.scaffold.programmingLanguage!, packDir, this.config.deploy.unPackFlag === "true" ? true : false);

        await handler?.next(ProgressBarConstants.DEPLOY_STEP_ZIP_FOLDER);
        const zipBuffer = utils.zipAFolder(packDir, DeployConfigs.UN_PACK_DIRS, [`${FolderNames.NODE_MODULES}/${FolderNames.KEYTAR}`]);

        // 2.2 Retrieve publishing credentials.
        let publishingUserName = "";
        let publishingPassword: string | undefined = undefined;

        const serviceClientCredentials = await this.ctx?.azureAccountProvider?.getAccountCredentialAsync();
        if (!serviceClientCredentials) {
            throw new PreconditionError(Messages.FailToGetAzureCreds, [Messages.TryLoginAzure]);
        }

        const webSiteMgmtClient = new appService.WebSiteManagementClient(
            serviceClientCredentials,
            this.config.provision.subscriptionId!,
        );
        const listResponse = await AzureOperations.ListPublishingCredentials(webSiteMgmtClient, this.config.provision.resourceGroup!, this.config.provision.siteName!);

        publishingUserName = listResponse.publishingUserName;
        publishingPassword = listResponse.publishingPassword;

        const encryptedCreds: string = utils.toBase64(`${publishingUserName}:${publishingPassword}`);

        const config = {
            headers: {
                Authorization: `Basic ${encryptedCreds}`,
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
        };

        const zipDeployEndpoint: string = getZipDeployEndpoint(this.config.provision.siteName!);
        await handler?.next(ProgressBarConstants.DEPLOY_STEP_ZIP_DEPLOY);
        await AzureOperations.ZipDeployPackage(zipDeployEndpoint, zipBuffer, config);

        await deployMgr.updateLastDeployTime(deployTimeCandidate);

        this.config.saveConfigIntoContext(context);
        this.telemetryStepOutSuccess(LifecycleFuncNames.DEPLOY);
        Logger.info(Messages.SuccessfullyDeployedBot);

        return ResultFactory.Success();
    }

    public async localDebug(context: PluginContext): Promise<FxResult> {
        this.ctx = context;
        await this.config.restoreConfigFromContext(context);
        this.telemetryStepIn(LifecycleFuncNames.LOCAL_DEBUG);

        const handler = await ProgressBarFactory.newProgressBar(ProgressBarConstants.LOCAL_DEBUG_TITLE, ProgressBarConstants.LOCAL_DEBUG_STEPS_NUM, this.ctx);

        await handler?.start(ProgressBarConstants.LOCAL_DEBUG_STEP_START);

        await handler?.next(ProgressBarConstants.LOCAL_DEBUG_STEP_BOT_REG);
        await this.createNewBotRegistrationOnAppStudio();

        this.config.saveConfigIntoContext(context);
        this.telemetryStepOutSuccess(LifecycleFuncNames.LOCAL_DEBUG);

        return ResultFactory.Success();
    }

    public async postLocalDebug(context: PluginContext): Promise<FxResult> {
        this.ctx = context;
        await this.config.restoreConfigFromContext(context);
        this.telemetryStepIn(LifecycleFuncNames.POST_LOCAL_DEBUG);

        CheckThrowSomethingMissing(ConfigNames.LOCAL_ENDPOINT, this.config.localDebug.localEndpoint);

        await this.updateMessageEndpointOnAppStudio(`${this.config.localDebug.localEndpoint}${CommonStrings.MESSAGE_ENDPOINT_SUFFIX}`);

        this.config.saveConfigIntoContext(context);
        this.telemetryStepOutSuccess(LifecycleFuncNames.POST_LOCAL_DEBUG);

        return ResultFactory.Success();
    }

    private async updateMessageEndpointOnAppStudio(endpoint: string) {
        this.telemetryStepIn(LifecycleFuncNames.UPDATE_MESSAGE_ENDPOINT_APPSTUDIO);

        const appStudioToken = await this.ctx?.appStudioToken?.getAccessToken();
        CheckThrowSomethingMissing(ConfigNames.APPSTUDIO_TOKEN, appStudioToken);
        CheckThrowSomethingMissing(ConfigNames.LOCAL_BOT_ID, this.config.localDebug.localBotId);

        const botReg: IBotRegistration = {
            botId: this.config.localDebug.localBotId,
            name: this.ctx!.app.name.short,
            description: "",
            iconUrl: "",
            messagingEndpoint: endpoint,
            callingEndpoint: ""
        };

        await AppStudio.updateMessageEndpoint(appStudioToken!, botReg.botId!, botReg);

        this.telemetryStepOutSuccess(LifecycleFuncNames.UPDATE_MESSAGE_ENDPOINT_APPSTUDIO);
    }

    private async updateMessageEndpointOnAzure(endpoint: string) {
        this.telemetryStepIn(LifecycleFuncNames.UPDATE_MESSAGE_ENDPOINT_AZURE);

        const serviceClientCredentials = await this.ctx?.azureAccountProvider?.getAccountCredentialAsync();
        if (!serviceClientCredentials) {
            throw new PreconditionError(Messages.FailToGetAzureCreds, [Messages.TryLoginAzure]);
        }

        const botClient = factory.createAzureBotServiceClient(
            serviceClientCredentials,
            this.config.provision.subscriptionId!,
        );

        if (!this.config.provision.botChannelRegName) {
            throw new SomethingMissingError(CommonStrings.BOT_CHANNEL_REGISTRATION);
        }
        const botChannelRegistrationName = this.config.provision.botChannelRegName;
        Logger.info(Messages.UpdatingBotMessageEndpoint);
        await AzureOperations.UpdateBotChannelRegistration(botClient, this.config.provision.resourceGroup!,
            botChannelRegistrationName, this.config.scaffold.botId!, endpoint);
        Logger.info(Messages.SuccessfullyUpdatedBotMessageEndpoint);

        this.telemetryStepOutSuccess(LifecycleFuncNames.UPDATE_MESSAGE_ENDPOINT_AZURE);
    }

    private async reuseExistingBotRegistration() {
        this.telemetryStepIn(LifecycleFuncNames.REUSE_EXISTING_BOT_REG);

        const rawBotId = this.ctx!.answers?.get(QuestionNames.GET_BOT_ID);
        if (!rawBotId) {
            throw new UserInputsError(QuestionNames.GET_BOT_ID, rawBotId as string);
        }
        const botId = rawBotId as string;

        const rawBotPassword = this.ctx!.answers?.get(QuestionNames.GET_BOT_PASSWORD);
        if (!rawBotPassword) {
            throw new UserInputsError(QuestionNames.GET_BOT_PASSWORD, rawBotPassword as string);
        }
        const botPassword = rawBotPassword as string;

        this.telemetryStepOutSuccess(LifecycleFuncNames.REUSE_EXISTING_BOT_REG);

        return {
            botId: botId,
            botPassword: botPassword,
        };
    }

    private async createNewBotRegistrationOnAppStudio() {
        this.telemetryStepIn(LifecycleFuncNames.CREATE_NEW_BOT_REG_APPSTUDIO);

        const appStudioToken = await this.ctx?.appStudioToken?.getAccessToken();
        CheckThrowSomethingMissing(ConfigNames.APPSTUDIO_TOKEN, appStudioToken);
        CheckThrowSomethingMissing(CommonStrings.SHORT_APP_NAME, this.ctx?.app.name.short);

        if (this.config.localDebug.botRegistrationCreated() && (await AppStudio.isAADAppExisting(appStudioToken!, this.config.localDebug.localObjectId!))) {
            Logger.debug("Local bot has already been registered, just return.");
            return;
        }

        // 1. Create a new AAD App Registraion with client secret.
        const aadDisplayName = ResourceNameFactory.createCommonName(this.config.resourceNameSuffix, this.ctx?.app.name.short, MaxLengths.AAD_DISPLAY_NAME);

        Logger.info(Messages.ProvisioningBotRegistration);
        const botAuthCreds = await AADRegistration.registerAADAppAndGetSecretByAppStudio(
            appStudioToken!,
            aadDisplayName
        );
        Logger.info(Messages.SuccessfullyProvisionedBotRegistration);

        // 2. Register bot by app studio.
        const botReg: IBotRegistration = {
            botId: botAuthCreds.clientId,
            name: this.ctx!.app.name.short,
            description: "",
            iconUrl: "",
            messagingEndpoint: "",
            callingEndpoint: ""
        };

        Logger.info(Messages.ProvisioningBotRegistration);
        await AppStudio.createBotRegistration(appStudioToken!, botReg);
        Logger.info(Messages.SuccessfullyProvisionedBotRegistration);

        if (!this.config.localDebug.localBotId) {
            this.config.localDebug.localBotId = botAuthCreds.clientId;
        }

        if (!this.config.localDebug.localBotPassword) {
            this.config.localDebug.localBotPassword = botAuthCreds.clientSecret;
        }

        if (!this.config.localDebug.localObjectId) {
            this.config.localDebug.localObjectId = botAuthCreds.objectId;
        }

        this.updateManifest(this.config.localDebug.localBotId!);

        this.telemetryStepOutSuccess(LifecycleFuncNames.CREATE_NEW_BOT_REG_APPSTUDIO);
    }

    private async createNewBotRegistrationOnAzure() {
        this.telemetryStepIn(LifecycleFuncNames.CREATE_NEW_BOT_REG_AZURE);

        // 1. Create a new AAD App Registraion with client secret.
        const appStudioToken = await this.ctx?.appStudioToken?.getAccessToken();
        CheckThrowSomethingMissing(ConfigNames.APPSTUDIO_TOKEN, appStudioToken);
        CheckThrowSomethingMissing(CommonStrings.SHORT_APP_NAME, this.ctx?.app.name.short);

        let botAuthCreds = new BotAuthCredential();

        if (!this.config.scaffold.botRegistrationCreated()) {
            const aadDisplayName = ResourceNameFactory.createCommonName(this.config.resourceNameSuffix, this.ctx?.app.name.short, MaxLengths.AAD_DISPLAY_NAME);
            botAuthCreds = await AADRegistration.registerAADAppAndGetSecretByAppStudio(
                appStudioToken!,
                aadDisplayName
            );
        } else {
            botAuthCreds.clientId = this.config.scaffold.botId;
            botAuthCreds.clientSecret = this.config.scaffold.botPassword;
            botAuthCreds.objectId = this.config.scaffold.objectId;
        }

        const serviceClientCredentials = await this.ctx?.azureAccountProvider?.getAccountCredentialAsync();
        if (!serviceClientCredentials) {
            throw new PreconditionError(Messages.FailToGetAzureCreds, [Messages.TryLoginAzure]);
        }

        // 2. Provision a bot channel registration resource on azure.
        const botClient = factory.createAzureBotServiceClient(
            serviceClientCredentials,
            this.config.provision.subscriptionId!,
        );

        const botChannelRegistrationName = this.config.provision.botChannelRegName ?
            this.config.provision.botChannelRegName : ResourceNameFactory.createCommonName(this.config.resourceNameSuffix, this.ctx?.app.name.short, MaxLengths.BOT_CHANNEL_REG_NAME);

        Logger.info(Messages.ProvisioningAzureBotChannelRegistration);
        await AzureOperations.CreateBotChannelRegistration(botClient, this.config.provision.resourceGroup!, botChannelRegistrationName, botAuthCreds.clientId!);
        Logger.info(Messages.SuccessfullyProvisionedAzureBotChannelRegistration);

        // 3. Add Teams Client as a channel to the resource above.
        Logger.info(Messages.ProvisioningMsTeamsChannel);
        await AzureOperations.LinkTeamsChannel(botClient, this.config.provision.resourceGroup!, botChannelRegistrationName);
        Logger.info(Messages.SuccessfullyProvisionedMsTeamsChannel);

        if (!this.config.scaffold.botId) {
            this.config.scaffold.botId = botAuthCreds.clientId;
        }

        if (!this.config.scaffold.botPassword) {
            this.config.scaffold.botPassword = botAuthCreds.clientSecret;
        }

        if (!this.config.scaffold.objectId) {
            this.config.scaffold.objectId = botAuthCreds.objectId;
        }

        if (!this.config.provision.botChannelRegName) {
            this.config.provision.botChannelRegName = botChannelRegistrationName;
        }

        this.updateManifest(this.config.scaffold.botId!);

        this.telemetryStepOutSuccess(LifecycleFuncNames.CREATE_NEW_BOT_REG_AZURE);
    }

    private updateManifest(botId: string) {

        if (this.config.actRoles.includes(PluginActRoles.Bot)) {
            this.ctx!.config.set(PluginBot.BOTS_SECTION, utils.genBotSectionInManifest(botId));
        }

        if (this.config.actRoles.includes(PluginActRoles.MessageExtension)) {
            this.ctx!.config.set(PluginBot.MESSAGE_EXTENSION_SECTION, utils.genMsgExtSectionInManifest(botId));
        }
    }

    private telemetryStepIn(funcName: string) {
        this.ctx?.telemetryReporter?.sendTelemetryEvent(`${funcName}-start`, {
            component: PluginBot.PLUGIN_NAME,
        });
    }

    private telemetryStepOutSuccess(funcName: string) {
        this.ctx?.telemetryReporter?.sendTelemetryEvent(`${funcName}-end`, {
            component: PluginBot.PLUGIN_NAME,
            success: "yes",
        });
    }
}
