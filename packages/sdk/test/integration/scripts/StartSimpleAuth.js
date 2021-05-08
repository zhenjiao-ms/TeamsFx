const admZip = require('adm-zip');
const { BlobServiceClient } = require('@azure/storage-blob');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
require("dotenv").config();

function setupEnv() {
    process.env.CLIENT_ID = process.env.SDK_INTEGRATION_TEST_M365_AAD_CLIENT_ID;
    process.env.CLIENT_SECRET = process.env.SDK_INTEGRATION_TEST_M365_AAD_CLIENT_SECRET;
    process.env.IDENTIFIER_URI = `api://localhost/${process.env.CLIENT_ID}`;
    process.env.OAUTH_AUTHORITY = `https://login.microsoftonline.com/${process.env.SDK_INTEGRATION_TEST_AAD_TENANT_ID}`;
    process.env.AAD_METADATA_ADDRESS = `https://login.microsoftonline.com/${process.env.SDK_INTEGRATION_TEST_AAD_TENANT_ID}/v2.0/.well-known/openid-configuration`;
    process.env.ALLOWED_APP_IDS = "1fec8e78-bce4-4aaf-ab1b-5451cc387264;5e3ce6c0-2b1f-4285-8d4b-75ee78787346;3d6e5c14-3406-4de2-8c00-e647aa15705a";
    process.env.TAB_APP_ENDPOINT = "*";
    process.env.SDK_INTEGRATION_TEST_USER_OBJECT_ID = process.env.SDK_INTEGRATION_TEST_USER_OBJECT_ID;
}

async function downloadSimpleAuth() {
    const versionFilePath = path.join(__dirname, "../../../../fx-core/templates/plugins/resource/simpleauth/version.txt");
    const version = fs.readFileSync(versionFilePath, "utf-8");
    const fileName = `Microsoft.TeamsFx.SimpleAuth_${version}.zip`;
    let endpoint = process.env.SIMPLE_AUTH_ENDPOINT;
    endpoint = endpoint.slice(0, -8);
    const blobUrlWithCredential = `${endpoint}?${process.env.SIMPLE_AUTH_SAS_TOKEN}`;
    try {
        const blobClient = new BlobServiceClient(blobUrlWithCredential).getContainerClient("release").getBlobClient(fileName);
        await blobClient.downloadToFile(__dirname + '/SimpleAuth.zip');
    } catch (error) {
        console.log(error.message);
    }
}

async function startSimpleAuth() {
    let simpleAuthZip = `${__dirname}/SimpleAuth.zip`;
    setupEnv();
    if (!fs.existsSync(simpleAuthZip)) {
        console.log("file not exist");
        try {
            await downloadSimpleAuth();
        } catch (err) {
            console.log(err.message);
        }
    }
    simpleAuthZip = new admZip(`${simpleAuthZip}`);
    console.log("====== 1");
    simpleAuthZip.extractAllTo(`${__dirname}/SimpleAuthUnzipOutput`, true);
    console.log("====== 2");
    spawn('dotnet', [`${__dirname}/SimpleAuthUnzipOutput/Microsoft.TeamsFx.SimpleAuth.dll`]);
}

(async()=>{
    await startSimpleAuth();
})();
