// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
"use strict";

/*
 *  ------------
 * |  extension | -- UI & dialog & telemetry & logger
 *  ------------
 *
 *  ------------
 * |    core    | -- Environments & Project
 *  ------------
 *
 *  ------------------
 * |  solution plugin | -- General lifecycle
 *  -------------------
 *
 *  ----------------------
 * |   resource plugin   | -- Specific lifecycle
 *  ----------------------
 */
 
import {  Result } from "neverthrow";  
import { FunctionRouter, FxError,  Inputs,  ProjectConfigs,  QTreeNode, Task, Void} from "./index";




export interface Core {

    init: (inputs: Inputs) => Promise<Result<Void, FxError>>;

    /**
     * create a project, return the project path
     * Core module will not open the created project, extension will do this
     */
    createProject: (inputs: Inputs) => Promise<Result<string, FxError>>;

    /**
     * provision resource to cloud
     */
    provisionResources: (inputs: Inputs) => Promise<Result<Void, FxError>>;

    /**
     * build artifacts
     */
    buildArtifacts: (inputs: Inputs) => Promise<Result<Void, FxError>>;

    /**
     * deploy resource to cloud
     */
    deployArtifacts: (inputs: Inputs) => Promise<Result<Void, FxError>>;

    /**
     * publish app
     */
    publishApplication: (inputs: Inputs) => Promise<Result<Void, FxError>>;

    /**
     * create an environment
     */
    createEnv: (inputs: Inputs) => Promise<Result<Void, FxError>>;

    /**
     * remove an environment
     */
    removeEnv: (inputs: Inputs) => Promise<Result<Void, FxError>>;

    /**
     * switch environment
     */
    switchEnv: (inputs: Inputs) => Promise<Result<Void, FxError>>;

    /**
     * get question model for lifecycle {@link Task} (create, provision, deploy, debug, publish), Questions are organized as a tree. Please check {@link QTreeNode}.
     */
    getQuestionsForLifecycleTask: (task:Task, inputs: Inputs) => Promise<Result<QTreeNode | undefined, FxError>>;

    /**
     * get question model for user task in additional to normal lifecycle {@link Task}, for example `Add Resource`, `Add Capabilities`, `Update AAD Permission`, etc
     * `getQuestionsForUserTask` will router the getQuestions request and dispatch from core--->solution--->resource plugin according to `FunctionRouter`.
     */
    getQuestionsForUserTask: (router:FunctionRouter, inputs: Inputs) => Promise<Result<QTreeNode | undefined, FxError>>;
    
    /**
     * get all project persist configs
     */
    getProjectConfigs:(inputs: Inputs) => Promise<Result<ProjectConfigs, FxError>>; 
}