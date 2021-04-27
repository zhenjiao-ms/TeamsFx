// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
"use strict";

import { Result } from "neverthrow";  
import { Context, SolutionSetting, SolutionState, EnvMeta, Func, FunctionRouter, FxError, Inputs, QTreeNode, ResourceConfigs, ResourceTemplates, Task, TokenProvider, Void, ResourceInstanceValues, StateValues } from "./index";



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
     * execute user customized {@link Task}, for example `Add Resource`, `Add Capabilities`, etc
     */
    executeUserTask?: (ctx: SolutionAllContext, func:Func, inputs: Inputs) => Promise<Result<unknown, FxError>>;

    /**
     * There are three scenarios to use this API in question model:
     * 1. answer questions of type `FuncQuestion`. Unlike normal questions, the answer of which is returned by humen input, the answer of `FuncQuestion` is automatically returned by this `executeFuncQuestion` call.
     * 2. retrieve dynamic option item list for `SingleSelectQuestion` or `MultiSelectQuestion`. In such a case, the option is defined by `DynamicOption`. When the UI visit such select question, this `executeFuncQuestion` will be called to get option list.
     * 3. validation for `TextInputQuestion`, core,solution plugin or resource plugin can define the validation function in `executeFuncQuestion`.
     * `executeQuestionFlowFunction` will router the execute request from core--->solution--->resource plugin according to `FunctionRouter`.
     */
     executeQuestionFlowFunction?: (ctx: SolutionAllContext, func:Func, inputs: Inputs) => Promise<Result<unknown, FxError>>;
}
