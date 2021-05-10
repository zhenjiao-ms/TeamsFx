// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
  PluginContext,
  QTreeNode,
  NodeType,
  Plugin,
  FxError,
  Stage,
  err,
  Result,
  ok,
  TeamsAppManifest
} from "@microsoft/teamsfx-api";
import * as fs from "fs-extra";
import * as path from "path";
import { SPFxPluginImpl } from "./plugin";
import { TelemetryEvent } from "./utils/constants";
import { telemetryHelper } from "./utils/telemetry-helper";
import { ProgressHelper } from "./utils/progress-helper";
export class SpfxConfig {
  webpartName = "my-SPFx-app";
  webpartDesc = "This is a SPFx app.";
  framework = "none";
  isPrivate = true;
}

export enum SPFXQuestionNames {
  framework_type = "spfx-framework-type",
  webpart_name = "spfx-webpart-name",
  webpart_desp = "spfx-webpart-desp",
}

export class SpfxPlugin implements Plugin {
  config: SpfxConfig = new SpfxConfig();
  spfxPluginImpl: SPFxPluginImpl = new SPFxPluginImpl();

  async getQuestions(
    stage: Stage,
    ctx: PluginContext
  ): Promise<Result<QTreeNode | undefined, FxError>> {
    const spfx_frontend_host = new QTreeNode({
      type: NodeType.group,
    });

    if (stage === Stage.create) {
      const spfx_framework_type = new QTreeNode({
        type: NodeType.singleSelect,
        name: SPFXQuestionNames.framework_type,
        title: "Framework",
        option: [{id:"none", label:"None"}, {id:"react", label:"React"}],
        placeholder: "Select an option",
        default: "none"
      });
      spfx_frontend_host.addChild(spfx_framework_type);

      const spfx_webpart_name = new QTreeNode({
        type: NodeType.text,
        name: SPFXQuestionNames.webpart_name,
        title: "Web Part Name",
        default: "helloworld",
        validation: {
          pattern: "^[a-zA-Z_][a-zA-Z0-9_]*$",
        },
      });
      spfx_frontend_host.addChild(spfx_webpart_name);

      const spfx_webpart_desp = new QTreeNode({
        type: NodeType.text,
        name: SPFXQuestionNames.webpart_desp,
        title: "Web Part Description",
        default: "helloworld description",
        validation: {
          required: true,
        },
      });
      spfx_frontend_host.addChild(spfx_webpart_desp);
    }

    return ok(spfx_frontend_host);
  }

  public async scaffold(ctx: PluginContext): Promise<Result<any, FxError>> {
    //answers ---> config by huajie
    if (ctx.answers) {
      let v = ctx.answers.getString(SPFXQuestionNames.framework_type);
      this.config.framework = v || this.config.framework;
      v = ctx.answers.getString(SPFXQuestionNames.webpart_name);
      this.config.webpartName = v || this.config.webpartName;
      v = ctx.answers.getString(SPFXQuestionNames.webpart_desp);
      this.config.webpartDesc = v || this.config.webpartDesc;
    }

    return await this.runWithErrorHandling(ctx, TelemetryEvent.Scaffold, () =>
      this.spfxPluginImpl.scaffold(ctx, this.config)
    );
  }

  public async preDeploy(ctx: PluginContext): Promise<Result<any, FxError>> {
    return await this.runWithErrorHandling(ctx, TelemetryEvent.PreDeploy, () =>
      this.spfxPluginImpl.preDeploy(ctx)
    );
  }

  public async deploy(ctx: PluginContext): Promise<Result<any, FxError>> {
    return await this.runWithErrorHandling(ctx, TelemetryEvent.Deploy, () =>
      this.spfxPluginImpl.deploy(ctx)
    );
  }

  public async getManifest(): Promise<TeamsAppManifest> {
    const templateFolder = path.join(__dirname, "../../../../templates/plugins/resource/spfx");
    const manifestFile = path.resolve(templateFolder, "./solution/manifest.json");
    const manifestString = (await fs.readFile(manifestFile)).toString();
    const manifest: TeamsAppManifest = JSON.parse(manifestString);
    return manifest;
  }

  private async runWithErrorHandling(
    ctx: PluginContext,
    stage: string,
    fn: () => Promise<Result<any, FxError>>
  ): Promise<Result<any, FxError>> {
    try {
      telemetryHelper.sendSuccessEvent(ctx, stage + TelemetryEvent.StartSuffix);
      const result = await fn();
      telemetryHelper.sendSuccessEvent(ctx, stage);
      return result;
    } catch (error) {
      await ProgressHelper.endAllHandlers();
      telemetryHelper.sendErrorEvent(ctx, stage, error);
      return err(error);
    }
  }
}

export default new SpfxPlugin();
