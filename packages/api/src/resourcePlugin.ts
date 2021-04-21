// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
"use strict";
  
import { Result } from "neverthrow"; 
import { ResourceSetting, ResourceState,Context, EnvMeta, Func, FunctionRouter, FxError, Inputs, QTreeNode, ReadonlyResourceConfig, ReadonlyResourceConfigs, ResourceConfig, ResourceTemplate, Task, TokenProvider, Void, SolutionAllContext, ResourceInstanceValues, StateValues, ResourceEnvResult } from "./index";


export interface ResourceContext extends Context {
    resourceSettings: ResourceSetting;
    resourceStates: ResourceState;
}

export interface ResourceScaffoldResult{
    provision:ResourceTemplate;
    deploy:ResourceTemplate
}


export interface ResourceEnvContext  extends ResourceContext {
    envMeta: EnvMeta;
    tokenProvider: TokenProvider;  
    commonConfig: ReadonlyResourceConfig;
    selfConfig: ResourceConfig;
}

export interface ResourceConfigureContext extends ResourceEnvContext
{
    allProvisionConfigs: ReadonlyResourceConfigs;
}
 

export interface ResourceAllContext  extends ResourceContext {
    envMeta: EnvMeta;
    tokenProvider: TokenProvider;  
    provisionConfig?: ResourceConfig;
    deployConfig?: ResourceConfig;
}

export interface ResourceAllContext  extends ResourceContext {
    envMeta: EnvMeta;
    tokenProvider: TokenProvider;  
    provisionConfig?: ResourceConfig;
    deployConfig?: ResourceConfig;
}

 
export interface ResourcePlugin {

    name:string,

    displayName:string,

    /**
     * scaffold source code on disk
     */
    scaffoldSourceCode?: (ctx: ResourceContext, inputs: Inputs) => Promise<Result<Void, FxError>>;  

    /**
     * scaffold a memory version of config template (provision and deploy are seperated)
     */
    scaffoldResourceTemplate?: (ctx: ResourceContext, inputs: Inputs) => Promise<Result<ResourceScaffoldResult, FxError>>; 
    
    /**
     * provision resource to cloud, output variable dictionary data
     */
    provision?: (ctx: ResourceEnvContext, inputs: Inputs) => Promise<Result<ResourceEnvResult, FxError>>;

    /**
     * Configure provisioned resources.  TODO:renaming
     */
    configureProvisionedResources?: (ctx: ResourceConfigureContext) => Promise<Result<Void, FxError>>;

    /**
     * build artifacts
     */
    build?: (ctx: ResourceContext, inputs: Inputs) => Promise<Result<Void, FxError>>;

    /**
     * deploy resource   confirm the output??
     */
    deploy?: (ctx: ResourceEnvContext, inputs: Inputs) => Promise<Result<ResourceEnvResult, FxError>>;

    /**
     * publish app confirm the output??
     * TODO: Just need manifest
     */
    publish?: (ctx: SolutionAllContext, inputs: Inputs) => Promise<Result<ResourceEnvResult, FxError>>;
   
    /**
     * get question model for lifecycle {@link Task} (create, provision, deploy, publish), Questions are organized as a tree. Please check {@link QTreeNode}.
     */
    getQuestionsForLifecycleTask?: (ctx: ResourceAllContext, task: Task, inputs: Inputs) => Promise<Result<QTreeNode|undefined, FxError>>;

    /**
     * get question model for plugin customized {@link Task}, Questions are organized as a tree. Please check {@link QTreeNode}.
     */
    getQuestionsForUserTask?: (ctx: ResourceAllContext, router: FunctionRouter, inputs: Inputs) => Promise<Result<QTreeNode | undefined, FxError>>;

    /**
     * execute user customized {@link Task}, for example `Add Resource`, `Add Capabilities`, etc
     * `executeUserTask` will router the execute request and dispatch from core--->solution--->resource plugin according to `Func`.
     */
    executeUserTask?: (ctx: ResourceAllContext, func:Func, inputs: Inputs) => Promise<Result<unknown, FxError>>;
    
    /**
     * There are three scenarios to use this API in question model:
     * 1. answer questions of type `FuncQuestion`. Unlike normal questions, the answer of which is returned by humen input, the answer of `FuncQuestion` is automatically returned by this `executeQuestionFlowFunction` call.
     * 2. retrieve dynamic option item list for `SingleSelectQuestion` or `MultiSelectQuestion`. In such a case, the option is defined by `DynamicOption`. When the UI visit such select question, this `executeQuestionFlowFunction` will be called to get option list.
     * 3. validation for `TextInputQuestion`, core,solution plugin or resource plugin can define the validation function in `executeQuestionFlowFunction`.
     * `executeQuestionFlowFunction` will router the execute request from core--->solution--->resource plugin according to `FunctionRouter`.
     */
     executeQuestionFlowFunction?: (ctx: ResourceAllContext, func:Func, inputs: Inputs) => Promise<Result<unknown, FxError>>;
}
