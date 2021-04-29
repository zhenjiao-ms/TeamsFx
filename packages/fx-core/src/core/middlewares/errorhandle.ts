// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
"use strict";

import { HookContext, NextFunction, Middleware } from "@feathersjs/hooks";
import { err, SystemError, UserError } from "fx-api";
import { GlobalTools } from "../core";
import { UncatchedError } from "../error";

/**
 * in case there're some uncatched exceptions, this middleware will act as a guard
 * to catch exceptions and return specific error.
 */
export const errorHandlerMW: Middleware = async (
  ctx: HookContext,
  next: NextFunction
) => {
  try {
    GlobalTools.logProvider.info(`[Core] ${ctx.method} ... start!`);
    await next();
    GlobalTools.logProvider.info(`[Core] ${ctx.method} ... success! result:${JSON.stringify(ctx.result)}`);
  } catch (e) {
    if (  e instanceof UserError || e instanceof SystemError) {
      ctx.result = err(e);
    }
    else {
      ctx.result = err(UncatchedError());
    }
    GlobalTools.logProvider.info(`[Core] ${ctx.method} ... failed! result:${JSON.stringify(ctx.result)}`);
  }
};
