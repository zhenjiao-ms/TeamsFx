// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import axios from "axios";
import * as chai from "chai";
import * as fs from "fs";
import path from "path";

import MockAzureAccountProvider from "../../src/commonlib/azureLoginUserPassword";

import {
  getSubscriptionIdFromResourceId,
  getResourceGroupNameFromResourceId,
  getSiteNameFromResourceId,
  getWebappServicePlan,
  getWebappConfigs,
} from "./utilities";

const baseUrlListDeployments = (subscriptionId: string, rg: string, name: string) =>
  `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${rg}/providers/Microsoft.Web/sites/${name}/deployments?api-version=2019-08-01`;
const baseUrlListDeploymentLogs = (subscriptionId: string, rg: string, name: string, id: string) =>
  `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${rg}/providers/Microsoft.Web/sites/${name}/deployments/${id}/log?api-version=2019-08-01`;

enum BaseConfig {
  BOT_ID = "BOT_ID",
  BOT_PASSWORD = "BOT_PASSWORD",
  INITIATE_LOGIN_ENDPOINT = "INITIATE_LOGIN_ENDPOINT",
  M365_APPLICATION_ID_URI = "M365_APPLICATION_ID_URI",
  M365_AUTHORITY_HOST = "M365_AUTHORITY_HOST",
  M365_CLIENT_ID = "M365_CLIENT_ID",
  M365_CLIENT_SECRET = "M365_CLIENT_SECRET",
  M365_TENANT_ID = "M365_TENANT_ID",
}

class DependentPluginInfo {
  public static readonly botPluginName = "fx-resource-bot";
  public static readonly botId = "botId";

  public static readonly solutionPluginName = "solution";
  public static readonly resourceGroupName: string = "resourceGroupName";
  public static readonly subscriptionId: string = "subscriptionId";
  public static readonly resourceNameSuffix: string = "resourceNameSuffix";
  public static readonly location: string = "location";
  public static readonly programmingLanguage: string = "programmingLanguage";

  public static readonly aadPluginName: string = "fx-resource-aad-app-for-teams";
  public static readonly aadClientId: string = "clientId";
  public static readonly aadClientSecret: string = "clientSecret";
  public static readonly oauthHost: string = "oauthHost";
  public static readonly teamsAppTenantId: string = "teamsAppTenantId";
  public static readonly applicationIdUris: string = "applicationIdUris";
}

interface IBotObject {
  siteName: string;
  appServicePlan?: string;
  expectValues: Map<string, string>;
}

export class BotValidator {
  private static subscriptionId: string;
  private static rg: string;

  private static botWebAppResourceIdKeyName = "botWebAppResourceId";

  public static init(ctx: any, insiderPreview = false): IBotObject {
    console.log("Start to init validator for Bot.");

    let botObject: IBotObject;

    if (insiderPreview) {
      const resourceId = ctx[DependentPluginInfo.botPluginName][this.botWebAppResourceIdKeyName];
      this.subscriptionId = getSubscriptionIdFromResourceId(resourceId);
      this.rg = getResourceGroupNameFromResourceId(resourceId);

      const expectValues = new Map<string, string>([]);
      expectValues.set(
        BaseConfig.BOT_ID,
        ctx[DependentPluginInfo.botPluginName][DependentPluginInfo.botId] as string
      );
      expectValues.set(
        BaseConfig.M365_APPLICATION_ID_URI,
        ctx[DependentPluginInfo.aadPluginName][DependentPluginInfo.applicationIdUris] as string
      );
      expectValues.set(BaseConfig.M365_AUTHORITY_HOST, "https://login.microsoftonline.com");
      expectValues.set(
        BaseConfig.M365_CLIENT_ID,
        ctx[DependentPluginInfo.aadPluginName][DependentPluginInfo.aadClientId] as string
      );
      expectValues.set(
        BaseConfig.M365_TENANT_ID,
        ctx[DependentPluginInfo.solutionPluginName][DependentPluginInfo.teamsAppTenantId] as string
      );

      botObject = {
        siteName: getSiteNameFromResourceId(resourceId),
        expectValues: expectValues,
      };
    } else {
      botObject = ctx[DependentPluginInfo.botPluginName] as IBotObject;
      chai.assert.exists(botObject);

      this.subscriptionId =
        ctx[DependentPluginInfo.solutionPluginName][DependentPluginInfo.subscriptionId];
      chai.assert.exists(this.subscriptionId);

      this.rg = ctx[DependentPluginInfo.solutionPluginName][DependentPluginInfo.resourceGroupName];
      chai.assert.exists(this.rg);

      const expectValues = new Map<string, string>([]);
      expectValues.set(
        BaseConfig.BOT_ID,
        ctx[DependentPluginInfo.botPluginName][DependentPluginInfo.botId] as string
      );
      expectValues.set(
        BaseConfig.M365_APPLICATION_ID_URI,
        ctx[DependentPluginInfo.aadPluginName][DependentPluginInfo.applicationIdUris] as string
      );
      expectValues.set(BaseConfig.M365_AUTHORITY_HOST, "https://login.microsoftonline.com");
      expectValues.set(
        BaseConfig.M365_CLIENT_ID,
        ctx[DependentPluginInfo.aadPluginName][DependentPluginInfo.aadClientId] as string
      );
      expectValues.set(
        BaseConfig.M365_TENANT_ID,
        ctx[DependentPluginInfo.solutionPluginName][DependentPluginInfo.teamsAppTenantId] as string
      );
      botObject.expectValues = expectValues;
    }

    console.log("Successfully init validator for Bot.");
    return botObject;
  }

  public static async validateScaffold(
    projectPath: string,
    programmingLanguage: string
  ): Promise<void> {
    const indexFile: { [key: string]: string } = {
      typescript: "index.ts",
      javascript: "index.js",
    };
    const indexPath = path.resolve(projectPath, "bot", indexFile[programmingLanguage]);

    fs.access(indexPath, fs.constants.F_OK, (err) => {
      // err is null means file exists
      chai.assert.isNull(err);
    });
  }

  public static async validateProvision(
    botObject: IBotObject,
    insiderPreviewEnabled = false
  ): Promise<void> {
    console.log("Start to validate Bot Provision.");

    const tokenProvider = MockAzureAccountProvider;
    const tokenCredential = await tokenProvider.getAccountCredentialAsync();
    const token = (await tokenCredential?.getToken())?.accessToken;

    console.log("Validating app settings.");
    const response = await getWebappConfigs(
      this.subscriptionId,
      this.rg,
      botObject.siteName,
      token as string
    );
    chai.assert.exists(response);

    Object.values(BaseConfig).forEach((v: string) => {
      chai.assert.exists(response[v]);
      if (botObject.expectValues.get(v)) {
        chai.assert.equal(botObject.expectValues.get(v), response[v]);
      }
    });

    if (!insiderPreviewEnabled) {
      console.log("Validating app service plan.");
      const servicePlanResponse = await getWebappServicePlan(
        this.subscriptionId,
        this.rg,
        botObject.appServicePlan!,
        token as string
      );
      chai.assert(servicePlanResponse, botObject.appServicePlan);
    }

    console.log("Successfully validate Bot Provision.");
  }

  public static async validateDeploy(botObject: IBotObject): Promise<void> {
    // ToDo: uncomment this function in the future.
    /*
        console.log("Start to validate Bot Deployment.");

        const tokenProvider: MockAzureAccountProvider = MockAzureAccountProvider.getInstance();
        const tokenCredential = await tokenProvider.getAccountCredentialAsync();
        const token = (await tokenCredential?.getToken())?.accessToken;

        const deployments = await this.getDeployments(this.subscriptionId, this.rg, botObject.siteName, token as string);
        const deploymentId = deployments?.[0]?.properties?.id;
        const deploymentLog = await this.getDeploymentLog(this.subscriptionId, this.rg, botObject.siteName, token as string, deploymentId!);

        chai.assert.exists(deploymentLog?.find((item: any) => item.properties.message === "Deployment successful."));
        console.log("Successfully validate Bot Deployment.");
        */
  }

  private static async getDeployments(
    subscriptionId: string,
    rg: string,
    name: string,
    token: string
  ) {
    try {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      const getResponse = await axios.get(baseUrlListDeployments(subscriptionId, rg, name));

      return getResponse?.data?.value;
    } catch (error) {
      console.log(error);
      return undefined;
    }
  }

  private static async getDeploymentLog(
    subscriptionId: string,
    rg: string,
    name: string,
    token: string,
    id: string
  ) {
    try {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      const getResponse = await axios.get(baseUrlListDeploymentLogs(subscriptionId, rg, name, id));

      return getResponse?.data?.value;
    } catch (error) {
      console.log(error);
      return undefined;
    }
  }
}
