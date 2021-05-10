// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

"use strict";

import * as path from "path";
import { Argv, Options } from "yargs";

import { ConfigMap, err, FxError, ok, Platform, Result } from "@microsoft/teamsfx-api";

import activate from "../activate";
import * as constants from "../constants";
import { validateAndUpdateAnswers } from "../question/question";
import { getParamJson } from "../utils";
import { YargsCommand } from "../yargsCommand";

export class CapabilityAddTab extends YargsCommand {
  public readonly commandHead = `tab`;
  public readonly command = `${this.commandHead}`;
  public readonly description = "Add a tab.";
  public readonly paramPath = constants.capabilityAddTabParamPath;
  public readonly params: { [_: string]: Options } = getParamJson(this.paramPath);

  public builder(yargs: Argv): Argv<any> {
    return yargs.options(this.params);
  }

  public async runCommand(args: { [argName: string]: string }): Promise<Result<null, FxError>> {
    const answers = new ConfigMap();
    for (const name in this.params) {
      answers.set(name, args[name] || this.params[name].default);
    }

    const rootFolder = path.resolve(answers.getString("folder") || "./");
    answers.delete("folder");

    const result = await activate(rootFolder);
    if (result.isErr()) {
      return err(result.error);
    }

    const func = {
      namespace: "fx-solution-azure",
      method: "addCapability"
    };

    const core = result.value;
    {
      const result = await core.getQuestionsForUserTask!(func, Platform.CLI);
      if (result.isErr()) {
        return err(result.error);
      }
      await validateAndUpdateAnswers(result.value!, answers);
    }

    {
      const result = await core.executeUserTask!(func, answers);
      if (result.isErr()) {
        return err(result.error);
      }
    }

    return ok(null);
  }
}

export class CapabilityAddBot extends YargsCommand {
  public readonly commandHead = `bot`;
  public readonly command = `${this.commandHead}`;
  public readonly description = "Add a bot.";
  public readonly paramPath = constants.capabilityAddBotParamPath;
  public readonly params: { [_: string]: Options } = getParamJson(this.paramPath);

  public builder(yargs: Argv): Argv<any> {
    return yargs.options(this.params);
  }

  public async runCommand(args: { [argName: string]: string }): Promise<Result<null, FxError>> {
    const answers = new ConfigMap();
    for (const name in this.params) {
      answers.set(name, args[name] || this.params[name].default);
    }

    const rootFolder = path.resolve(answers.getString("folder") || "./");
    answers.delete("folder");

    const result = await activate(rootFolder);
    if (result.isErr()) {
      return err(result.error);
    }

    const func = {
      namespace: "fx-solution-azure",
      method: "addCapability"
    };

    const core = result.value;
    {
      const result = await core.getQuestionsForUserTask!(func, Platform.CLI);
      if (result.isErr()) {
        return err(result.error);
      }
      await validateAndUpdateAnswers(result.value!, answers);
    }

    {
      const result = await core.executeUserTask!(func, answers);
      if (result.isErr()) {
        return err(result.error);
      }
    }

    return ok(null);
  }
}

export class CapabilityAddMessageExtension extends YargsCommand {
  public readonly commandHead = `messaging-extension`;
  public readonly command = `${this.commandHead}`;
  public readonly description = "Add Messaging Extensions.";
  public readonly paramPath = constants.capabilityAddMessageExtensionParamPath;
  public readonly params: { [_: string]: Options } = getParamJson(this.paramPath);

  public builder(yargs: Argv): Argv<any> {
    return yargs.options(this.params);
  }

  public async runCommand(args: { [argName: string]: string }): Promise<Result<null, FxError>> {
    const answers = new ConfigMap();
    for (const name in this.params) {
      answers.set(name, args[name] || this.params[name].default);
    }

    const rootFolder = path.resolve(answers.getString("folder") || "./");
    answers.delete("folder");

    const result = await activate(rootFolder);
    if (result.isErr()) {
      return err(result.error);
    }

    const func = {
      namespace: "fx-solution-azure",
      method: "addCapability"
    };

    const core = result.value;
    {
      const result = await core.getQuestionsForUserTask!(func, Platform.CLI);
      if (result.isErr()) {
        return err(result.error);
      }
      await validateAndUpdateAnswers(result.value!, answers);
    }

    {
      const result = await core.executeUserTask!(func, answers);
      if (result.isErr()) {
        return err(result.error);
      }
    }

    return ok(null);
  }
}


export class CapabilityAdd extends YargsCommand {
  public readonly commandHead = `add`;
  public readonly command = `${this.commandHead} <capability>`;
  public readonly description = "Add new capabilities to the current application";

  public readonly subCommands: YargsCommand[] = [new CapabilityAddTab(), new CapabilityAddBot(), new CapabilityAddMessageExtension()];

  public builder(yargs: Argv): Argv<any> {
    this.subCommands.forEach((cmd) => {
      yargs.command(cmd.command, cmd.description, cmd.builder.bind(cmd), cmd.handler.bind(cmd));
    });
    return yargs;
  }

  public async runCommand(args: { [argName: string]: string }): Promise<Result<null, FxError>> {
    return ok(null);
  }
}

export default class Capability extends YargsCommand {
  public readonly commandHead = `capability`;
  public readonly command = `${this.commandHead} <action>`;
  public readonly description = "Add new capabilities to the current application.";

  public readonly subCommands: YargsCommand[] = [new CapabilityAdd()];

  public builder(yargs: Argv): Argv<any> {
    this.subCommands.forEach((cmd) => {
      yargs.command(cmd.command, cmd.description, cmd.builder.bind(cmd), cmd.handler.bind(cmd));
    });
    return yargs.version(false);
  }

  public async runCommand(args: { [argName: string]: string }): Promise<Result<null, FxError>> {
    return ok(null);
  }
}
