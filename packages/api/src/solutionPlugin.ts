// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
"use strict";

import { Result } from "neverthrow";  
import { Context, SolutionSetting, SolutionState, EnvMeta, FunctionRouter, FxError, Inputs, QTreeNode, ResourceConfigs, ResourceTemplates, Task, TokenProvider, Void, ResourceInstanceValues, StateValues, Func } from "./index";



export interface SolutionContext extends Context{
    solutionSetting: SolutionSetting;
    solutionState: SolutionState;
}


export interface SolutionEnvContext  extends SolutionContext {
    env: EnvMeta;
    tokenProvider: TokenProvider;
    resourceConfigs: ResourceConfigs;
}

export interface SolutionScaffoldResult{
    provisionTemplates:ResourceTemplates;
    deployTemplates: ResourceTemplates
}
 
export interface SolutionAllContext extends SolutionContext {
    env: EnvMeta;
    tokenProvider: TokenProvider;
    provisionConfigs?: ResourceConfigs;
    deployConfigs?: ResourceConfigs;
}


export interface ResourceEnvResult {
    resourceValues: ResourceInstanceValues,
    stateValues: StateValues
}
 

export interface SolutionPlugin {
    
    name:string,
    
    displayName:string,

    /**
     * scaffold a project and return solution config template
     */
    scaffoldFiles: (ctx: SolutionContext, inputs: Inputs) => Promise<Result<SolutionScaffoldResult, FxError>>;

    /**
     * build
     */
    buildArtifacts: (ctx: SolutionContext, inputs: Inputs) => Promise<Result<Void, FxError>>;

    /**
     * provision will output VariableDict even error happends
     */
    provisionResources: (ctx: SolutionEnvContext, inputs: Inputs) => Promise<Result<ResourceEnvResult, FxError & {result:ResourceEnvResult}>>;

    /**
     * deploy will output VariableDict even error happends
     */
    deployArtifacts: (ctx: SolutionEnvContext, inputs: Inputs) => Promise<Result<ResourceEnvResult, FxError & {result:ResourceEnvResult}>>;
 
    /**
     * publish
     * TODO: Just need manifest
     */
    publishApplication: (ctx: SolutionAllContext, inputs: Inputs) => Promise<Result<ResourceEnvResult, FxError>>;

    /**
     * get question model for lifecycle {@link Task} (create, provision, deploy, publish), Questions are organized as a tree. Please check {@link QTreeNode}.
     */
    getQuestionsForLifecycleTask: (ctx: SolutionAllContext, task: Task, inputs: Inputs) => Promise<Result<QTreeNode|undefined, FxError>>;

    /**
     * get question model for plugin customized {@link Task}, Questions are organized as a tree. Please check {@link QTreeNode}.
     */
    getQuestionsForUserTask?: (ctx: SolutionAllContext, router: FunctionRouter, inputs: Inputs) => Promise<Result<QTreeNode|undefined, FxError>>;

    /**
     * execute user customized task, for example `Add Resource`, `Add Capabilities`, etc
     */
    executeUserTask?: (ctx: SolutionAllContext, func:Func, inputs: Inputs) => Promise<Result<unknown, FxError>>;
}
