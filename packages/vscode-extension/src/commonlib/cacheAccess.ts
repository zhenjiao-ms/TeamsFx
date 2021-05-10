/* eslint-disable @typescript-eslint/ban-ts-comment */
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

"use strict";

import * as fs from "fs-extra";
import { ConfigFolderName } from "@microsoft/teamsfx-api";
import * as os from "os";
import VsCodeLogInstance from "./log";

export const cacheDir = os.homedir + `/.${ConfigFolderName}/account`;
export const cachePath = os.homedir + `/.${ConfigFolderName}/account/token.cache.`;
export const accountPath = os.homedir + `/.${ConfigFolderName}/account/homeId.cache.`;
export const homeAccountId = "home_account_id";
export const UTF8 = "utf-8";
const cachePathEnd = ".json";
import * as StringResources from "../resources/Strings.json";

export function getBeforeCacheAccess(accountName: string) {
  //@ts-ignore
  const beforeCacheAccess = async (cacheContext): Promise<void> => {
    return new Promise(async (resolve, reject) => {
      await fs.ensureDir(cacheDir);
      const fileCachePath = getCachePath(accountName);
      if (fs.existsSync(fileCachePath)) {
        fs.readFile(fileCachePath, UTF8, (err, data) => {
          try {
            JSON.parse(data);
          } catch (error) {
            fs.writeFileSync(fileCachePath, "", UTF8);
          }
          if (err) {
            VsCodeLogInstance.error(StringResources.vsc.cacheAccess.readTokenFail + err.message);
            reject();
          } else {
            cacheContext.tokenCache.deserialize(data);
            resolve();
          }
        });
      } else {
        fs.writeFile(fileCachePath, cacheContext.tokenCache.serialize(), (err) => {
          if (err) {
            VsCodeLogInstance.error(StringResources.vsc.cacheAccess.writeTokenFail + err.message);
            reject();
          }
        });
        resolve();
      }
    });
  };
  return beforeCacheAccess;
}

export function getAfterCacheAccess(scopes: string[], accountName: string) {
  //@ts-ignore
  const afterCacheAccess = async (cacheContext) => {
    if (cacheContext.cacheHasChanged) {
      const fileCachePath = getCachePath(accountName);
      // save token
      fs.writeFile(fileCachePath, cacheContext.tokenCache.serialize(), (err) => {
        if (err) {
          VsCodeLogInstance.error(StringResources.vsc.cacheAccess.saveTokenFail + err.message);
        }
      });

      // save home_account_id for later restore
      const data = JSON.parse(cacheContext.tokenCache.serialize());
      for (const key in data.AccessToken) {
        if (key.indexOf(scopes[0].toLowerCase()) != -1) {
          fs.writeFile(accountPath + accountName, data.AccessToken[key][homeAccountId], (err) => {
            if (err) {
              VsCodeLogInstance.error(StringResources.vsc.cacheAccess.saveHomeAccountIdFail + err.message);
            }
          });
        }
      }
    }
  };
  return afterCacheAccess;
}

export function getCachePath(accountName: string) {
  return cachePath + accountName + cachePathEnd;
}
