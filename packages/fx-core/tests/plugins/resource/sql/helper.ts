import * as msRestNodeAuth from "@azure/ms-rest-nodeauth";
import { PluginContext } from "@microsoft/teamsfx-api";
import { Constants } from "../../../../src/plugins/resource/sql/constants";

export class TestHelper {
    static async pluginContext(credentials: msRestNodeAuth.TokenCredentialsBase): Promise<PluginContext> {
        const pluginContext = ({
            azureAccountProvider: {
                getAccountCredentialAsync() {
                    return credentials;
                },
                getIdentityCredentialAsync() {
                    return credentials;
                }
            },
            logProvider: {
                async info(message: string): Promise<boolean> {
                    console.info(message);
                    return true;
                },
                async error(message: string): Promise<boolean> {
                    console.error(message);
                    return true;
                },
                async debug(message: string): Promise<boolean> {
                    console.debug(message);
                    return true;
                },
            },
            dialog: {
                createProgressBar(title: string, totalSteps: number) {
                    console.log(`Create ProgressBar, title: ${title}, totalSteps: ${totalSteps}`);
                    return {
                        start: (detail?: string) => {
                            console.log("start detail: " + detail);
                        },
                        next: (detail?: string) => {
                            console.log("next detail: " + detail);
                        },
                        end: () => {
                            console.log("ProgressBar end");
                        },
                    };
                },
            },
            telemetryReporter: {
                async sendTelemetryEvent(
                    eventName: string,
                    properties?: { [key: string]: string; },
                    measurements?: { [key: string]: number; },
                ) {
                    console.log("Telemetry event");
                    console.log(eventName);
                    console.log(properties);
                },

                async sendTelemetryErrorEvent(
                    eventName: string,
                    properties?: { [key: string]: string; },
                    measurements?: { [key: string]: number; },
                ) {
                    console.log("Telemetry Error");
                    console.log(eventName);
                    console.log(properties);
                },

                async sendTelemetryException(
                    error: Error,
                    properties?: { [key: string]: string; },
                    measurements?: { [key: string]: number; },
                ) {
                    console.log("Telemetry Exception");
                    console.log(error.name);
                    console.log(error.message);
                    console.log(properties);
                },
            },
            config: new Map(),
            configOfOtherPlugins: new Map([
                [
                    Constants.solution,
                    new Map([
                        [
                            Constants.solutionConfigKey.resourceNameSuffix,
                            Math.random().toString(36).substring(2, 8),
                        ],
                        [Constants.solutionConfigKey.subscriptionId, "1756abc0-3554-4341-8d6a-46674962ea19"],
                        [Constants.solutionConfigKey.resourceGroupName, "zhaofengtest"],
                        [Constants.solutionConfigKey.location, "eastus"],
                    ]),
                ],
                [
                    Constants.identityPlugin,
                    new Map([
                        [Constants.identity, "zhaofeng-msi"],
                    ]),
                ],
            ]),
            app: {
                name: {
                    short: "hello-app",
                },
            },
        } as unknown) as PluginContext;

        return pluginContext;
    }
}