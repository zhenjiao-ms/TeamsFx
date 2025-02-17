// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import axios from "axios";
import * as chai from "chai";
import glob from "glob";
import path from "path";
import MockAzureAccountProvider from "../../src/commonlib/azureLoginUserPassword";
import {
  getSubscriptionIdFromResourceId,
  getResourceGroupNameFromResourceId,
  getSiteNameFromResourceId,
  getWebappConfigs,
  getWebappServicePlan,
  runWithRetry,
} from "./utilities";

const baseUrlListDeployments = (subscriptionId: string, rg: string, name: string) =>
  `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${rg}/providers/Microsoft.Web/sites/${name}/deployments?api-version=2019-08-01`;
const baseUrlListDeploymentLogs = (subscriptionId: string, rg: string, name: string, id: string) =>
  `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${rg}/providers/Microsoft.Web/sites/${name}/deployments/${id}/log?api-version=2019-08-01`;

enum BaseConfig {
  M365_CLIENT_ID = "M365_CLIENT_ID",
  M365_CLIENT_SECRET = "M365_CLIENT_SECRET",
  M365_AUTHORITY_HOST = "M365_AUTHORITY_HOST",
  M365_TENANT_ID = "M365_TENANT_ID",
  ALLOWED_APP_IDS = "ALLOWED_APP_IDS",
  API_ENDPOINT = "API_ENDPOINT",
  M365_APPLICATION_ID_URI = "M365_APPLICATION_ID_URI",
}

enum SQLConfig {
  IDENTITY_ID = "IDENTITY_ID",
  SQL_DATABASE_NAME = "SQL_DATABASE_NAME",
  SQL_ENDPOINT = "SQL_ENDPOINT",
}

class DependentPluginInfo {
  public static readonly functionPluginName = "fx-resource-function";
  public static readonly apiEndpoint = "functionEndpoint";

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

  public static readonly sqlPluginName: string = "fx-resource-azure-sql";
  public static readonly databaseName: string = "databaseName";
  public static readonly sqlEndpoint: string = "sqlEndpoint";

  public static readonly identityPluginName: string = "fx-resource-identity";
  public static readonly identityId: string = "identityId";
  public static readonly identityName: string = "identityName";

  public static readonly frontendPluginName: string = "fx-resource-frontend-hosting";
  public static readonly frontendEndpoint: string = "endpoint";
  public static readonly frontendDomain: string = "domain";

  public static readonly apimPluginName: string = "fx-resource-apim";
  public static readonly apimAppId: string = "apimClientAADClientId";
}

interface IFunctionObject {
  functionAppName: string;
  appServicePlanName?: string;
  expectValues: Map<string, string>;
}

export class FunctionValidator {
  private static subscriptionId: string;
  private static rg: string;

  private static functionAppResourceIdKeyName = "functionAppResourceId";

  public static init(ctx: any, insiderPreview = false): IFunctionObject {
    console.log("Start to init validator for Function.");

    let functionObject: IFunctionObject;

    if (insiderPreview) {
      const resourceId =
        ctx[DependentPluginInfo.functionPluginName][this.functionAppResourceIdKeyName];
      this.subscriptionId = getSubscriptionIdFromResourceId(resourceId);
      this.rg = getResourceGroupNameFromResourceId(resourceId);

      const functionAppName = getSiteNameFromResourceId(resourceId);
      const expectValues = new Map<string, string>([]);
      expectValues.set(
        BaseConfig.API_ENDPOINT,
        ctx[DependentPluginInfo.functionPluginName][DependentPluginInfo.apiEndpoint] as string
      );
      expectValues.set(
        SQLConfig.SQL_ENDPOINT,
        ctx[DependentPluginInfo.sqlPluginName]?.[DependentPluginInfo.sqlEndpoint] as string
      );

      functionObject = {
        functionAppName: functionAppName,
        expectValues: expectValues,
      };
    } else {
      functionObject = ctx[DependentPluginInfo.functionPluginName] as IFunctionObject;
      chai.assert.exists(functionObject);

      this.subscriptionId =
        ctx[DependentPluginInfo.solutionPluginName][DependentPluginInfo.subscriptionId];
      chai.assert.exists(this.subscriptionId);

      this.rg = ctx[DependentPluginInfo.solutionPluginName][DependentPluginInfo.resourceGroupName];
      chai.assert.exists(this.rg);

      const expectValues = new Map<string, string>([]);
      expectValues.set(
        BaseConfig.API_ENDPOINT,
        ctx[DependentPluginInfo.functionPluginName][DependentPluginInfo.apiEndpoint] as string
      );
      expectValues.set(
        SQLConfig.SQL_ENDPOINT,
        ctx[DependentPluginInfo.sqlPluginName]?.[DependentPluginInfo.sqlEndpoint] as string
      );
      functionObject.expectValues = expectValues;
    }

    console.log("Successfully init validator for Function.");
    return functionObject;
  }

  public static async validateScaffold(
    projectPath: string,
    programmingLanguage: string
  ): Promise<void> {
    const indexFile: { [key: string]: string } = {
      typescript: "index.ts",
      javascript: "index.js",
    };
    glob(
      `**/${indexFile[programmingLanguage]}`,
      { cwd: path.resolve(projectPath, "api") },
      (err, files) => {
        chai.assert.isAtLeast(files.length, 1);
      }
    );
  }

  public static async validateProvision(
    functionObject: IFunctionObject,
    sqlEnabled = true,
    isMultiEnvEnabled = false
  ): Promise<void> {
    console.log("Start to validate Function Provision.");

    const tokenProvider = MockAzureAccountProvider;
    const tokenCredential = await tokenProvider.getAccountCredentialAsync();
    const token = (await tokenCredential?.getToken())?.accessToken;

    enum BaseConfig {
      M365_CLIENT_ID = "M365_CLIENT_ID",
      M365_CLIENT_SECRET = "M365_CLIENT_SECRET",
      M365_AUTHORITY_HOST = "M365_AUTHORITY_HOST",
      M365_TENANT_ID = "M365_TENANT_ID",
      ALLOWED_APP_IDS = "ALLOWED_APP_IDS",
      API_ENDPOINT = "API_ENDPOINT",
      M365_APPLICATION_ID_URI = "M365_APPLICATION_ID_URI",
    }

    enum SQLConfig {
      IDENTITY_ID = "IDENTITY_ID",
      SQL_DATABASE_NAME = "SQL_DATABASE_NAME",
      SQL_ENDPOINT = "SQL_ENDPOINT",
    }

    console.log("Validating app settings.");

    const appName = functionObject.functionAppName;
    const response = await getWebappConfigs(this.subscriptionId, this.rg, appName, token as string);

    chai.assert.exists(response);

    Object.values(BaseConfig).forEach((v: string) => {
      chai.assert.exists(response[v]);
      if (functionObject.expectValues.get(v)) {
        chai.assert.equal(functionObject.expectValues.get(v), response[v]);
      }
    });

    if (sqlEnabled) {
      Object.values(SQLConfig).forEach((v: string) => {
        chai.assert.exists(response[v]);
        if (functionObject.expectValues.get(v)) {
          chai.assert.equal(functionObject.expectValues.get(v), response[v]);
        }
      });
    }

    if (!isMultiEnvEnabled) {
      console.log("Validating app service plan.");
      const servicePlanResponse = await getWebappServicePlan(
        this.subscriptionId,
        this.rg,
        functionObject.appServicePlanName!,
        token as string
      );
      chai.assert(servicePlanResponse, functionObject.appServicePlanName);
    }

    console.log("Successfully validate Function Provision.");
  }

  public static async validateDeploy(functionObject: IFunctionObject): Promise<void> {
    console.log("Start to validate Function Deployment.");

    // Disable validate deployment since we have too many requests and the test is not stable.
    const tokenCredential = await MockAzureAccountProvider.getAccountCredentialAsync();
    const token = (await tokenCredential?.getToken())?.accessToken;

    const appName = functionObject.functionAppName;

    const deployments = await this.getDeployments(
      this.subscriptionId,
      this.rg,
      appName,
      token as string
    );
    const deploymentId = deployments?.[0]?.properties?.id;
    const deploymentLog = await this.getDeploymentLog(
      this.subscriptionId,
      this.rg,
      appName,
      token as string,
      deploymentId!
    );

    chai.assert.exists(
      deploymentLog?.find((item: any) => item.properties.message === "Deployment successful.")
    );

    console.log("Successfully validate Function Deployment.");
  }

  private static async getDeployments(
    subscriptionId: string,
    rg: string,
    name: string,
    token: string
  ) {
    try {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      const functionGetResponse = await runWithRetry(() =>
        axios.get(baseUrlListDeployments(subscriptionId, rg, name))
      );

      return functionGetResponse?.data?.value;
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
      const functionGetResponse = await runWithRetry(() =>
        axios.get(baseUrlListDeploymentLogs(subscriptionId, rg, name, id))
      );

      return functionGetResponse?.data?.value;
    } catch (error) {
      console.log(error);
      return undefined;
    }
  }
}
