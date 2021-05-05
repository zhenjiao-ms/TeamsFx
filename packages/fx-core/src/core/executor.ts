// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
"use strict";

import {
  err,
  FxError,
  NodeType,
  ok,
  QTreeNode,
  Result,
  returnUserError,
  UserError,
  SingleSelectQuestion,
  ConfigFolderName,
  Inputs,
  SolutionContext,
  Void,
  EnvMeta,
  SolutionEnvContext,
  ResourceConfigs,
  Task,
  SolutionAllContext,
  FunctionRouter,
  SolutionScaffoldResult,
  OptionItem,
  ResourceEnvResult,
  ProjectConfigs,
} from "fx-api";
import { hooks } from "@feathersjs/hooks";
import { writeConfigMW } from "./middlewares/config";
import { projectTypeCheckerMW } from "./middlewares/supportChecker";
import * as error from "./error";
import { CoreContext } from "./context";
import { DefaultSolution } from "../plugins/solution/default";
import { deepCopy, initFolder, mergeDict, replaceTemplateVariable } from "./tools";
import { CoreQuestionNames, QuestionAppName, QuestionEnvLocal, QuestionEnvName, QuestionEnvSideLoading, QuestionRootFolder, QuestionSelectEnv, QuestionSelectSolution } from "./question";
import * as fs from "fs-extra";
import * as path from "path";


export class Executor {

  @hooks([writeConfigMW])
  static async create( ctx: CoreContext, inputs: Inputs ): Promise<Result<string, FxError>> {
     
    // get solution
    ctx.solution = new DefaultSolution();

    // build SolutionContext
    const solutionContext:SolutionContext = {
      ...ctx,
      solutionSetting: {
          name: ctx.solution.name,
          displayName: ctx.solution.displayName,
          version: "1.0.0",
          resources:[],
          resourceSettings:{}
      },
      solutionState: {
          resourceStates:{}
      }
    };

    const initRes = await initFolder(ctx.projectPath, inputs.appName as string);
    if(initRes.isErr()) return err(initRes.error);
    
    // scaffold
    const scaffoldRes = await ctx.solution.scaffoldFiles(solutionContext, inputs);
    if(scaffoldRes.isErr()) return err(scaffoldRes.error);
    const templates:SolutionScaffoldResult = scaffoldRes.value;
    ctx.deployTemplates = templates.deployTemplates;
    ctx.provisionTemplates = templates.provisionTemplates;
    ctx.solutionContext = solutionContext;
    return ok(ctx.projectPath);
  }
   
  @hooks([projectTypeCheckerMW, writeConfigMW])
  static async provisionResources(ctx: CoreContext, inputs: Inputs): Promise<Result<Void, FxError>> {
    const provisionConfigs = this.getProvisionConfigs(ctx);
    const solutionContext:SolutionEnvContext = this.createSolutionEnvContext(ctx, provisionConfigs);
    ctx.solutionContext = solutionContext;
    await new Promise(resolve => setTimeout(resolve, 5000));
    const res = await ctx.solution!.provisionResources(solutionContext, inputs);
    let result:ResourceEnvResult|undefined;
    if(res.isOk()){
      result = res.value;
    }
    else {
      result = res.error.result;
    }
    ctx.resourceInstanceValues = mergeDict(ctx.resourceInstanceValues, result.resourceValues);
    ctx.stateValues = mergeDict(ctx.stateValues, result.stateValues);
    return res.isOk() ? ok(Void) : err(res.error);
  }

  
  @hooks([projectTypeCheckerMW, writeConfigMW])
  static async buildArtifacts(ctx: CoreContext, inputs: Inputs): Promise<Result<Void, FxError>> {
    const solutionContext:SolutionContext = this.createSolutionContext(ctx);
    ctx.solutionContext = solutionContext;
    const res = await ctx.solution!.buildArtifacts(solutionContext, inputs);
    if(res.isErr()) return err(res.error);
    return ok(Void);
  }

  @hooks([projectTypeCheckerMW, writeConfigMW])
  static async deployArtifacts(ctx: CoreContext, inputs: Inputs): Promise<Result<Void, FxError>> {
    const deployConfigs = this.getDeployConfigs(ctx);
    const solutionContext:SolutionEnvContext = this.createSolutionEnvContext(ctx, deployConfigs);
    ctx.solutionContext = solutionContext;
    const res = await ctx.solution!.deployArtifacts(solutionContext, inputs);
    let result:ResourceEnvResult|undefined;
    if(res.isOk()){
      result = res.value;
    }
    else {
      result = res.error.result;
    }
    ctx.resourceInstanceValues = mergeDict(ctx.resourceInstanceValues, result.resourceValues);
    ctx.stateValues = mergeDict(ctx.stateValues, result.stateValues);
    return res.isOk() ? ok(Void) : err(res.error);
  }

  @hooks([projectTypeCheckerMW, writeConfigMW])
  static async publishApplication(ctx: CoreContext, inputs: Inputs): Promise<Result<Void, FxError>> {
    const solutionContext:SolutionAllContext = this.createSolutionAllContext(ctx);
    ctx.solutionContext = solutionContext;
    const res = await ctx.solution!.publishApplication(solutionContext, inputs);
    if(res.isOk()){
      ctx.resourceInstanceValues = mergeDict(ctx.resourceInstanceValues, res.value.resourceValues);
      ctx.stateValues = mergeDict(ctx.stateValues, res.value.stateValues);
    }
    return res.isOk() ? ok(Void) : err(res.error);
  }

  @hooks([projectTypeCheckerMW])
  static async getQuestionsForLifecycleTask( ctx: CoreContext, task:Task, inputs: Inputs): Promise<Result<QTreeNode | undefined, FxError>> {
    const node = new QTreeNode({ type: NodeType.group });
    const solutionContext = this.createSolutionAllContext(ctx);
    ctx.solutionContext = solutionContext;
    if(task === Task.createEnv){
      node.addChild(new QTreeNode(QuestionEnvName));
      QuestionEnvName.validation = {
        validFunc : (input: string|string[]|number, previousInputs: Inputs) : string | undefined | Promise<string | undefined> => {
          const envName = input as string;
          if(ctx.projectSetting.environments[envName])
            return `enviroment already exist!`;
          else 
            return undefined;
        }
      };
      node.addChild(new QTreeNode(QuestionEnvLocal));
      node.addChild(new QTreeNode(QuestionEnvSideLoading));
    }
    else if (task === Task.removeEnv || task === Task.switchEnv){
      node.addChild(new QTreeNode(QuestionSelectEnv));
    }
    else if (task === Task.create) {
      
      //make sure that global solutions are loaded
      const solutionNames: string[] = [];
      for (const k of ctx.globalSolutions.keys()) {
        solutionNames.push(k);
      }
      const selectSolution: SingleSelectQuestion = QuestionSelectSolution;
      selectSolution.option = solutionNames;
      const select_solution = new QTreeNode(selectSolution);
      node.addChild(select_solution);
      for (const [k, solution] of ctx.globalSolutions) {
        if (solution.getQuestionsForLifecycleTask) {
          const res = await solution.getQuestionsForLifecycleTask( solutionContext, task, inputs);
          if (res.isErr()) return res;
          if (res.value) {
            const solutionNode = res.value as QTreeNode;
            solutionNode.condition = { equals: k };
            if (solutionNode.data) select_solution.addChild(solutionNode);
          }
        }
      }
      node.addChild(new QTreeNode(QuestionRootFolder));
      node.addChild(new QTreeNode(QuestionAppName));
    } else if (ctx.solution) {
      const res = await ctx.solution.getQuestionsForLifecycleTask(solutionContext, task, inputs);
      if (res.isErr()) return res;
      if (res.value) {
        const child = res.value as QTreeNode;
        if (child.data) node.addChild(child);
      }
    } 
    return ok(node);
  }

  @hooks([projectTypeCheckerMW])
  static async getQuestionsForUserTask( ctx: CoreContext, router:FunctionRouter, inputs: Inputs): Promise<Result<QTreeNode | undefined, FxError>> {
    const namespace = router.namespace;
    const array = namespace ? namespace.split("/") : [];
    if (namespace && "" !== namespace && array.length > 0) {
      const solutionName = array[0];
      const solution = ctx.globalSolutions.get(solutionName);
      if (solution && solution.getQuestionsForUserTask) {
        const solutionContext = this.createSolutionAllContext(ctx);
        ctx.solutionContext = solutionContext;
        return await solution.getQuestionsForUserTask(solutionContext, router, inputs);
      }
    }
    return err(
      returnUserError(
        new Error(`getQuestionsForUserTaskRouteFailed:${JSON.stringify(router)}`),
        error.CoreSource,
        error.CoreErrorNames.getQuestionsForUserTaskRouteFailed
      )
    );
  }


  // @hooks([projectTypeCheckerMW, writeConfigMW])
  // static async executeQuestionFlowFunction( ctx: CoreContext, func:Func, inputs: Inputs ): Promise<Result<unknown, FxError>> {
  //   const namespace = func.namespace;
  //   const array = namespace ? namespace.split("/") : [];
  //   if (!namespace || "" === namespace || array.length === 0) {
  //     if (func.method === "validateFolder") {
  //       if (!func.params) return ok(undefined);
  //       return await this.validateFolder(func.params as string, inputs);
  //     }
  //     else if (func.method === "listEnv") {
  //       const options:OptionItem[] = [];
  //       for(const k of Object.keys(ctx.projectSetting.environments)){
  //         const envMeta = ctx.projectSetting.environments[k];
  //         options.push({
  //           id: envMeta.name,
  //           label: envMeta.name,
  //           description: `local:${envMeta.local}, sideloading:${envMeta.sideloading}`
  //         });
  //       }
  //       return ok(options);
  //     }
  //     else if (func.method === "validateEnvName") {
  //       const envName = func.params as string;
  //       if(ctx.projectSetting.environments[envName])
  //         return ok(`enviroment already exist!`);
  //       else 
  //         return ok(undefined);
  //     }
  //   } else {
  //     const solutionName = array[0];
  //     const solution = ctx.globalSolutions.get(solutionName);
  //     if (solution && solution.executeQuestionFlowFunction) {
  //       const solutionContext = this.createSolutionAllContext(ctx);
  //       ctx.solutionContext = solutionContext;
  //       return await solution.executeQuestionFlowFunction(solutionContext, func, inputs);
  //     }
  //   }
  //   return err(
  //     returnUserError(
  //       new Error(`CallFuncRouteFailed:${JSON.stringify(func)}`),
  //       error.CoreSource,
  //       error.CoreErrorNames.CallFuncRouteFailed
  //     )
  //   );
  // }

  @hooks([projectTypeCheckerMW])
  static async getProjectConfigs( ctx: CoreContext, inputs: Inputs ): Promise<Result<ProjectConfigs, FxError>> {
    let configs:ProjectConfigs = {
      projectSetting: ctx.projectSetting,
      projectState: ctx.projectState,
      provisionTemplates: ctx.provisionTemplates,
      deployTemplates: ctx.deployTemplates,
      provisionConfigs: this.getProvisionConfigs(ctx),
      deployConfigs: this.getDeployConfigs(ctx),
      resourceInstanceValues: ctx.resourceInstanceValues,
      stateValues: ctx.stateValues
    };
    configs = deepCopy(configs);
    return ok(configs);
  }
  
  
  @hooks([projectTypeCheckerMW, writeConfigMW])
  static async createEnv(ctx: CoreContext, inputs: Inputs): Promise<Result<Void, FxError>> {
    const EnvName = inputs[CoreQuestionNames.EnvName] as string;
    const EnvLocal = inputs[CoreQuestionNames.EnvLocal] as string;
    const EnvSideLoading = inputs[CoreQuestionNames.EnvSideLoading] as string;
    const env:EnvMeta= {name:EnvName, local: EnvLocal === "true", sideloading: EnvSideLoading === "true"};
    const existing = ctx.projectSetting.environments[env.name];
    if(!existing){
      ctx.projectSetting.environments[env.name] = env;
      return ok(Void);
    }
    return err(new UserError("EnvExist", "EnvExist", "core"));
  }

  @hooks([projectTypeCheckerMW, writeConfigMW])
  static async removeEnv( ctx: CoreContext, inputs: Inputs): Promise<Result<Void, FxError>> {
    const EnvName = inputs[CoreQuestionNames.EnvName] as string;
    if(EnvName === ctx.projectSetting.currentEnv)
      return err(new UserError("RemoveEnvFail", "current environment can not be removed!", "core"));
    const existing = ctx.projectSetting.environments[EnvName];
    if(existing){
      delete ctx.projectSetting.environments[EnvName];
      ctx.resourceInstanceValues = undefined;
      return ok(Void);
    }
    return err(new UserError("EnvNotExist", "EnvNotExist", "core"));
  }

  @hooks([projectTypeCheckerMW, writeConfigMW])
  static async switchEnv( ctx: CoreContext, inputs: Inputs): Promise<Result<Void, FxError>> {
    const EnvName = inputs[CoreQuestionNames.EnvName] as string;
    const existing = ctx.projectSetting.environments[EnvName];
    if(existing){
      const file = `${ctx.projectPath}/.${ConfigFolderName}/${EnvName}.userdata`;
      ctx.resourceInstanceValues = (await fs.pathExists(file)) ? await fs.readJSON(file) : {};
      ctx.projectSetting.currentEnv = EnvName;
      return ok(Void);
    }
    return err(new UserError("EnvNotExist", "EnvNotExist", "core"));
  }

  @hooks([projectTypeCheckerMW, writeConfigMW])
  static async listEnvs(ctx: CoreContext, inputs: Inputs): Promise<Result<EnvMeta[], FxError>> {
    const list:EnvMeta[] = [];
    for(const k of Object.keys(ctx.projectSetting.environments)){
      const envMeta = ctx.projectSetting.environments[k];
      list.push(envMeta);
    }
    return ok(list);
  }
 

  static getProvisionConfigs(ctx: CoreContext):ResourceConfigs{
    const resources = ctx.projectSetting.solutionSetting?.resources;
    const provisionConfigs: ResourceConfigs = {};
    if(resources){
      for(const resource of resources){
        if(ctx.provisionTemplates){
          const resourceTemplate = ctx.provisionTemplates[resource];
          if(resourceTemplate){
            replaceTemplateVariable(resourceTemplate, ctx.resourceInstanceValues);
            provisionConfigs[resource] = resourceTemplate;
          }
        }
      }
    }
    return provisionConfigs;
  }

  static getDeployConfigs(ctx: CoreContext):ResourceConfigs{
    const resources = ctx.projectSetting.solutionSetting?.resources;
    const deployConfigs: ResourceConfigs = {};
    if(resources){
      for(const resource of resources){
        if(ctx.deployTemplates){
          const resourceTemplate = ctx.deployTemplates[resource];
          if(resourceTemplate){
            replaceTemplateVariable(resourceTemplate, ctx.resourceInstanceValues);
            deployConfigs[resource] = resourceTemplate;
          }
        }
      }
    }
    return deployConfigs;
  }

  static async validateFolder( folder: string,  inputs: Inputs
    ): Promise<Result<unknown, FxError>> {
    const appName = inputs[CoreQuestionNames.AppName] as string;
    if (!appName) return ok(undefined);
    const projectPath = path.resolve(folder, appName);
    const exists = await fs.pathExists(projectPath);
    if (exists)
      return ok(
        `Project folder already exists:${projectPath}, please change a different folder.`
      );
    return ok(undefined);
  }

  static createSolutionContext(ctx: CoreContext):SolutionContext{
    const solutionContext:SolutionContext = {
      projectPath: ctx.projectPath,
      ui: ctx.ui,
      logProvider: ctx.logProvider,
      telemetryReporter: ctx.telemetryReporter,
      projectSetting: ctx.projectSetting,
      projectState: ctx.projectState,
      solutionSetting: ctx.projectSetting.solutionSetting,
      solutionState: ctx.projectState.solutionState
    };
    return solutionContext;
  }

  static createSolutionEnvContext(ctx: CoreContext, resourceConfigs: ResourceConfigs):SolutionEnvContext{
    const envMeta = ctx.projectSetting.environments[ctx.projectSetting.currentEnv];
    const solutionContext:SolutionEnvContext = {
      ...this.createSolutionContext(ctx),
      env: envMeta,
      tokenProvider: ctx.tokenProvider,
      resourceConfigs: resourceConfigs
    };
    return solutionContext;
  }

  static createSolutionAllContext(ctx: CoreContext):SolutionAllContext{
    // build SolutionAllContext
    const provisionConfigs = this.getProvisionConfigs(ctx);
    const deployConfigs = this.getDeployConfigs(ctx);
    const envMeta = ctx.projectSetting.environments[ctx.projectSetting.currentEnv];
    const solutionContext:SolutionAllContext = {
      ...this.createSolutionContext(ctx),
      env: envMeta,
      tokenProvider: ctx.tokenProvider,
      provisionConfigs: provisionConfigs,
      deployConfigs: deployConfigs
    };
    return solutionContext;
  }
  
}



