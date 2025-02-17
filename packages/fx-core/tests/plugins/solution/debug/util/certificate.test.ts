// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import * as chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { asn1, md, pki } from "node-forge";
import * as sinon from "sinon";
import * as uuid from "uuid";

import * as fs from "fs-extra";
import os from "os";
import * as path from "path";

import { LocalCertificateManager } from "../../../../../src/plugins/solution/fx-solution/debug/util/certificate";
import { ConfigFolderName, Platform } from "@microsoft/teamsfx-api";
import { MockedV2Context } from "../../util";

chai.use(chaiAsPromised);

describe("certificate", () => {
  const workspaceFolder = path.resolve(__dirname, "../data/");
  const expectedCertFile = path.resolve(
    workspaceFolder,
    `.home/.${ConfigFolderName}/certificate/localhost.crt`
  );
  const expectedKeyFile = path.resolve(
    workspaceFolder,
    `.home/.${ConfigFolderName}/certificate/localhost.key`
  );
  beforeEach(() => {
    fs.emptyDirSync(workspaceFolder);
  });

  describe("setupCertificate", () => {
    const fakeHomeDir = path.resolve(__dirname, "../data/.home/");
    let certManager: LocalCertificateManager;

    beforeEach(() => {
      sinon.stub(os, "homedir").callsFake(() => fakeHomeDir);
      sinon.stub(os, "type").returns("Linux");

      fs.emptyDirSync(fakeHomeDir);
      const projectSetting = {
        appName: "",
        projectId: uuid.v4(),
        solutionSettings: {
          name: "",
          version: "",
          activeResourcePlugins: [
            "fx-resource-aad-app-for-teams",
            "fx-resource-simple-auth",
            "fx-resource-frontend-hosting",
            "fx-resource-function",
          ],
        },
        programmingLanguage: "typescript",
      };
      const inputs = {
        platform: Platform.VSCode,
        projectPath: path.resolve(__dirname, `./data/${projectSetting.projectId}`),
      };
      const v2Context = new MockedV2Context(projectSetting);
      certManager = new LocalCertificateManager(v2Context, inputs);
    });

    afterEach(() => {
      sinon.restore();
    });

    it("happy path", async () => {
      await certManager.setupCertificate(true);

      chai.assert.isTrue(fs.pathExistsSync(expectedCertFile));
      const certContent = fs.readFileSync(expectedCertFile, { encoding: "utf8" });
      chai.assert.isTrue(
        /-----BEGIN CERTIFICATE-----.*-----END CERTIFICATE-----/gs.test(certContent)
      );
      chai.assert.isTrue(fs.pathExistsSync(expectedKeyFile));
      const keyContent = fs.readFileSync(expectedKeyFile, { encoding: "utf8" });
      chai.assert.isTrue(
        /-----BEGIN RSA PRIVATE KEY-----.*-----END RSA PRIVATE KEY-----/gs.test(keyContent)
      );
    });

    it("skip trust", async () => {
      await certManager.setupCertificate(false);

      chai.assert.isTrue(fs.pathExistsSync(expectedCertFile));
      const certContent = fs.readFileSync(expectedCertFile, { encoding: "utf8" });
      chai.assert.isTrue(
        /-----BEGIN CERTIFICATE-----.*-----END CERTIFICATE-----/gs.test(certContent)
      );
      chai.assert.isTrue(fs.pathExistsSync(expectedKeyFile));
      const keyContent = fs.readFileSync(expectedKeyFile, { encoding: "utf8" });
      chai.assert.isTrue(
        /-----BEGIN RSA PRIVATE KEY-----.*-----END RSA PRIVATE KEY-----/gs.test(keyContent)
      );
    });

    it("existing verified cert", async () => {
      await certManager.setupCertificate(true);
      const certContent1 = fs.readFileSync(expectedCertFile, { encoding: "utf8" });
      const thumbprint1 = getCertThumbprint(certContent1);

      await certManager.setupCertificate(true);
      chai.assert.isTrue(fs.pathExistsSync(expectedCertFile));
      chai.assert.isTrue(fs.pathExistsSync(expectedKeyFile));
      const certContent2 = fs.readFileSync(expectedCertFile, { encoding: "utf8" });
      const thumbprint2 = getCertThumbprint(certContent2);
      chai.assert.equal(thumbprint1, thumbprint2);
    });
  });
});

function getCertThumbprint(certContent: string): string {
  const cert = pki.certificateFromPem(certContent);
  const der = asn1.toDer(pki.certificateToAsn1(cert)).getBytes();
  const m = md.sha1.create();
  m.update(der);
  return m.digest().toHex();
}
