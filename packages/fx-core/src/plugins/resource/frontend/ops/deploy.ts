// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { AzureStorageClient } from "../clients";
import {
    BuildError,
    ClearStorageError,
    GetContainerError,
    NpmInstallError,
    UploadToStorageError,
    runWithErrorCatchAndThrow,
} from "../resources/errors";
import { Commands, Constants, FrontendPathInfo } from "../constants";
import { DeploySteps, ProgressHelper } from "../utils/progress-helper";
import { Logger } from "../utils/logger";
import { Messages } from "../resources/messages";
import { Utils } from "../utils";
import fs from "fs-extra";
import path from "path";

interface DeploymentInfo {
    lastBuildTime?: string,
    lastDeployTime?: string,
}

export class FrontendDeployment {
    public static async needBuild(componentPath: string): Promise<boolean> {
        const lastBuildTime = await FrontendDeployment.getLastBuildTime(componentPath);
        if (!lastBuildTime) {
            return true;
        }
        return FrontendDeployment.hasUpdatedContent(componentPath, lastBuildTime);
    }

    public static async needDeploy(componentPath: string): Promise<boolean> {
        const lastBuildTime = await FrontendDeployment.getLastBuildTime(componentPath);
        const lastDeployTime = await FrontendDeployment.getLastDeploymentTime(componentPath);
        if (!lastBuildTime || !lastDeployTime) {
            return true;
        }
        return lastDeployTime < lastBuildTime;
    }

    public static async doFrontendBuild(componentPath: string): Promise<void> {
        if (!(await FrontendDeployment.needBuild(componentPath))) {
            return FrontendDeployment.skipBuild();
        }

        const progressHandler = ProgressHelper.deployProgress;

        await progressHandler?.next(DeploySteps.NPMInstall);
        await runWithErrorCatchAndThrow(new NpmInstallError(), async () => {
            await Utils.execute(Commands.InstallNodePackages, componentPath);
        });

        await progressHandler?.next(DeploySteps.Build);
        await runWithErrorCatchAndThrow(new BuildError(), async () => {
            await Utils.execute(Commands.BuildFrontend, componentPath);
        });
        await FrontendDeployment.saveDeploymentInfo(componentPath, { lastBuildTime: new Date().toISOString() });
    }

    public static async skipBuild(): Promise<void> {
        const progressHandler = ProgressHelper.deployProgress;
        Logger.info(Messages.SkipBuild());
        await progressHandler?.next(DeploySteps.NPMInstall);
        await progressHandler?.next(DeploySteps.Build);
    }

    public static async getBuiltPath(componentPath: string): Promise<string> {
        const builtPath = path.join(componentPath, FrontendPathInfo.BuildPath);
        const pathExists = await fs.pathExists(builtPath);
        if (!pathExists) {
            throw new BuildError();
        }
        return builtPath;
    }

    public static async doFrontendDeployment(client: AzureStorageClient, componentPath: string): Promise<void> {
        if (!(await FrontendDeployment.needDeploy(componentPath))) {
            return FrontendDeployment.skipDeployment();
        }

        const progressHandler = ProgressHelper.deployProgress;

        await progressHandler?.next(DeploySteps.getSrcAndDest);
        const builtPath = await FrontendDeployment.getBuiltPath(componentPath);
        const container = await runWithErrorCatchAndThrow(
            new GetContainerError(),
            async () => await client.getContainer(Constants.AzureStorageWebContainer),
        );

        await progressHandler?.next(DeploySteps.Clear);
        await runWithErrorCatchAndThrow(new ClearStorageError(), async () => {
            await client.deleteAllBlobs(container);
        });

        await progressHandler?.next(DeploySteps.Upload);
        await runWithErrorCatchAndThrow(new UploadToStorageError(), async () => {
            await client.uploadFiles(container, builtPath);
        });

        await FrontendDeployment.saveDeploymentInfo(componentPath, { lastDeployTime: new Date().toISOString() });
    }

    public static async skipDeployment(): Promise<void> {
        const progressHandler = ProgressHelper.deployProgress;
        Logger.info(Messages.SkipDeploy());
        await progressHandler?.next(DeploySteps.getSrcAndDest);
        await progressHandler?.next(DeploySteps.Clear);
        await progressHandler?.next(DeploySteps.Upload);
    }

    private static async hasUpdatedContent(componentPath: string, referenceTime: Date): Promise<boolean> {
        const folderFilter = (itemPath: string) =>
            !FrontendPathInfo.TabDeployIgnoreFolder.includes(path.basename(itemPath));

        let changed = false;
        await Utils.forEachFileAndDir(
            componentPath,
            (itemPath, stats) => {
                const relativePath = path.relative(componentPath, itemPath);
                if (relativePath && referenceTime < stats.mtime) {
                    changed = true;
                    return true;
                }
            },
            folderFilter,
        );

        return changed;
    }

    private static async getDeploymentInfo(componentPath: string): Promise<DeploymentInfo | undefined> {

        const deploymentDir = path.join(componentPath, FrontendPathInfo.TabDeploymentFolderName);
        const deploymentInfoPath = path.join(deploymentDir, FrontendPathInfo.TabDeploymentInfoFileName);

        try {
            return await fs.readJSON(deploymentInfoPath);
        } catch {
            return undefined;
        }
    }

    private static async getLastBuildTime(componentPath: string): Promise<Date | undefined> {
        const deploymentInfoJson = await FrontendDeployment.getDeploymentInfo(componentPath);
        return deploymentInfoJson?.lastBuildTime ? new Date(deploymentInfoJson.lastBuildTime) : undefined;
    }

    private static async getLastDeploymentTime(componentPath: string): Promise<Date | undefined> {
        const deploymentInfoJson = await FrontendDeployment.getDeploymentInfo(componentPath);
        return deploymentInfoJson?.lastDeployTime ? new Date(deploymentInfoJson.lastDeployTime) : undefined;
    }

    private static async saveDeploymentInfo(componentPath: string, deploymentInfo: DeploymentInfo): Promise<void> {
        const deploymentDir = path.join(componentPath, FrontendPathInfo.TabDeploymentFolderName);
        const deploymentInfoPath = path.join(deploymentDir, FrontendPathInfo.TabDeploymentInfoFileName);

        await fs.ensureDir(deploymentDir);
        let deploymentInfoJson: any = {};
        try {
            deploymentInfoJson = await fs.readJSON(deploymentInfoPath);
        } catch {
            // Failed to read info file, which doesn't block deployment
        }

        deploymentInfoJson.lastBuildTime = deploymentInfo.lastBuildTime ?? deploymentInfoJson.lastBuildTime;
        deploymentInfoJson.lastDeployTime = deploymentInfo.lastDeployTime ?? deploymentInfoJson.lastDeployTime;

        try {
            await fs.writeJSON(deploymentInfoPath, deploymentInfoJson);
        } catch {
            // Failed to write deployment info, which doesn't block deployment
        }
    }
}
