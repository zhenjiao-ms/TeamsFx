// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

"use strict";

import { TokenCredential } from "@azure/core-auth";
import { TokenCredentialsBase, DeviceTokenCredentials } from "@azure/ms-rest-nodeauth";
import { AzureAccountProvider, ConfigFolderName, err, FxError, ok, Result } from "@microsoft/teamsfx-api";
import { CodeFlowLogin, LoginFailureError, ConvertTokenToJson } from "./codeFlowLogin";
import { MemoryCache } from "./memoryCache";
import CLILogProvider from "./log";
import { getBeforeCacheAccess, getAfterCacheAccess } from "./cacheAccess";
import { SubscriptionClient } from "@azure/arm-subscriptions";
import { LogLevel } from "@azure/msal-node";
import { NotFoundSubscriptionId, NotSupportedProjectType } from "../error";
import * as fs from "fs-extra";
import * as path from "path";
import { env, signedIn, signedOut, unknownSubscription } from "./common/constant";
import { login, LoginStatus } from "./common/login";
import { UserError } from "@microsoft/teamsfx-api";

const accountName = "azure";
const scopes = ["https://management.core.windows.net/user_impersonation"];
const SERVER_PORT = 0;

const beforeCacheAccess = getBeforeCacheAccess(accountName);
const afterCacheAccess = getAfterCacheAccess(scopes, accountName);

const cachePlugin = {
  beforeCacheAccess,
  afterCacheAccess
};

const config = {
  auth: {
    clientId: "7ea7c24c-b1f6-4a20-9d11-9ae12e9e7ac0",
    authority: "https://login.microsoftonline.com/organizations"
  },
  system: {
    loggerOptions: {
      loggerCallback(loglevel: any, message: any, containsPii: any) {
        CLILogProvider.log(4 - loglevel, message);
      },
      piiLoggingEnabled: false,
      logLevel: LogLevel.Error
    }
  },
  cache: {
    cachePlugin
  }
};

// eslint-disable-next-line
// @ts-ignore
const memoryDictionary: {[tenantId: string] : MemoryCache;} = {};

export class AzureAccountManager extends login implements AzureAccountProvider {
  private static instance: AzureAccountManager;
  private static codeFlowInstance: CodeFlowLogin;
  // default tenantId
  private static domain: string | undefined;
  private static username: string | undefined;
  private static subscriptionId: string | undefined;
  //user set tenantId
  private static tenantId: string | undefined;

  private static statusChange?: (
    status: string,
    token?: string,
    accountInfo?: Record<string, unknown>
  ) => Promise<void>;

  private constructor() {
    super();
    AzureAccountManager.codeFlowInstance = new CodeFlowLogin(
      scopes,
      config,
      SERVER_PORT,
      accountName
    );
  }

  /**
   * Gets instance
   * @returns instance
   */
  public static getInstance(): AzureAccountManager {
    if (!AzureAccountManager.instance) {
      AzureAccountManager.instance = new AzureAccountManager();
    }

    return AzureAccountManager.instance;
  }

  /**
   * Get AccountCredential
   *  - Use scenario : https://docs.microsoft.com/en-us/azure/developer/javascript/core/node-sdk-azure-authenticate
   *  - NPM guideline : https://docs.microsoft.com/en-us/azure/developer/javascript/core/node-sdk-azure-authenticate
   * @returns the instance of TokenCredentialsBase
   */
  getAccountCredential(showDialog = true): TokenCredentialsBase | undefined {
    throw new Error("Method not implemented.");
  }

  /**
   * Get IdentityCredential
   *  - Use scenario : https://docs.microsoft.com/en-us/azure/developer/javascript/core/node-sdk-azure-authenticate
   *  - NPM guideline : https://www.npmjs.com/package/@azure/ms-rest-nodeauth
   * @returns the instance of TokenCredential
   */
  getIdentityCredential(showDialog = true): TokenCredential | undefined {
    return undefined;
  }

  /**
   * Async get ms-rest-* [credential](https://github.com/Azure/ms-rest-nodeauth/blob/master/lib/credentials/tokenCredentialsBase.ts)
   */
  async getAccountCredentialAsync(showDialog = true): Promise<TokenCredentialsBase | undefined> {
    if (AzureAccountManager.codeFlowInstance.account) {
      const loginToken = await AzureAccountManager.codeFlowInstance.getToken();
      const tokenJson = await this.getJsonObject();
      this.setMemoryCache(loginToken, tokenJson);
    }
    if (AzureAccountManager.codeFlowInstance.account) {
      return new Promise(async (resolve) => {
        if (!AzureAccountManager.tenantId || AzureAccountManager.tenantId===AzureAccountManager.domain) {
          const tokenJson = await this.getJsonObject();
          const credential = new DeviceTokenCredentials(
            config.auth.clientId,
            (tokenJson as any).tid,
            (tokenJson as any).upn ?? (tokenJson as any).unique_name,
            undefined,
            env,
            memoryDictionary[AzureAccountManager.domain!]
          );
          resolve(credential);
        } else {
          const token = await AzureAccountManager.codeFlowInstance.getTenantToken(AzureAccountManager.tenantId);
          const tokenJson = ConvertTokenToJson(token!);
          this.setMemoryCache(token, tokenJson);
          const credential = new DeviceTokenCredentials(
            config.auth.clientId,
            (tokenJson as any).tid,
            (tokenJson as any).upn ?? (tokenJson as any).unique_name,
            undefined,
            env,
            memoryDictionary[AzureAccountManager.tenantId]
          );
          resolve(credential);
        }
      });
    }
    await this.login(showDialog);
    await this.updateLoginStatus();
    return this.doGetAccountCredentialAsync();
  }

  /**
   * Async get identity [crendential](https://github.com/Azure/azure-sdk-for-js/blob/master/sdk/core/core-auth/src/tokenCredential.ts)
   */
  async getIdentityCredentialAsync(showDialog = true): Promise<TokenCredential | undefined> {
    return undefined;
  }

  private async updateLoginStatus(): Promise<void> {
    if (
      AzureAccountManager.codeFlowInstance.account &&
      AzureAccountManager.statusChange !== undefined
    ) {
      const credential = await this.doGetAccountCredentialAsync();
      const accessToken = await credential?.getToken();
      const accountJson = await this.getJsonObject();
      await AzureAccountManager.statusChange("SignedIn", accessToken?.accessToken, accountJson);
    }
    await this.notifyStatus();
  }

  private async login(showDialog: boolean): Promise<void> {
    const accessToken = await AzureAccountManager.codeFlowInstance.getToken();
    const tokenJson = await this.getJsonObject();
    this.setMemoryCache(accessToken, tokenJson);
  }

  private setMemoryCache(accessToken: string | undefined, tokenJson: any) {
    if (accessToken) {
      if (!AzureAccountManager.domain) {
        AzureAccountManager.domain = (tokenJson as any).tid;
      }
      AzureAccountManager.username = (tokenJson as any).upn ?? (tokenJson as any).unique_name;
      tokenJson = ConvertTokenToJson(accessToken);
      const tokenExpiresIn =
        Math.round(new Date().getTime() / 1000) - ((tokenJson as any).iat as number);
      if (!memoryDictionary[(tokenJson as any).tid]) {
        // eslint-disable-next-line
        // @ts-ignore
        memoryDictionary[(tokenJson as any).tid] = new MemoryCache();
      }
      
      memoryDictionary[(tokenJson as any).tid].add(
        [
          {
            tokenType: "Bearer",
            expiresIn: tokenExpiresIn,
            expiresOn: {},
            resource: env.activeDirectoryResourceId,
            accessToken: accessToken,
            userId: (tokenJson as any).upn ?? (tokenJson as any).unique_name,
            _clientId: config.auth.clientId,
            _authority: env.activeDirectoryEndpointUrl + (tokenJson as any).tid
          }
        ],
        function () { const _ = 1; }
      );
    }
  }

  private async doGetAccountCredentialAsync(): Promise<TokenCredentialsBase | undefined> {
    if (AzureAccountManager.codeFlowInstance.account) {
      const dataJson = await this.getJsonObject();
      const checkDefaultTenant = !AzureAccountManager.tenantId || AzureAccountManager.tenantId===AzureAccountManager.domain;
      const credential = new DeviceTokenCredentials(
        config.auth.clientId,
        (dataJson as any).tid,
        (dataJson as any).upn ?? (dataJson as any).unique_name,
        undefined,
        env,
        checkDefaultTenant ? memoryDictionary[AzureAccountManager.domain!] : memoryDictionary[AzureAccountManager.tenantId!]
      );
      return Promise.resolve(credential);
    }
    return Promise.reject(LoginFailureError());
  }

  private doGetIdentityCredentialAsync(): Promise<TokenCredential | undefined> {
    return Promise.resolve(undefined);
  }

  async getJsonObject(showDialog = true): Promise<Record<string, unknown> | undefined> {
    const token = await AzureAccountManager.codeFlowInstance.getToken();
    if (token) {
      const array = token!.split(".");
      const buff = Buffer.from(array[1], "base64");
      return Promise.resolve(JSON.parse(buff.toString("utf-8")));
    } else {
      return Promise.resolve(undefined);
    }
  }

  /**
   * singnout from Azure
   */
  async signout(): Promise<boolean> {
    AzureAccountManager.codeFlowInstance.account = undefined;
    if (AzureAccountManager.statusChange !== undefined) {
      await AzureAccountManager.statusChange("SignedOut", undefined, undefined);
    }
    await AzureAccountManager.codeFlowInstance.logout();
    await this.notifyStatus();
    return Promise.resolve(true);
  }

  /**
   * Add update account info callback
   */
  async setStatusChangeCallback(
    statusChange: (status: string, token?: string, accountInfo?: Record<string, unknown>) => Promise<void>
  ): Promise<boolean> {
    AzureAccountManager.statusChange = statusChange;
    await AzureAccountManager.codeFlowInstance.reloadCache();
    if (AzureAccountManager.codeFlowInstance.account) {
      const loginToken = await AzureAccountManager.codeFlowInstance.getToken();
      const tokenJson = await this.getJsonObject();
      this.setMemoryCache(loginToken, tokenJson);
      await AzureAccountManager.statusChange("SignedIn", loginToken, tokenJson);
    }
    return Promise.resolve(true);
  }

  async getStatus(): Promise<LoginStatus> {
    if (!AzureAccountManager.codeFlowInstance.account) {
      await AzureAccountManager.codeFlowInstance.reloadCache();
    }
    if (AzureAccountManager.codeFlowInstance.account) {
      const credential = await this.getAccountCredentialAsync();
      const token = await credential?.getToken();
      const accountJson = await this.getJsonObject();
      return Promise.resolve({ status: signedIn, token: token?.accessToken, accountInfo: accountJson });
    } else {
      return Promise.resolve({ status: signedOut, token: undefined, accountInfo: undefined });
    }
  }

  setStatusChangeMap(name: string, statusChange: (status: string, token?: string, accountInfo?: Record<string, unknown>) => Promise<void>): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  removeStatusChangeMap(name: string): Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  async listSubscriptions(): Promise<SubscriptionInfo[]> {
    const credential = await this.getAccountCredentialAsync();
    const arr: SubscriptionInfo[] = [];
    if (credential) {
      const subscriptionClient = new SubscriptionClient(credential);
      const tenants = await listAll(subscriptionClient.tenants, subscriptionClient.tenants.list());
      for (let i=0;i<tenants.length;++i) {
        const token = await AzureAccountManager.codeFlowInstance.getTenantToken(tenants[i].tenantId!);
        const tokenJson = ConvertTokenToJson(token!);
        this.setMemoryCache(token, tokenJson);
        const tenantCredential = new DeviceTokenCredentials(
          config.auth.clientId,
          (tokenJson as any).tid,
          (tokenJson as any).upn ?? (tokenJson as any).unique_name,
          undefined,
          env,
          memoryDictionary[(tokenJson as any).tid]
        );
        const tenantClient = new SubscriptionClient(tenantCredential);
        const subscriptions = await listAll(tenantClient.subscriptions, tenantClient.subscriptions.list());
        for(let j=0;j<subscriptions.length;++j) {
          const item = subscriptions[j];
          arr.push({
            subscriptionId: item.subscriptionId!,
            subscriptionName: item.displayName!,
            tenantId: tenants[i].tenantId!
          });
        }
      }
    }
    return arr;
  }

  async setSubscription(subscriptionId: string): Promise<void> {
    const list = await this.listSubscriptions();
    for (let i=0;i<list.length;++i) {
      const item = list[i];
      if (item.subscriptionId==subscriptionId) {
        AzureAccountManager.tenantId = item.tenantId;
        AzureAccountManager.subscriptionId = item.subscriptionId;
        return;
      }
    }
    throw NotFoundSubscriptionId();
  }
}

// TODO: remove after api update
export type SubscriptionInfo = {
  subscriptionName: string;
  subscriptionId: string;
  tenantId: string;
};

interface PartialList<T> extends Array<T> {
  nextLink?: string;
}

// Copied from https://github.com/microsoft/vscode-azure-account/blob/2b3c1a8e81e237580465cc9a1f4da5caa34644a6/sample/src/extension.ts
// to list all subscriptions
async function listAll<T>(
  client: { listNext(nextPageLink: string): Promise<PartialList<T>> },
  first: Promise<PartialList<T>>
): Promise<T[]> {
  const all: T[] = [];
  for (
    let list = await first;
    list.length || list.nextLink;
    list = list.nextLink ? await client.listNext(list.nextLink) : []
  ) {
    all.push(...list);
  }
  return all;
}

import { MockAzureAccountProvider } from "@microsoft/teamsfx-api";

const ciEnabled = process.env.CI_ENABLED;
const azureLogin = ciEnabled && ciEnabled === "true" ? MockAzureAccountProvider.getInstance() : AzureAccountManager.getInstance();

export default azureLogin;
