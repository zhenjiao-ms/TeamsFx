// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect, use as chaiUse } from "chai";
import "isomorphic-fetch";
import chaiPromises from "chai-as-promised";
import mockedEnv from "mocked-env";
import {
  createMicrosoftGraphClient,
  loadConfiguration,
  OnBehalfOfUserCredential,
  M365TenantCredential,
  ErrorWithCode,
  ErrorCode
} from "../../../src";

chaiUse(chaiPromises);
let mockedEnvRestore: () => void;

describe("createMicrosoftGraphClient Tests - node", () => {
  const scopes = "fake_scope";
  const clientId = "fake_client_id";
  const clientSecret = "fake_client_secret";
  const tenantId = "fake_tenant";
  const authorityHost = "https://fake_authority_host";

  /**
   * {
   * "aud": "test_audience",
   * "iss": "https://login.microsoftonline.com/test_aad_id/v2.0",
   * "iat": 1537231048,
   * "nbf": 1537231048,
   * "exp": 1537234948,
   * "aio": "test_aio",
   * "name": "Teams App Framework SDK Unit Test",
   * "oid": "11111111-2222-3333-4444-555555555555",
   * "preferred_username": "test@microsoft.com",
   * "rh": "test_rh",
   * "scp": "access_as_user",
   * "sub": "test_sub",
   * "tid": "test_tenant_id",
   * "uti": "test_uti",
   * "ver": "2.0"
   * }
   */
  const ssoToken =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJ0ZXN0X2F1ZGllbmNlIiwiaXNzIjoiaHR0cHM6Ly9sb2dpbi5taWNyb3NvZnRvbmxpbmUuY29tL3Rlc3RfYWFkX2lkL3YyLjAiLCJpYXQiOjE1MzcyMzEwNDgsIm5iZiI6MTUzNzIzMTA0OCwiZXhwIjoxNTM3MjM0OTQ4LCJhaW8iOiJ0ZXN0X2FpbyIsIm5hbWUiOiJNT0RTIFRvb2xraXQgU0RLIFVuaXQgVGVzdCIsIm9pZCI6IjExMTExMTExLTIyMjItMzMzMy00NDQ0LTU1NTU1NTU1NTU1NSIsInByZWZlcnJlZF91c2VybmFtZSI6InRlc3RAbWljcm9zb2Z0LmNvbSIsInJoIjoidGVzdF9yaCIsInNjcCI6ImFjY2Vzc19hc191c2VyIiwic3ViIjoidGVzdF9zdWIiLCJ0aWQiOiJ0ZXN0X3RlbmFudF9pZCIsInV0aSI6InRlc3RfdXRpIiwidmVyIjoiMi4wIn0.SshbL1xuE1aNZD5swrWOQYgTR9QCNXkZqUebautBvKM";

  beforeEach(function() {
    mockedEnvRestore = mockedEnv({
      M365_CLIENT_ID: clientId,
      M365_CLIENT_SECRET: clientSecret,
      M365_TENANT_ID: tenantId,
      M365_AUTHORITY_HOST: authorityHost
    });
    loadConfiguration();
  });

  afterEach(function() {
    mockedEnvRestore();
  });

  it("createMicrosoftGraphClient should throw InvalidParameter error with invalid scope", function () {
    const oboCredential = new OnBehalfOfUserCredential(ssoToken);
    const invalidScopes: any = [10, 20];
    expect(() => {
      createMicrosoftGraphClient(oboCredential, invalidScopes);
    })
      .to.throw(ErrorWithCode, "The type of scopes is not valid, it must be string or string array")
      .with.property("code", ErrorCode.InvalidParameter);
  });

  it("createMicrosoftGraphClient should success with OnBehalfOfUserCredential", async function () {
    const oboCredential = new OnBehalfOfUserCredential(ssoToken);
    const graphClient: any = createMicrosoftGraphClient(oboCredential, scopes);
    expect(graphClient.config.authProvider.credential).to.be.instanceOf(OnBehalfOfUserCredential);
  });

  it("createMicrosoftGraphClient should success with M365TenantCredential", async function() {
    const m356Credential = new M365TenantCredential();
    const graphClient: any = createMicrosoftGraphClient(m356Credential, scopes);
    expect(graphClient.config.authProvider.credential).to.be.instanceOf(M365TenantCredential);
  });
});
