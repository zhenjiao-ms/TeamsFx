// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import * as chai from "chai";
import * as dotenv from "dotenv";
import { ConfigMap, Func, PluginContext } from "@microsoft/teamsfx-api";
import { AadAppForTeamsPlugin } from "../../../../../src/plugins/resource/aad/index";
import {
  mockTokenProviderAzure,
  mockProvisionResult,
  mockTokenProvider,
  TestHelper,
  mockTokenProviderAzureGraph,
  mockTokenProviderGraph,
} from "../helper";
import { Envs } from "../../../../../src/plugins/resource/aad/interfaces/models";
import sinon from "sinon";
import { AadAppClient } from "../../../../../src/plugins/resource/aad/aadAppClient";
import { getAppStudioToken, getGraphToken } from "../tokenProvider";
import { ConfigKeys, Constants } from "../../../../../src/plugins/resource/aad/constants";
import { ProvisionConfig } from "../../../../../src/plugins/resource/aad/utils/configs";

dotenv.config();
const testWithAzure: boolean = process.env.UT_TEST_ON_AZURE ? true : false;

describe("AadAppForTeamsPlugin: CI", () => {
  let plugin: AadAppForTeamsPlugin;
  let context: PluginContext;

  beforeEach(async () => {
    plugin = new AadAppForTeamsPlugin();
    sinon.stub(AadAppClient, "createAadApp").resolves();
    sinon.stub(AadAppClient, "createAadAppSecret").resolves();
    sinon.stub(AadAppClient, "updateAadAppRedirectUri").resolves();
    sinon.stub(AadAppClient, "updateAadAppIdUri").resolves();
    sinon.stub(AadAppClient, "updateAadAppPermission").resolves();
    sinon.stub(AadAppClient, "getAadApp").resolves(new ProvisionConfig());
  });

  afterEach(() => {
    sinon.restore();
  });

  it("provision: tab", async function () {
    context = await TestHelper.pluginContext(new Map(), true, false, false);
    context.appStudioToken = mockTokenProvider();
    context.graphTokenProvider = mockTokenProviderGraph();

    const provision = await plugin.provision(context);
    chai.assert.isTrue(provision.isOk());

    mockProvisionResult(context);
    const setAppId = plugin.setApplicationInContext(context);
    chai.assert.isTrue(setAppId.isOk());

    const postProvision = await plugin.postProvision(context);
    chai.assert.isTrue(postProvision.isOk());
  });

  it("provision: tab and bot with permission update", async function () {
    context = await TestHelper.pluginContext(new Map(), true, true, false);
    context.appStudioToken = mockTokenProvider();
    context.graphTokenProvider = mockTokenProviderGraph();

    const provision = await plugin.provision(context);
    chai.assert.isTrue(provision.isOk());

    mockProvisionResult(context);
    const setAppId = plugin.setApplicationInContext(context);
    chai.assert.isTrue(setAppId.isOk());

    const postProvision = await plugin.postProvision(context);
    chai.assert.isTrue(postProvision.isOk());

    const func: Func = {
      namespace: "namespace",
      method: "aadUpdatePermission",
    };

    const updatePermissionResult = await plugin.executeUserTask(func, context);
    chai.assert.isTrue(updatePermissionResult.isOk());
  });

  it("provision: none input and fix", async function () {
    context = await TestHelper.pluginContext(new Map(), false, false, false);
    context.appStudioToken = mockTokenProvider();
    context.graphTokenProvider = mockTokenProviderGraph();

    const provision = await plugin.provision(context);
    chai.assert.isTrue(provision.isOk());

    mockProvisionResult(context);
    const setAppId = plugin.setApplicationInContext(context);
    chai.assert.isTrue(setAppId.isErr());

    context = await TestHelper.pluginContext(
      context.config,
      true,
      false,
      false
    );
    context.appStudioToken = mockTokenProvider();
    context.graphTokenProvider = mockTokenProviderGraph();

    const provisionSecond = await plugin.provision(context);
    chai.assert.isTrue(provisionSecond.isOk());

    const setAppIdSecond = plugin.setApplicationInContext(context);
    chai.assert.isTrue(setAppIdSecond.isOk());

    const postProvision = await plugin.postProvision(context);
    chai.assert.isTrue(postProvision.isOk());
  });

  it("local debug: tab and bot", async function () {
    context = await TestHelper.pluginContext(new Map(), true, true, true);
    context.appStudioToken = mockTokenProvider();
    context.graphTokenProvider = mockTokenProviderGraph();

    const provision = await plugin.localDebug(context);
    chai.assert.isTrue(provision.isOk());

    mockProvisionResult(context, true);
    const setAppId = plugin.setApplicationInContext(context, true);
    chai.assert.isTrue(setAppId.isOk());

    const postProvision = await plugin.postLocalDebug(context);
    chai.assert.isTrue(postProvision.isOk());
  });

  it("provision and local debug: tab and bot with update current and wrong permission", async function () {
    context = await TestHelper.pluginContext(new Map(), true, true, false);
    context.appStudioToken = mockTokenProvider();
    context.graphTokenProvider = mockTokenProviderGraph();

    const provision = await plugin.provision(context);
    chai.assert.isTrue(provision.isOk());

    mockProvisionResult(context);
    const setAppId = plugin.setApplicationInContext(context);
    chai.assert.isTrue(setAppId.isOk());

    const postProvision = await plugin.postProvision(context);
    chai.assert.isTrue(postProvision.isOk());

    context = await TestHelper.pluginContext(context.config, true, true, true);
    context.appStudioToken = mockTokenProvider();
    context.graphTokenProvider = mockTokenProviderGraph();

    const localDebug = await plugin.localDebug(context);
    chai.assert.isTrue(localDebug.isOk());

    mockProvisionResult(context, true);
    const setAppIdLocal = plugin.setApplicationInContext(context, true);
    chai.assert.isTrue(setAppIdLocal.isOk());

    const postLocalDebug = await plugin.postLocalDebug(context);
    chai.assert.isTrue(postLocalDebug.isOk());

    const func: Func = {
      namespace: "namespace",
      method: "aadUpdatePermission",
    };

    context.answers = new ConfigMap();
    context.answers.set(Constants.AskForEnvName, Envs.Both);
    const updatePermissionResult = await plugin.executeUserTask(func, context);
    chai.assert.isTrue(updatePermissionResult.isOk());

    context = await TestHelper.pluginContext(
      context.config,
      true,
      true,
      false,
      true
    );
    context.appStudioToken = mockTokenProvider();
    context.answers = new ConfigMap();
    context.answers.set(Constants.AskForEnvName, Envs.Both);

    const updatePermissionResultWrong = await plugin.executeUserTask(
      func,
      context
    );
    chai.assert.isTrue(updatePermissionResultWrong.isErr());
  });
});

describe("AadAppForTeamsPlugin: Azure", () => {
  let plugin: AadAppForTeamsPlugin;
  let context: PluginContext;
  let appStudioToken: string | undefined;
  let graphToken: string | undefined;

  before(async function () {
    if (!testWithAzure) {
      this.skip();
    }

    appStudioToken = await getAppStudioToken();
    chai.assert.isString(appStudioToken);

    graphToken = await getGraphToken();
    chai.assert.isString(graphToken);
  });

  beforeEach(() => {
    plugin = new AadAppForTeamsPlugin();
  });

  afterEach(() => {
    sinon.restore();
  });

  it("provision: tab and bot with context changes", async function () {
    context = await TestHelper.pluginContext(new Map(), true, true, false);
    context.appStudioToken = mockTokenProviderAzure(appStudioToken as string);
    context.graphTokenProvider = mockTokenProviderAzureGraph(
      graphToken as string
    );

    const provision = await plugin.provision(context);
    chai.assert.isTrue(provision.isOk());

    const setAppId = plugin.setApplicationInContext(context);
    chai.assert.isTrue(setAppId.isOk());

    const postProvision = await plugin.postProvision(context);
    chai.assert.isTrue(postProvision.isOk());

    // Remove clientId and oauth2PermissionScopeId.
    context.config.set(ConfigKeys.clientId, "");
    context.config.set(ConfigKeys.oauth2PermissionScopeId, "");

    const provisionSecond = await plugin.provision(context);
    chai.assert.isTrue(provisionSecond.isOk());

    const setAppIdSecond = plugin.setApplicationInContext(context);
    chai.assert.isTrue(setAppIdSecond.isOk());

    const postProvisionSecond = await plugin.postProvision(context);
    chai.assert.isTrue(postProvisionSecond.isOk());

    // Remove objectId.
    // Create a new context with same context.config since error will occur with same endpoint and botId.
    context.config.set(ConfigKeys.objectId, "");
    context = await TestHelper.pluginContext(context.config, true, true);
    context.appStudioToken = mockTokenProviderAzure(appStudioToken as string);
    context.graphTokenProvider = mockTokenProviderAzureGraph(
      graphToken as string
    );

    const provisionThird = await plugin.provision(context);
    chai.assert.isTrue(provisionThird.isOk());

    const setAppIdThird = plugin.setApplicationInContext(context);
    chai.assert.isTrue(setAppIdThird.isOk());

    const postProvisionThird = await plugin.postProvision(context);
    chai.assert.isTrue(postProvisionThird.isOk());
  });
});
