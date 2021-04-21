// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
"use strict";

import * as fs from "fs-extra";
import { HookContext, NextFunction, Middleware } from "@feathersjs/hooks";
import { err,  ConfigFolderName} from "fx-api";
import * as error from "../error";
import { CoreContext } from "../context";
 
/**
 * This middleware will help to persist configs if necessary.
 */
export const writeConfigMW: Middleware = async (
  ctx: HookContext,
  next: NextFunction
) => {

  try{
    await next();
  }
  finally{
    if(ctx.arguments[0]){
      const coreCtx: CoreContext = ctx.arguments[0] as CoreContext;

      if(coreCtx.solutionContext){
        coreCtx.projectSetting.solutionSetting = coreCtx.solutionContext.solutionSetting;
        coreCtx.projectState.solutionState = coreCtx.solutionContext.solutionState;
      }
     
      try { 
        const configFolder = `${coreCtx.projectPath}\\.${ConfigFolderName}`;
        
        await fs.writeFile(  `${configFolder}\\setting.json`, JSON.stringify(coreCtx.projectSetting, null, 4)  );
    
        await fs.writeFile(  `${configFolder}\\state.json`, JSON.stringify(coreCtx.projectState, null, 4)  );
    
        const envName = coreCtx.projectSetting.currentEnv;
  
        // provision,deploy template
        const resources = coreCtx.projectSetting.solutionSetting?.resources;
  
        //only create project need to persist template files
        if(ctx.method === "create" && resources && resources.length > 0){
          for(const resource of resources){
            if(coreCtx.provisionTemplates)
              await fs.writeFile(`${configFolder}\\${resource}.provision.tpl.json`, JSON.stringify(coreCtx.provisionTemplates[resource], null, 4));
            if(coreCtx.deployTemplates)
             await fs.writeFile(`${configFolder}\\${resource}.deploy.tpl.json`, JSON.stringify(coreCtx.deployTemplates[resource], null, 4));
          }
        }
    
        //env.userdata
        if(coreCtx.resourceInstanceValues)
          await fs.writeFile(`${configFolder}\\${envName}.userdata.json`, JSON.stringify(coreCtx.resourceInstanceValues, null, 4));
        if(coreCtx.stateValues)
          await fs.writeFile(`${configFolder}\\${envName}.state.json`, JSON.stringify(coreCtx.stateValues, null, 4));
      } catch (e) {
        ctx.result = err(error.WriteFileError(e));
      }
    }
  }
};
