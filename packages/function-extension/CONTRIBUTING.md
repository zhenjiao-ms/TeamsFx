# Contributing

Welcome and thank you for your interest in contributing to **Microsoft.Azure.WebJobs.Extensions.TeamsFx**! Before contributing to this project, please review this document for policies and procedures which will ease the contribution and review process for everyone. If you have questions, please raise your issue on github.

## Setup Development Environment

1. Install .NET core SDK 3.1. [[REF](https://dotnet.microsoft.com/download/dotnet-core/3.1)]

2. Install Function Core Tools v3 [[REF](https://docs.microsoft.com/en-us/azure/azure-functions/functions-run-local?tabs=linux%2Ccsharp%2Cbash#install-the-azure-functions-core-tools)]

3. Install Node v12

## How to Build

```shell
dotnet build Microsoft.Azure.WebJobs.Extensions.TeamsFx.sln
```

## How to Run Test Cases

### Setup Test Environment
1. Follow [quickstart-register-app](https://docs.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app) to create 3 AAD apps (referenced as AAD app 1/2/3 below) and generate client secrets for them. You do not need to add redirect URI for the AAD apps. Record the client id and client secrets somewhere, they're required in next steps.
2. Set following environment variables on your dev machine
    | Variable | Expected Value |
    |-|-|
    | TeamsFx_BINDING_IntegrationTestSettings__ClientId | Client Id of AAD app 1 |
    | TeamsFx_BINDING_IntegrationTestSettings__ClientSecret | Client Secret of AAD app 1 |
    | TeamsFx_BINDING_IntegrationTestSettings__UnauthorizedAadAppClientId | Client Id of AAD app 2 |
    | TeamsFx_BINDING_IntegrationTestSettings__UnauthorizedAadAppClientSecret | Client Secret of AAD app 2 |
    | TeamsFx_BINDING_IntegrationTestSettings__AllowedAppClientId | Client Id of AAD app 3 |
    | TeamsFx_BINDING_IntegrationTestSettings__AllowedAppClientSecret | Client Secret of AAD app 3 |
    | TeamsFx_BINDING_IntegrationTestSettings__AuthorityHost | Host of AAD OAuth Authority, usually use https://login.microsoftonline.com. Update the value properly if you're using non-global AAD |
    | TeamsFx_BINDING_IntegrationTestSettings__TenantId | AAD tenant id where you create the AAD apps |

### Run Test Cases on Linux

1. Build nuget release package
    ```shell
    dotnet build -c Release Microsoft.Azure.WebJobs.Extensions.TeamsFx.sln
    dotnet pack -c Release ./src/Microsoft.Azure.WebJobs.Extensions.TeamsFx.csproj
    ```
2. Run test cases
    ```shell
    ./script/test.sh
    ```

### Run Test Cases on Windows
You can use [Windows Subsystem for Linux](https://docs.microsoft.com/en-us/windows/wsl/) to checkout the repo with correct line ending and run the test cases by following the Linux instructions.

## Style Guidelines

This project uses FxCop to check code style. You can find style warnings in Visual Studio or build logs.

## Pull Request Process

1. Check out a new branch from "main".
2. Add your features and commit to the new branch.
3. Make sure your changes are covered by tests. [How to Run Test Cases](#how-to-run-test-cases)
4. Ensure code style check has no warning or error. [Style Guidelines](#style-guidelines)
5. Create a pull request to merge your changes to "main" branch.
6. At least one approve from code owners is required.