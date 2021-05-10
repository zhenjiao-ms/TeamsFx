// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import path from "path";
import { AzureSolutionSettings, PluginContext } from "@microsoft/teamsfx-api";
import { DependentPluginInfo, FrontendPathInfo } from "../constants";
import { InvalidTabLanguageError } from "./errors";

export interface TemplateVariable {
    showFunction: boolean;
}

export class TabLanguage {
    static readonly JavaScript = "JavaScript";
    static readonly TypeScript = "TypeScript";
}

export class Scenario {
    static readonly Default = "default";
    static readonly WithFunction = "with-function";
}

export class TemplateInfo {
    group: string;
    language: string;
    scenario: string;
    version: string;
    localTemplatePath: string;
    variables: TemplateVariable;

    constructor(ctx: PluginContext) {
        this.group = TemplateInfo.TemplateGroupName;
        this.version = TemplateInfo.version;

        const solutionPlugin = ctx.configOfOtherPlugins.get(DependentPluginInfo.SolutionPluginName);
        const tabLanguage = solutionPlugin?.get(DependentPluginInfo.ProgrammingLanguage) as string ?? TabLanguage.JavaScript;
        this.language = this.validateTabLanguage(tabLanguage);

        const selectedPlugins = (ctx.projectSettings?.solutionSettings as AzureSolutionSettings).activeResourcePlugins;
        const isFunctionPlugin = selectedPlugins.some((pluginName) => pluginName === DependentPluginInfo.FunctionPluginName);
        this.variables = {
            showFunction: isFunctionPlugin
        };

        this.scenario = Scenario.Default;

        const localTemplateFileName = [this.group, this.language, this.scenario].join(".") + FrontendPathInfo.TemplatePackageExt;
        this.localTemplatePath = path.join(FrontendPathInfo.TemplateDir, localTemplateFileName);
    }

    private validateTabLanguage(language: string): string {
        if (language.toLowerCase() === TabLanguage.JavaScript.toLowerCase()) {
            return TabLanguage.JavaScript;
        }

        if (language.toLowerCase() === TabLanguage.TypeScript.toLowerCase()) {
            return TabLanguage.TypeScript;
        }

        throw new InvalidTabLanguageError();
    }

    static readonly TemplateGroupName = "tab";
    static readonly version = "0.4.x";
}
