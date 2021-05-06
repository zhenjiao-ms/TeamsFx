// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { AccessToken } from "@azure/core-auth";
import { assert, use as chaiUse } from "chai";
import chaiPromises from "chai-as-promised";
import { MsGraphAuthProvider, loadConfiguration, TeamsUserCredential } from "../../../src";
import sinon from "sinon";
import { getSSOToken, AADJwtPayLoad, SSOToken } from "../helper.browser";
import jwtDecode from "jwt-decode";

chaiUse(chaiPromises);
const env = (window as any).__env__;

describe("MsGraphAuthProvider Tests - Browser", () => {
  let ssoToken: SSOToken;

  beforeEach(async function() {
    ssoToken = await getSSOToken();

    // mock getting sso token.
    sinon.stub(TeamsUserCredential.prototype, <any>"getSSOToken").callsFake(
      (): Promise<AccessToken | null> => {
        return new Promise((resolve) => {
          resolve({
            token: ssoToken.token!,
            expiresOnTimestamp: ssoToken.expire_time!
          });
        });
      }
    );

    loadConfiguration({
      authentication: {
        initiateLoginEndpoint: "fake_login_url",
        simpleAuthEndpoint: "https://localhost:5001",
        clientId: env.SDK_INTEGRATION_TEST_M365_AAD_CLIENT_ID
      }
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  it("getAccessToken with user.read scopes should get valid access token", async function() {
    const scopes = "User.Read";
    const credential = new TeamsUserCredential();
    const authProvider: MsGraphAuthProvider = new MsGraphAuthProvider(credential, scopes);
    const accessToken = await authProvider.getAccessToken();

    const decodedToken = jwtDecode<AADJwtPayLoad>(accessToken);
    assert.strictEqual(decodedToken.aud, "00000003-0000-0000-c000-000000000000");
    assert.strictEqual(decodedToken.appid, env.SDK_INTEGRATION_TEST_M365_AAD_CLIENT_ID);
    assert.strictEqual(decodedToken.idtyp, "user");
    assert.strictEqual(decodedToken.upn, env.SDK_INTEGRATION_TEST_ACCOUNT_NAME);
    assert.isTrue(decodedToken.scp!.indexOf(scopes) >= 0);
  });

  it("getAccessToken without scopes should get access token with default scope", async function() {
    const credential = new TeamsUserCredential();
    const authProvider: MsGraphAuthProvider = new MsGraphAuthProvider(credential);
    const accessToken = await authProvider.getAccessToken();

    const decodedToken = jwtDecode<AADJwtPayLoad>(accessToken);
    assert.strictEqual(decodedToken.aud, "https://graph.microsoft.com");
    assert.strictEqual(decodedToken.appid, env.SDK_INTEGRATION_TEST_M365_AAD_CLIENT_ID);
    assert.strictEqual(decodedToken.idtyp, "user");
    assert.strictEqual(decodedToken.upn, env.SDK_INTEGRATION_TEST_ACCOUNT_NAME);
    assert.isTrue(decodedToken.scp!.indexOf("User.Read") >= 0);
  });
});
