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
import { FunctionRouter, FxError,  ProjectConfigs,  QTreeNode, Task, Void, Func, Inputs, UserInterface} from "./index";




export interface Core {

    init: (systemInputs: Inputs) => Promise<Result<Void, FxError>>;

    /**
     * create a project, return the project path
     * Core module will not open the created project, extension will do this
     */
    createProject: (systemInputs: Inputs, ui: UserInterface) => Promise<Result<string, FxError>>;

    /**
     * provision resource to cloud
     */
    provisionResources: (systemInputs: Inputs, ui: UserInterface) => Promise<Result<Void, FxError>>;

    /**
     * build artifacts
     */
    buildArtifacts: (systemInputs: Inputs, ui: UserInterface) => Promise<Result<Void, FxError>>;

    /**
     * deploy resource to cloud
     */
    deployArtifacts: (systemInputs: Inputs, ui: UserInterface) => Promise<Result<Void, FxError>>;

    /**
     * publish app
     */
    publishApplication: (systemInputs: Inputs, ui: UserInterface) => Promise<Result<Void, FxError>>;

    /**
     * create an environment
     */
    createEnv: (systemInputs: Inputs, ui: UserInterface) => Promise<Result<Void, FxError>>;

    /**
     * remove an environment
     */
    removeEnv: (systemInputs: Inputs, ui: UserInterface) => Promise<Result<Void, FxError>>;

    /**
     * switch environment
     */
    switchEnv: (systemInputs: Inputs, ui: UserInterface) => Promise<Result<Void, FxError>>;
 
    executeUserTask: (func: Func, inputs: Inputs, ui: UserInterface) => Promise<Result<unknown, FxError>>;
     
    getProjectConfigs:(systemInputs: Inputs) => Promise<Result<ProjectConfigs, FxError>>; 
}