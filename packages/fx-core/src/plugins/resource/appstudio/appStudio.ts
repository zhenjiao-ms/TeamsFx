// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import axios, { AxiosInstance } from "axios";
import { SystemError } from "@microsoft/teamsfx-api";
import { IAppDefinition } from "../../solution/fx-solution/appstudio/interface";
import { AppStudioError } from "./errors";
import { IPublishingAppDenition } from "./interfaces/IPublishingAppDefinition";
import { AppStudioResultFactory } from "./results";

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace AppStudioClient {
    const baseUrl = "https://dev.teams.microsoft.com";

    // Creates a new axios instance to call app studio to prevent setting the accessToken on global instance.
    function createRequesterWithToken(appStudioToken: string): AxiosInstance {
        const instance = axios.create({
            baseURL: baseUrl,
        });
        instance.defaults.headers.common["Authorization"] = `Bearer ${appStudioToken}`;
        return instance;
    }

    export async function validateManifest(manifestString: string, appStudioToken: string): Promise<string[]> {
        try {
            const requester = createRequesterWithToken(appStudioToken);
            const buffer = Buffer.from(manifestString, "utf8");
            const response = await requester.post("/api/appdefinitions/prevalidation", buffer, {headers: {"Content-Type": "application/json"}});
            if (response && response.data) {
                let validationResult: string[] = [];
                validationResult = validationResult.concat(response.data.errors);
                validationResult = validationResult.concat(response.data.warnings);
                validationResult = validationResult.concat(response.data.info);
                return validationResult;
            } else {
                throw AppStudioResultFactory.SystemError(
                    AppStudioError.ValidationFailedError.name, 
                    AppStudioError.ValidationFailedError.message(["Unknown reason"])
                );
            }
        } catch (e) {
            throw AppStudioResultFactory.SystemError(
                AppStudioError.ValidationFailedError.name, 
                AppStudioError.ValidationFailedError.message(["Unknown reason"]),
                e
            );
        }
    }

    /**
        * Update App Definition in App Studio
    */
    export async function updateTeamsApp(teamsAppId: string, appDefinition: IAppDefinition, appStudioToken: string): Promise<boolean> {
        try {
            const requester = createRequesterWithToken(appStudioToken);
            const response = await requester.post(`/api/appdefinitions/${teamsAppId}`, appDefinition);
            if (response && response.data) {
                const app = <IAppDefinition>response.data;

                if (app && app.teamsAppId && app.teamsAppId === teamsAppId) {
                    return true;
                } else {
                    throw AppStudioResultFactory.SystemError(
                        AppStudioError.TeamsAppUpdateIDNotMatchError.name, 
                        AppStudioError.TeamsAppUpdateIDNotMatchError.message(teamsAppId, app.teamsAppId)
                    );
                }
            }
        } catch (e) {
            throw AppStudioResultFactory.SystemError(
                AppStudioError.TeamsAppUpdateFailedError.name,
                AppStudioError.TeamsAppUpdateFailedError.message(teamsAppId), 
                e
            );
        }
        return false;
    }

    /**
        * Publish Teams app to Teams App Catalog
    */
    export async function publishTeamsApp(teamsAppId: string, file: Buffer, appStudioToken: string): Promise<string> {
        try {
            const requester = createRequesterWithToken(appStudioToken);
            const response = await requester.post("/api/publishing", file,  {headers: {"Content-Type": "application/zip"}});
            
            if (response && response.data) {
                if (response.data.error) {
                    throw AppStudioResultFactory.SystemError(
                        AppStudioError.TeamsAppPublishFailedError.name,
                        AppStudioError.TeamsAppPublishFailedError.message(teamsAppId),
                        response.data.error.message
                    );
                } else {
                    return response.data.id;
                }
            } else {
                throw AppStudioResultFactory.SystemError(
                    AppStudioError.TeamsAppPublishFailedError.name,
                    AppStudioError.TeamsAppPublishFailedError.message(teamsAppId)
                );
            }
        } catch (error) {
            if (error instanceof SystemError) {
                throw error;
            } else {
                throw AppStudioResultFactory.SystemError(
                    AppStudioError.TeamsAppPublishFailedError.name,
                    AppStudioError.TeamsAppPublishFailedError.message(teamsAppId),
                    error
                );
            }
        }
    }

    /**
        * Update existed publish request
    */
    export async function publishTeamsAppUpdate(teamsAppId: string, file: Buffer, appStudioToken: string): Promise<string> {
        try {
            // Get App Definition from Teams App Catalog
            const appDefinition = await getAppByTeamsAppId(teamsAppId, appStudioToken);

            const requester = createRequesterWithToken(appStudioToken);
            let response = null;
            if (appDefinition) {
                // update the existing app
                response = await requester.post(`/api/publishing/${appDefinition.teamsAppId}/appdefinitions`, file, {headers: {"Content-Type": "application/zip"}});
            } else {
                throw AppStudioResultFactory.SystemError(
                    AppStudioError.TeamsAppPublishFailedError.name,
                    AppStudioError.TeamsAppPublishFailedError.message(teamsAppId)
                );
            }
            
            if (response && response.data) {
                if (response.data.error) {
                    throw AppStudioResultFactory.SystemError(
                        AppStudioError.TeamsAppPublishFailedError.name,
                        AppStudioError.TeamsAppPublishFailedError.message(teamsAppId),
                        response.data.error.message
                    );
                } else {
                    return response.data.id;
                }
            } else {
                throw AppStudioResultFactory.SystemError(
                    AppStudioError.TeamsAppPublishFailedError.name,
                    AppStudioError.TeamsAppPublishFailedError.message(teamsAppId)
                );
            }
        } catch (error) {
            if (error instanceof SystemError) {
                throw error;
            } else {
                throw AppStudioResultFactory.SystemError(
                    AppStudioError.TeamsAppPublishFailedError.name,
                    AppStudioError.TeamsAppPublishFailedError.message(teamsAppId),
                    error
                );
            }
        }
    }

    export async function getAppByTeamsAppId(teamsAppId: string, appStudioToken: string): Promise<IPublishingAppDenition | undefined> {
        const requester = createRequesterWithToken(appStudioToken);
        const response = await requester.get(`/api/publishing/${teamsAppId}`);
        if (response && response.data && response.data.value && response.data.value.length > 0) {
            const appdefinitions: IPublishingAppDenition[] = response.data.value[0].appDefinitions
            .map((item: any) => {
                return {
                    lastModifiedDateTime: item.lastModifiedDateTime ? new Date(item.lastModifiedDateTime): null,
                    publishingState: item.publishingState,
                    teamsAppId: item.teamsAppId,
                    displayName: item.displayName
                };
            });
            return appdefinitions[appdefinitions.length - 1];
        } else {
            return undefined;
        }
    }
}