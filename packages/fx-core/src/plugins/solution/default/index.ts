import {FunctionRouter, FxError, Inputs, ok, QTreeNode, ResourceTemplates, Result, SolutionAllContext, SolutionContext, SolutionEnvContext, SolutionPlugin, Task, Void, ResourceEnvResult } from "fx-api";


export class DefaultSolution implements  SolutionPlugin{
    name = "fx-solution-default";
    displayName = "Default Solution";
    async scaffoldFiles (ctx: SolutionContext, inputs: Inputs) : Promise<Result<{provisionTemplates:ResourceTemplates, deployTemplates: ResourceTemplates}, FxError>>
    {
        ctx.solutionSetting.resources = ["fx-resource-frontend"];
        return ok({
            provisionTemplates:{
                "fx-resource-frontend":{
                    endpoint: "{{endpoint}}"
                }
            },
            deployTemplates:{
                "fx-resource-frontend":{
                    storagename: "{{storagename}}"
                }
            }
        });
    }
    async buildArtifacts(ctx: SolutionContext, inputs: Inputs) : Promise<Result<Void, FxError>>{
        ctx.solutionState.build = true;
        return ok(Void);
    }
    async provisionResources(ctx: SolutionEnvContext, inputs: Inputs) : Promise<Result<ResourceEnvResult, FxError & {result:ResourceEnvResult}>>{
        ctx.logProvider.info(`[solution] provision resource configs: ${JSON.stringify(ctx.resourceConfigs)}`);
        return ok({
            resourceValues:{
                endpoint:"http://oowww.com"
            },
            stateValues: {
                provision:true
            }
        });
    }
    async deployArtifacts(ctx: SolutionEnvContext, inputs: Inputs) : Promise<Result<ResourceEnvResult, FxError & {result:ResourceEnvResult}>>{
        ctx.logProvider.info(`[solution] deploy resource configs: ${JSON.stringify(ctx.resourceConfigs)}`);
        return ok({
            resourceValues:{
                storagename:"mystorage"
            },
            stateValues:{
                deploy:true
            }
        });
    }
    async publishApplication (ctx: SolutionAllContext, inputs: Inputs) : Promise<Result<ResourceEnvResult, FxError>>{
        ctx.logProvider.info(`[solution] publish provisionConfigs: ${JSON.stringify(ctx.provisionConfigs)}`);
        ctx.logProvider.info(`[solution] publish deployConfigs: ${JSON.stringify(ctx.deployConfigs)}`);
        ctx.solutionState.publish = true;
        return ok({resourceValues:{}, stateValues:{}});
    }
    async getQuestionsForLifecycleTask(ctx: SolutionAllContext, task: Task, inputs: Inputs) : Promise<Result<QTreeNode|undefined, FxError>>{
        return ok(undefined);
    }
    async getQuestionsForUserTask(ctx: SolutionAllContext, router: FunctionRouter, inputs: Inputs) : Promise<Result<QTreeNode|undefined, FxError>>{
        return ok(undefined);
    }
    // async executeUserTask(ctx: SolutionAllContext, func:Func, inputs: Inputs) : Promise<Result<unknown, FxError>>{
    //     return ok(Void);
    // }
    // async executeFuncQuestion(ctx: SolutionAllContext, func:Func, inputs: Inputs) :Promise<Result<unknown, FxError>>{
    //     return ok(Void);
    // }
}