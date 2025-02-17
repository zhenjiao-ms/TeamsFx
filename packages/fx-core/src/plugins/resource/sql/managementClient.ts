// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import { SqlManagementClient, SqlManagementModels } from "@azure/arm-sql";
import axios from "axios";
import { SqlConfig } from "./config";
import { ErrorMessage } from "./errors";
import { Constants } from "./constants";
import { SqlResultFactory } from "./results";
import { PluginContext } from "@microsoft/teamsfx-api";
export class ManagementClient {
  client: SqlManagementClient;
  config: SqlConfig;
  ctx: PluginContext;
  totalFirewallRuleCount = 0;

  private constructor(ctx: PluginContext, config: SqlConfig, client: SqlManagementClient) {
    this.ctx = ctx;
    this.config = config;
    this.client = client;
  }

  public static async create(ctx: PluginContext, config: SqlConfig): Promise<ManagementClient> {
    const credential = await ctx.azureAccountProvider!.getAccountCredentialAsync();
    const client = new SqlManagementClient(credential!, config.azureSubscriptionId);
    return new ManagementClient(ctx, config, client);
  }

  async createAzureSQL(): Promise<void> {
    const model: SqlManagementModels.Server = {
      location: this.config.location,
      administratorLogin: this.config.admin,
      administratorLoginPassword: this.config.adminPassword,
    };
    try {
      await this.client.servers.createOrUpdate(
        this.config.resourceGroup,
        this.config.sqlServer,
        model
      );
    } catch (error) {
      throw SqlResultFactory.UserError(
        ErrorMessage.SqlCreateError.name,
        ErrorMessage.SqlCreateError.message(this.config.sqlEndpoint, error.message),
        error
      );
    }
  }

  async existAzureSQL(): Promise<boolean> {
    try {
      const result = await this.client.servers.checkNameAvailability({
        name: this.config.sqlServer,
      });
      if (result.available) {
        return false;
      } else if (result.reason === "Invalid") {
        throw SqlResultFactory.UserError(
          ErrorMessage.SqlEndpointError.name,
          ErrorMessage.SqlEndpointError.message(this.config.sqlEndpoint)
        );
      } else {
        return true;
      }
    } catch (error) {
      throw SqlResultFactory.SystemError(
        ErrorMessage.SqlCheckError.name,
        ErrorMessage.SqlCheckError.message(this.config.sqlEndpoint, error.message),
        error
      );
    }
  }

  async existAadAdmin(): Promise<boolean> {
    try {
      const result = await this.client.serverAzureADAdministrators.listByServer(
        this.config.resourceGroup,
        this.config.sqlServer
      );
      if (result.find((item: { login: string }) => item.login === this.config.aadAdmin)) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      throw SqlResultFactory.UserError(
        ErrorMessage.SqlCheckAdminError.name,
        ErrorMessage.SqlCheckAdminError.message(this.config.identity, error.message),
        error
      );
    }
  }

  async createDatabase(): Promise<void> {
    const sku: SqlManagementModels.Sku = {
      name: "Basic",
    };
    const model: SqlManagementModels.Database = {
      location: this.config.location,
      sku: sku,
    };
    try {
      await this.client.databases.createOrUpdate(
        this.config.resourceGroup,
        this.config.sqlServer,
        this.config.databaseName,
        model
      );
      // when the request returned, the instance of database may not be ready. Let's wait a moment
      await this.delay(10);
    } catch (error) {
      throw SqlResultFactory.UserError(
        ErrorMessage.DatabaseCreateError.name,
        ErrorMessage.DatabaseCreateError.message(this.config.databaseName, error.message),
        error
      );
    }
  }

  async existDatabase(): Promise<boolean> {
    try {
      const result = await this.client.databases.listByServer(
        this.config.resourceGroup,
        this.config.sqlServer
      );
      if (result.find((item) => item.name === this.config.databaseName)) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      throw SqlResultFactory.UserError(
        ErrorMessage.SqlCheckDBError.name,
        ErrorMessage.SqlCheckDBError.message(this.config.databaseName, error.message),
        error
      );
    }
  }

  async addAADadmin(): Promise<void> {
    let model: SqlManagementModels.ServerAzureADAdministrator = {
      tenantId: this.config.tenantId,
      sid: this.config.aadAdminObjectId,
      login: this.config.aadAdmin,
    };
    const tmp: any = model;
    tmp.administratorType = Constants.sqlAdministratorType;
    model = tmp as unknown as SqlManagementModels.ServerAzureADAdministrator;
    try {
      await this.client.serverAzureADAdministrators.createOrUpdate(
        this.config.resourceGroup,
        this.config.sqlServer,
        model
      );
    } catch (error) {
      throw SqlResultFactory.UserError(
        ErrorMessage.SqlAddAdminError.name,
        ErrorMessage.SqlAddAdminError.message(this.config.aadAdmin, error.message),
        error
      );
    }
  }

  async addAzureFirewallRule(): Promise<void> {
    const model: SqlManagementModels.FirewallRule = {
      startIpAddress: Constants.firewall.azureIp,
      endIpAddress: Constants.firewall.azureIp,
    };
    try {
      await this.client.firewallRules.createOrUpdate(
        this.config.resourceGroup,
        this.config.sqlServer,
        Constants.firewall.azureRule,
        model
      );
    } catch (error) {
      throw SqlResultFactory.UserError(
        ErrorMessage.SqlAzureFirwallError.name,
        ErrorMessage.SqlAzureFirwallError.message(this.config.sqlEndpoint, error.message),
        error
      );
    }
  }

  async addLocalFirewallRule(): Promise<void> {
    const response = await axios.get(Constants.echoIpAddress);
    const localIp: string = response.data;
    const partials: string[] = localIp.split(".");

    partials[2] = Constants.ipBeginToken;
    partials[3] = Constants.ipBeginToken;
    const startIp: string = partials.join(".");

    partials[2] = Constants.ipEndToken;
    partials[3] = Constants.ipEndToken;
    const endIp: string = partials.join(".");
    const model: SqlManagementModels.FirewallRule = {
      startIpAddress: startIp,
      endIpAddress: endIp,
    };
    const ruleName = this.getRuleName(this.totalFirewallRuleCount);
    try {
      await this.client.firewallRules.createOrUpdate(
        this.config.resourceGroup,
        this.config.sqlServer,
        ruleName,
        model
      );
      this.totalFirewallRuleCount++;
    } catch (error) {
      throw SqlResultFactory.UserError(
        ErrorMessage.SqlLocalFirwallError.name,
        ErrorMessage.SqlLocalFirwallError.message(this.config.sqlEndpoint, error.message),
        error
      );
    }
  }

  async deleteLocalFirewallRule(): Promise<void> {
    try {
      for (let i = 0; i < this.totalFirewallRuleCount; i++) {
        const ruleName = this.getRuleName(i);
        await this.client.firewallRules.deleteMethod(
          this.config.resourceGroup,
          this.config.sqlServer,
          ruleName
        );
      }
    } catch (error) {
      throw SqlResultFactory.UserError(
        ErrorMessage.SqlDeleteLocalFirwallError.name,
        ErrorMessage.SqlDeleteLocalFirwallError.message(this.config.sqlEndpoint, error.message),
        error
      );
    }
  }

  getRuleName(suffix: number): string {
    return Constants.firewall.localRule + suffix;
  }

  async delay(s: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, s * 1000));
  }
}
