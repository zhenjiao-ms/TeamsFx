// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Result } from "neverthrow";
import { FxError } from "../error";
import { Func, QTreeNode } from "../qm/question";
import { Inputs, Json, OptionItem, Void } from "../types";
import { AppStudioTokenProvider, TokenProvider } from "../utils/login";
import { Context, DeepReadonly, InputsWithProjectPath } from "../v2/types";
import { EnvInfoV3 } from "./types";

// export type StrictOmit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

export interface ISolution {
  name: string;

  /**
   * init
   */
  getQuestionsForInit?: (
    ctx: Context,
    inputs: Inputs
  ) => Promise<Result<QTreeNode | undefined, FxError>>;
  init: (ctx: Context, inputs: InputsWithProjectPath) => Promise<Result<Void, FxError>>;

  /**
   * scaffold
   */
  getQuestionsForScaffold?: (
    ctx: Context,
    inputs: InputsWithProjectPath
  ) => Promise<Result<QTreeNode | undefined, FxError>>;
  /**
   * scaffold is a repeatable lifecycle stage
   *
   * @param {Context} ctx - plugin's runtime context shared by all lifecycles.
   * @param {Inputs} inputs - module: module index(0,1,2), template: template name
   *
   * @returns Void
   */
  scaffold: (
    ctx: Context,
    inputs: InputsWithProjectPath & { module?: string; template?: OptionItem }
  ) => Promise<Result<Void, FxError>>;

  /**
   * addResource
   */
  getQuestionsForAddResource?: (
    ctx: Context,
    inputs: InputsWithProjectPath
  ) => Promise<Result<QTreeNode | undefined, FxError>>;
  /**
   * addResource
   *
   * @param {Context} ctx - plugin's runtime context shared by all lifecycles.
   * @param {Inputs} inputs - module: module index(0,1,2), template: template name
   *
   * @returns Void
   */
  addResource: (
    ctx: Context,
    inputs: InputsWithProjectPath & { module?: string; resource?: string }
  ) => Promise<Result<Void, FxError>>;

  /**
   * addModule
   */
  getQuestionsForAddModule?: (
    ctx: Context,
    inputs: InputsWithProjectPath
  ) => Promise<Result<QTreeNode | undefined, FxError>>;

  /**
   * addModule means adding a sub-project
   *
   * @param {string[]} capabilities - capabilities for the module
   */
  addModule: (
    ctx: Context,
    localSettings: Json,
    inputs: InputsWithProjectPath & { capabilities?: string[] }
  ) => Promise<Result<Void, FxError>>;

  //provision
  getQuestionsForProvision?: (
    ctx: Context,
    inputs: InputsWithProjectPath,
    tokenProvider: TokenProvider,
    envInfo?: DeepReadonly<EnvInfoV3>
  ) => Promise<Result<QTreeNode | undefined, FxError>>;
  provisionResources?: (
    ctx: Context,
    inputs: InputsWithProjectPath,
    envInfo: EnvInfoV3,
    tokenProvider: TokenProvider
  ) => Promise<Result<EnvInfoV3, FxError>>;

  //local provision
  getQuestionsForLocalProvision?: (
    ctx: Context,
    inputs: InputsWithProjectPath,
    tokenProvider: TokenProvider,
    localSettings?: DeepReadonly<Json>
  ) => Promise<Result<QTreeNode | undefined, FxError>>;
  provisionLocalResources?: (
    ctx: Context,
    inputs: InputsWithProjectPath,
    localSettings: Json,
    tokenProvider: TokenProvider
  ) => Promise<Result<Json, FxError>>;

  //deploy
  getQuestionsForDeploy?: (
    ctx: Context,
    inputs: InputsWithProjectPath,
    envInfo: DeepReadonly<EnvInfoV3>,
    tokenProvider: TokenProvider
  ) => Promise<Result<QTreeNode | undefined, FxError>>;
  deploy?: (
    ctx: Context,
    inputs: InputsWithProjectPath & { modules: string[] },
    envInfo: DeepReadonly<EnvInfoV3>,
    tokenProvider: TokenProvider
  ) => Promise<Result<Void, FxError>>;

  //publish
  getQuestionsForPublish?: (
    ctx: Context,
    inputs: InputsWithProjectPath,
    envInfo: DeepReadonly<EnvInfoV3>,
    tokenProvider: AppStudioTokenProvider
  ) => Promise<Result<QTreeNode | undefined, FxError>>;
  publishApplication: (
    ctx: Context,
    inputs: InputsWithProjectPath,
    envInfo: DeepReadonly<EnvInfoV3>,
    tokenProvider: AppStudioTokenProvider
  ) => Promise<Result<Void, FxError>>;

  //user task
  getQuestionsForUserTask?: (
    ctx: Context,
    inputs: Inputs,
    func: Func,
    localSettings: Json,
    envInfo: DeepReadonly<EnvInfoV3>,
    tokenProvider: TokenProvider
  ) => Promise<Result<QTreeNode | undefined, FxError>>;
  executeUserTask?: (
    ctx: Context,
    inputs: Inputs,
    func: Func,
    localSettings: Json,
    envInfo: EnvInfoV3,
    tokenProvider: TokenProvider
  ) => Promise<Result<unknown, FxError>>;
}
