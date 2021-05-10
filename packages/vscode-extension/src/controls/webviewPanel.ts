// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as path from "path";
import * as vscode from "vscode";
import { ext } from "../extensionVariables";
import { Commands } from "./Commands";
import axios from "axios";
import * as AdmZip from "adm-zip";
import * as fs from "fs-extra";
import AzureAccountManager from "../commonlib/azureLogin";
import AppStudioTokenInstance from "../commonlib/appStudioLogin";
import { runCommand } from "../handlers";
import { Stage } from "@microsoft/teamsfx-api";
import { PanelType } from "./PanelType";
import { execSync } from "child_process";
import { isMacOS } from "../utils/commonUtils";

export class WebviewPanel {
  private static readonly viewType = "react";
  public static currentPanels: WebviewPanel[] = [];

  private panel: vscode.WebviewPanel;
  private panelType: PanelType = PanelType.QuickStart;
  private readonly extensionPath: string;
  private disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionPath: string, panelType: PanelType) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;
    if (WebviewPanel.currentPanels && WebviewPanel.currentPanels.findIndex(panel => panel.panelType === panelType) > -1) {
      WebviewPanel.currentPanels.find(panel => panel.panelType === panelType)!.panel.reveal(column);
    } else {
      WebviewPanel.currentPanels.push(new WebviewPanel(extensionPath, panelType, column || vscode.ViewColumn.One));
    }
  }

  private constructor(extensionPath: string, panelType: PanelType, column: vscode.ViewColumn) {
    this.extensionPath = extensionPath;
    this.panelType = panelType;

    // Create and show a new webview panel
    this.panel = vscode.window.createWebviewPanel(
      WebviewPanel.viewType,
      this.getWebpageTitle(panelType),
      column,
      {
        // Enable javascript in the webview
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.file(path.join(this.extensionPath, "out"))]
      }
    );

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programatically
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Handle messages from the webview
    this.panel.webview.onDidReceiveMessage(
      async (msg) => {
        switch (msg.command) {
          case Commands.OpenExternalLink:
            vscode.env.openExternal(vscode.Uri.parse(msg.data));
            break;
          case Commands.CloneSampleApp:
            const selection = await vscode.window.showInformationMessage(
              `Clone '${msg.data.appName}' from Github. This will clone '${msg.data.appName}' repository to your local machine`,
              { modal: false },
              "Clone",
              "Cancel"
            );
            if (selection === "Clone") {
              const folder = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                title: "Select folder to clone the sample app"
              });
              if (folder !== undefined) {
                const result = await this.fetchCodeZip(msg.data.appUrl);
                if (result !== undefined) {
                  await this.saveFilesRecursively(new AdmZip(result.data), msg.data.appFolder, folder[0].fsPath);

                  vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(path.join(folder[0].fsPath, msg.data.appFolder)));
                } else {
                  vscode.window.showErrorMessage("Failed to clone sample app");
                }
              }
            }
            break;
          case Commands.DisplayCommandPalette:
            break;
          case Commands.DisplayCommands:
            vscode.commands.executeCommand("workbench.action.quickOpen", `>${msg.data}`);
            break;
          case Commands.SigninM365:
            await AppStudioTokenInstance.getJsonObject(false);
            break;
          case Commands.SigninAzure:
            await AzureAccountManager.getAccountCredentialAsync(false);
            break;
          case Commands.CreateNewProject:
            await runCommand(Stage.create);
            break;
          case Commands.SwitchPanel:
            WebviewPanel.createOrShow(this.extensionPath, msg.data);
            break;
          default:
            break;
        }
      },
      undefined,
      ext.context.subscriptions
    );

    AppStudioTokenInstance.setStatusChangeMap("quick-start-webview", (status, token, accountInfo) => {
      let email = undefined;
      if (status === "SignedIn") {
        email = (accountInfo as any).upn ? (accountInfo as any).upn : undefined;
      }

      if (this.panel && this.panel.webview) {
        this.panel.webview.postMessage({
          message: "m365AccountChange",
          data: email
        });
      }

      return Promise.resolve();
    });

    AzureAccountManager.setStatusChangeMap("quick-start-webview", (status, token, accountInfo) => {
      let email = undefined;
      if (status === "SignedIn") {
        const token = AzureAccountManager.getAccountCredential();
        if (token !== undefined) {
          email = (token as any).username ? (token as any).username : undefined;
        }
      }

      if (this.panel && this.panel.webview) {
        this.panel.webview.postMessage({
          message: "azureAccountChange",
          data: email
        });
      }

      return Promise.resolve();
    });

    // Set the webview's initial html content
    this.panel.webview.html = this.getHtmlForWebview(panelType);
  }

  private getWebpageTitle(panelType: PanelType){
    switch(panelType){
      case PanelType.QuickStart:
        return "Quick Start";
      case PanelType.SampleGallery:
        return "Samples";
    }
  }

  private async fetchCodeZip(url: string) {
    let retries = 3;
    let result = undefined;
    while (retries > 0) {
      retries--;
      try {
        result = await axios.get(url, {
          responseType: "arraybuffer"
        });
        if (result.status === 200 || result.status === 201) {
          return result;
        }
      } catch (e) {
        await new Promise<void>((resolve: () => void): NodeJS.Timer => setTimeout(resolve, 10000));
      }
    }
    return result;
  }

  private async saveFilesRecursively(zip: AdmZip, appFolder: string, dstPath: string): Promise<void> {
    await Promise.all(
      zip
        .getEntries()
        .filter((entry) => !entry.isDirectory && entry.entryName.includes(appFolder))
        .map(async (entry) => {
          const data = entry.getData().toString();
          const entryPath = entry.entryName.substring(entry.entryName.indexOf('/') + 1);
          const filePath = path.join(dstPath, entryPath);
          await fs.ensureDir(path.dirname(filePath));
          await fs.writeFile(filePath, data);
        })
    );
  }

  private getHtmlForWebview(panelType: PanelType) {
    const scriptBasePathOnDisk = vscode.Uri.file(path.join(this.extensionPath, "out/"));
    const scriptBaseUri = scriptBasePathOnDisk.with({ scheme: "vscode-resource" });

    const scriptPathOnDisk = vscode.Uri.file(path.join(this.extensionPath, "out/src", "client.js"));
    const scriptUri = scriptPathOnDisk.with({ scheme: "vscode-resource" });

    // Use a nonce to whitelist which scripts can be run
    const nonce = this.getNonce();

    return `<!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>ms-teams</title>
            <base href='${scriptBaseUri}' />
          </head>
          <body>
            <div id="root"></div>
            <script>
              const vscode = acquireVsCodeApi();
              const panelType = '${panelType}';
              const isSupportedNode = ${this.isValidNode()};
              const isMacPlatform = ${isMacOS()};
            </script>
            <script nonce="${nonce}"  type="module" src="${scriptUri}"></script>
          </body>
        </html>`;
  }

  private getNonce() {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  isValidNode = () => {
    try{
      const supportedVersions = ["10", "12", "14"];
      const output = execSync("node --version");
      const regex = /v(?<major_version>\d+)\.(?<minor_version>\d+)\.(?<patch_version>\d+)/gm;
  
      const match = regex.exec(output.toString());
      if (!match) {
        return false;
      }
  
      const majorVersion = match.groups?.major_version;
      if (!majorVersion) {
        return false;
      }
  
      return supportedVersions.includes(majorVersion);
    }
    catch(e){

    }
    return false;
  }

  public dispose() {
    WebviewPanel.currentPanels.splice(WebviewPanel.currentPanels.indexOf(this), 1);

    AppStudioTokenInstance.removeStatusChangeMap("quick-start-webview");

    AzureAccountManager.removeStatusChangeMap("quick-start-webview");

    // Clean up our resources
    this.panel.dispose();

    while (this.disposables.length) {
      const x = this.disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}
