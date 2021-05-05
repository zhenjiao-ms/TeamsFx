// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
"use strict";
  
import { Result } from "neverthrow"; 
import { ResourceSetting, ResourceState,Context, EnvMeta, FunctionRouter, FxError, Inputs, QTreeNode, ReadonlyResourceConfig, ReadonlyResourceConfigs, ResourceConfig, ResourceTemplate, Task, TokenProvider, Void, SolutionAllContext, ResourceEnvResult, Func } from "./index";


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
    provisionResource?: (ctx: ResourceEnvContext, inputs: Inputs) => Promise<Result<ResourceEnvResult, FxError>>;

    /**
     * Configure provisioned resources.  TODO:renaming
     */
    configureResource?: (ctx: ResourceConfigureContext) => Promise<Result<Void, FxError>>;

    /**
     * build artifacts
     */
    buildArtifacts?: (ctx: ResourceContext, inputs: Inputs) => Promise<Result<Void, FxError>>;

    /**
     * deploy resource   confirm the output??
     */
    deployArtifacts?: (ctx: ResourceEnvContext, inputs: Inputs) => Promise<Result<ResourceEnvResult, FxError>>;

    /**
     * publish app confirm the output??
     * TODO: Just need manifest
     */
    publishApplication?: (ctx: SolutionAllContext, inputs: Inputs) => Promise<Result<ResourceEnvResult, FxError>>;
   
    /**
     * get question model for lifecycle {@link Task} (create, provision, deploy, publish), Questions are organized as a tree. Please check {@link QTreeNode}.
     */
    getQuestionsForLifecycleTask?: (ctx: ResourceAllContext, task: Task, inputs: Inputs) => Promise<Result<QTreeNode|undefined, FxError>>;

    /**
     * get question model for plugin customized {@link Task}, Questions are organized as a tree. Please check {@link QTreeNode}.
     */
    getQuestionsForUserTask?: (ctx: ResourceAllContext, router: FunctionRouter, inputs: Inputs) => Promise<Result<QTreeNode | undefined, FxError>>;

    /**
     * execute user customized task, for example `Add Resource`, `Add Capabilities`, etc
     */
     executeUserTask?: (ctx: ResourceAllContext, func:Func, inputs: Inputs) => Promise<Result<unknown, FxError>>;
}
