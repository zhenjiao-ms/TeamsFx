/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/ban-types */
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

"use strict";

import { AppStudioTokenProvider, UserError } from "fx-api";
import { LogLevel } from "@azure/msal-node";
import { ExtensionErrors } from "../error";
import { CodeFlowLogin } from "./codeFlowLogin";
import VsCodeLogInstance from "./log";
import * as vscode from "vscode";
import { getBeforeCacheAccess, getAfterCacheAccess } from "./cacheAccess";
import { signedIn, signedOut } from "./common/constant";
import { login, LoginStatus } from "./common/login";
import * as StringResources from "../resources/Strings.json";
import * as util from "util";

const accountName = "appStudio";
const scopes = ["https://dev.teams.microsoft.com/AppDefinitions.ReadWrite"];
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
    authority: "https://login.microsoftonline.com/common"
  },
  system: {
    loggerOptions: {
      // @ts-ignore
      loggerCallback(loglevel, message, containsPii) {
        VsCodeLogInstance.info(message);
      },
      piiLoggingEnabled: false,
      logLevel: LogLevel.Error
    }
  },
  cache: {
    cachePlugin
  }
};

export class AppStudioLogin extends login implements AppStudioTokenProvider {
  private static instance: AppStudioLogin;
  private static codeFlowInstance: CodeFlowLogin;

  private static statusChange?: (
    status: string,
    token?: string,
    accountInfo?: Record<string, unknown>
  ) => Promise<void>;

  private constructor() {
    super();
    AppStudioLogin.codeFlowInstance = new CodeFlowLogin(scopes, config, SERVER_PORT, accountName);
  }

  /**
   * Gets instance
   * @returns instance
   */
  public static getInstance(): AppStudioLogin {
    if (!AppStudioLogin.instance) {
      AppStudioLogin.instance = new AppStudioLogin();
    }

    return AppStudioLogin.instance;
  }

  /**
   * Get team access token
   */
  async getAccessToken(showDialog = true): Promise<string | undefined> {
    if (!AppStudioLogin.codeFlowInstance.account) {
      if (showDialog) {
        const userConfirmation: boolean = await this.doesUserConfirmLogin();
        if (!userConfirmation) {
          // throw user cancel error
          throw new UserError(ExtensionErrors.UserCancel, StringResources.vsc.common.userCancel, "Login");
        }
      }
      const loginToken = await AppStudioLogin.codeFlowInstance.getToken();
      if (loginToken && AppStudioLogin.statusChange !== undefined) {
        const tokenJson = await this.getJsonObject();
        await AppStudioLogin.statusChange("SignedIn", loginToken, tokenJson);
      }
      await this.notifyStatus();
      return loginToken;
    }

    return AppStudioLogin.codeFlowInstance.getToken();
  }

  async getJsonObject(showDialog = true): Promise<Record<string, unknown> | undefined> {
    const token = await this.getAccessToken(showDialog);
    if (token) {
      const array = token.split(".");
      const buff = Buffer.from(array[1], "base64");
      return new Promise((resolve) => {
        resolve(JSON.parse(buff.toString("utf-8")));
      });
    } else {
      return new Promise((resolve) => {
        resolve(undefined);
      });
    }
  }

  async signout(): Promise<boolean> {
    const userConfirmation = await this.doesUserConfirmSignout();
    if (!userConfirmation) {
      throw new UserError(ExtensionErrors.UserCancel, StringResources.vsc.common.userCancel, "SignOut");
    }
    AppStudioLogin.codeFlowInstance.account = undefined;
    if (AppStudioLogin.statusChange !== undefined) {
      await AppStudioLogin.statusChange("SignedOut", undefined, undefined);
    }
    await AppStudioLogin.codeFlowInstance.logout();
    await this.notifyStatus();
    return new Promise((resolve) => {
      resolve(true);
    });
  }

  private async doesUserConfirmLogin(): Promise<boolean> {
    const warningMsg = StringResources.vsc.appStudioLogin.warningMsg;
    const signin = StringResources.vsc.common.signin;
    const readMore = StringResources.vsc.common.readMore;
    const cancel = StringResources.vsc.common.cancel;
    let userSelected: string | undefined;
    do {
      userSelected = await vscode.window.showInformationMessage(
        warningMsg,
        signin,
        readMore,
        cancel
      );
      if (userSelected === readMore) {
        vscode.env.openExternal(vscode.Uri.parse("https://developer.microsoft.com/en-us/microsoft-365/dev-program"));
      }
    } while (userSelected === readMore);
    return Promise.resolve(userSelected === signin);
  }

  private async doesUserConfirmSignout(): Promise<boolean> {
    const accountInfo = AppStudioLogin.codeFlowInstance.account;
    const email = accountInfo?.username;
    const confirm = StringResources.vsc.common.signout;
    const userSelected = await vscode.window.showInformationMessage(
      util.format(StringResources.vsc.common.signOutOf, email),
      confirm,
      StringResources.vsc.common.cancel
    );
    return Promise.resolve(userSelected === confirm);
  }

  async setStatusChangeCallback(
    statusChange: (status: string, token?: string, accountInfo?: Record<string, unknown>) => Promise<void>
  ): Promise<boolean> {
    AppStudioLogin.statusChange = statusChange;
    await AppStudioLogin.codeFlowInstance.reloadCache();
    if (AppStudioLogin.codeFlowInstance.account) {
      const loginToken = await AppStudioLogin.codeFlowInstance.getToken();
      const tokenJson = await this.getJsonObject();
      await AppStudioLogin.statusChange("SignedIn", loginToken, tokenJson);
    }
    return new Promise((resolve) => {
      resolve(true);
    });
  }

  async getStatus(): Promise<LoginStatus> {
    await AppStudioLogin.codeFlowInstance.reloadCache();
    if (AppStudioLogin.codeFlowInstance.account) {
      const loginToken = await AppStudioLogin.codeFlowInstance.getToken();
      const tokenJson = await this.getJsonObject();
      return Promise.resolve({ status: signedIn, token: loginToken, accountInfo: tokenJson });
    } else {
      return Promise.resolve({ status: signedOut, token: undefined, accountInfo: undefined });
    }
  }
}

export default AppStudioLogin.getInstance();
