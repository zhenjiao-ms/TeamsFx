// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
  FxError,
  Result,
  err,
  v2,
  IComposeExtension,
  IBot,
  IConfigurableTab,
  IStaticTab,
  TeamsAppManifest,
  PluginContext,
} from "@microsoft/teamsfx-api";
import { Service, Inject } from "typedi";
import { BuiltInResourcePluginNames } from "../../../solution/fx-solution/v3/constants";
import { AppStudioPlugin } from "../";
import { convert2PluginContext } from "../../utils4v2";
import { AppStudioResultFactory } from "../results";
import { AppStudioError } from "../errors";

@Service(BuiltInResourcePluginNames.appStudio)
export class AppStudioPluginV3 {
  name = "fx-resource-appstudio";
  displayName = "App Studio";
  @Inject("AppStudioPlugin")
  plugin!: AppStudioPlugin;

  /**
   * Generate initial manifest template file, for both local debug & remote
   * @param ctx
   * @param inputs
   * @returns
   */
  async init(ctx: v2.Context, inputs: v2.InputsWithProjectPath): Promise<Result<any, FxError>> {
    const pluginContext: PluginContext = convert2PluginContext(this.plugin.name, ctx, inputs);
    return await this.plugin.init(pluginContext);
  }

  /**
   * Append capabilities to manifest templates
   * @param ctx
   * @param inputs
   * @param capabilities
   * @returns
   */
  async addCapabilities(
    ctx: v2.Context,
    inputs: v2.InputsWithProjectPath,
    capabilities: (
      | { name: "staticTab"; snippet?: { local: IStaticTab; remote: IStaticTab } }
      | { name: "configurableTab"; snippet?: { local: IConfigurableTab; remote: IConfigurableTab } }
      | { name: "Bot"; snippet?: { local: IBot; remote: IBot } }
      | {
          name: "MessageExtension";
          snippet?: { local: IComposeExtension; remote: IComposeExtension };
        }
    )[]
  ): Promise<Result<any, FxError>> {
    const pluginContext: PluginContext = convert2PluginContext(this.plugin.name, ctx, inputs);
    capabilities.map(async (capability) => {
      const exceedLimit = await this.capabilityExceedLimit(ctx, inputs, capability.name);
      if (exceedLimit.isErr()) {
        return err(exceedLimit.error);
      }
      if (exceedLimit.value) {
        return err(
          AppStudioResultFactory.UserError(
            AppStudioError.CapabilityExceedLimitError.name,
            AppStudioError.CapabilityExceedLimitError.message(capability.name)
          )
        );
      }
    });
    return await this.plugin.addCapabilities(pluginContext, capabilities);
  }

  /**
   * Should conside both local and remote
   * @returns
   */
  async loadManifest(
    ctx: v2.Context,
    inputs: v2.InputsWithProjectPath
  ): Promise<Result<{ local: TeamsAppManifest; remote: TeamsAppManifest }, FxError>> {
    const pluginContext: PluginContext = convert2PluginContext(this.plugin.name, ctx, inputs);
    return await this.plugin.loadManifest(pluginContext);
  }

  /**
   * Save manifest template file
   * @param ctx ctx.manifest
   * @param inputs
   * @returns
   */
  async SaveManifest(
    ctx: v2.Context,
    inputs: v2.InputsWithProjectPath,
    manifest: { local: TeamsAppManifest; remote: TeamsAppManifest }
  ): Promise<Result<any, FxError>> {
    const pluginContext: PluginContext = convert2PluginContext(this.plugin.name, ctx, inputs);
    return await this.plugin.saveManifest(pluginContext, manifest);
  }

  /**
   * Load manifest template, and check if it exceeds the limit.
   * The limit of staticTab if 16, others are 1
   * Should check both local & remote manifest template file
   * @param capability
   * @returns
   */
  async capabilityExceedLimit(
    ctx: v2.Context,
    inputs: v2.InputsWithProjectPath,
    capability: "staticTab" | "configurableTab" | "Bot" | "MessageExtension"
  ): Promise<Result<boolean, FxError>> {
    const pluginContext: PluginContext = convert2PluginContext(this.plugin.name, ctx, inputs);
    return await this.plugin.capabilityExceedLimit(pluginContext, capability);
  }
}
