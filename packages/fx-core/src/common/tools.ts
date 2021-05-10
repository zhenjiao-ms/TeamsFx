// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import { exec } from "child_process";
import * as fs from "fs-extra";
import { ConfigMap, Dict, Json } from "@microsoft/teamsfx-api";
import { promisify } from "util";
import axios from "axios";
import AdmZip from "adm-zip";
import * as path from "path";

const execAsync = promisify(exec);

export async function npmInstall(path: string) {
    await execAsync("npm install", {
        cwd: path,
    });
}

export async function ensureUniqueFolder(folderPath: string): Promise<string> {
    let folderId = 1;
    let testFolder = folderPath;

    let pathExists = await fs.pathExists(testFolder);
    while (pathExists) {
        testFolder = `${folderPath}${folderId}`;
        folderId++;

        pathExists = await fs.pathExists(testFolder);
    }

    return testFolder;
}

/**
 * Convert a `Map` to a Json recursively.
 * @param {Map} map to convert.
 * @returns {Json} converted Json.
 */
export function mapToJson(map: Map<any, any>): Json {
    const out: Json = {};
    for (const entry of map.entries()) {
        if (entry[1] instanceof Map) {
            out[entry[0]] = mapToJson(entry[1]);
        } else {
            out[entry[0]] = entry[1];
        }
    }
    return out;
}

/**
 * Convert an `Object` to a Map recursively
 * @param {Json} Json to convert.
 * @returns {Map} converted Json.
 */
export function objectToMap(o: Json): Map<any, any> {
    const m = new Map();
    for (const entry of Object.entries(o)) {
        if (entry[1] instanceof Array) {
            m.set(entry[0], entry[1]);
        } else if (entry[1] instanceof Object) {
            m.set(entry[0], objectToConfigMap(entry[1] as Json));
        } else {
            m.set(entry[0], entry[1]);
        }
    }
    return m;
}

/** 
 * @param {Json} Json to convert.
 * @returns {Map} converted Json.
 */
export function objectToConfigMap(o?: Json): ConfigMap {
    const m = new ConfigMap();
    if (o) {
        for (const entry of Object.entries(o)) {
            {
                m.set(entry[0], entry[1]);
            }
        }
    }
    return m;
}




const SecretDataMatchers = ["fx-resource-aad-app-for-teams.clientSecret",
    "fx-resource-aad-app-for-teams.local_clientSecret",
    "fx-resource-simple-auth.filePath",
    "fx-resource-simple-auth.environmentVariableParams",
    "fx-resource-local-debug.*",
    "fx-resource-bot.botPassword",
    "fx-resource-bot.localBotPassword",
    "fx-resource-apim.apimClientAADClientSecret"];

export function sperateSecretData(configJson:Json): Dict<string>{
    const res:Dict<string> = {};
    for(const matcher of SecretDataMatchers ){
        const splits = matcher.split(".");
        const resourceId = splits[0];
        const item = splits[1];
        const resourceConfig:any = configJson[resourceId];
        if(!resourceConfig) continue;
        if("*" !== item) {
            const configValue = resourceConfig[item];
            if(configValue){
                const keyName = `${resourceId}.${item}`;
                res[keyName] = configValue;
                resourceConfig[item] = `{{${keyName}}}`;
            }
        }
        else {
            for(const itemName of Object.keys(resourceConfig)){
                const configValue = resourceConfig[itemName];
                if(configValue !== undefined){
                    const keyName = `${resourceId}.${itemName}`;
                    res[keyName] = configValue;
                    resourceConfig[itemName] = `{{${keyName}}}`;
                }
            }
        }
    }
    return res;
}

export function mergeSerectData(dict: Dict<string>, configJson:Json):void{
    for(const matcher of SecretDataMatchers ){
        const splits = matcher.split(".");
        const resourceId = splits[0];
        const item = splits[1];
        const resourceConfig:any = configJson[resourceId];
        if(!resourceConfig) continue;
        if("*" !== item) {
            const originalItemValue:string|undefined = resourceConfig[item] as string|undefined;
            if(originalItemValue && originalItemValue.startsWith("{{") && originalItemValue.endsWith("}}")){
                const keyName = `${resourceId}.${item}`;
                resourceConfig[item] = dict[keyName];
            }
        }
        else {
            for(const itemName of Object.keys(resourceConfig)){
                const originalItemValue = resourceConfig[itemName];
                if(originalItemValue && originalItemValue.startsWith("{{") && originalItemValue.endsWith("}}")){
                    const keyName = `${resourceId}.${itemName}`;
                    resourceConfig[itemName] = dict[keyName];
                }
            }
        }
    }
}

export function serializeDict(dict: Dict<string>):string{
    const array:string[] = [];
    for(const key of Object.keys(dict)){
       const value = dict[key];
       array.push(`${key}=${value}`);
    }
    return array.join("\n");
}

export function deserializeDict(data:string):Dict<string>{
    const lines = data.split("\n");
    const dict: Dict<string> = {};
    for(const line of lines){
        const index = line.indexOf("=");
        if(index > 0){
            const key = line.substr(0, index);
            const value = line.substr(index+1);
            dict[key] = value;
        }
         
    }
    return dict;
}


export async function fetchCodeZip(url: string) {
    let retries = 3;
    let result = undefined;
    while (retries > 0) {
        retries--;
        try {
        result = await axios.get(url, {
            responseType: "arraybuffer"
        });
        if (result.status === 200 || result.status === 201) {
            return result;
        }
        } catch (e) {
        await new Promise<void>((resolve: () => void): NodeJS.Timer => setTimeout(resolve, 10000));
        }
    }
    return result;
}

export async function saveFilesRecursively(zip: AdmZip, dstPath: string): Promise<void> {
    await Promise.all(
        zip
        .getEntries()
        .filter((entry) => !entry.isDirectory)
        .map(async (entry) => {
            const data = entry.getData().toString();

            const filePath = path.join(dstPath, entry.entryName);
            await fs.ensureDir(path.dirname(filePath));
            await fs.writeFile(filePath, data);
        })
    );
}



export const deepCopy = <T>(target: T): T => {
    if (target === null) {
      return target;
    }
    if (target instanceof Date) {
      return new Date(target.getTime()) as any;
    }
    if (target instanceof Array) {
      const cp = [] as any[];
      (target as any[]).forEach((v) => {
        cp.push(v);
      });
      return cp.map((n: any) => deepCopy<any>(n)) as any;
    }
    if (typeof target === "object" && target !== {}) {
      const cp = { ...(target as { [key: string]: any }) } as {
        [key: string]: any;
      };
      Object.keys(cp).forEach((k) => {
        cp[k] = deepCopy<any>(cp[k]);
      });
      return cp as T;
    }
    return target;
  };