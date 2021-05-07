﻿// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

namespace Microsoft.Azure.WebJobs.Extensions.TeamsFx.Tests.Models
{
    public class IntegrationTestSettings
    {
        public string MainTestFunctionPort { get; set; }
        public string EmptyClientIdTestFunctionPort { get; set; }
        public string EmptyStringPropertiesTestFunctionPort { get; set; }
        public string NullClientIdTestFunctionPort { get; set; }
        public string NullPropertiesTestFunctionPort { get; set; }
        public string ClientId { get; set; }
        public string ClientSecret { get; set; }
        public string UnauthorizedAadAppClientId { get; set; }
        public string UnauthorizedAadAppClientSecret { get; set; }
        public string AllowedAppClientId { get; set; }
        public string AllowedAppClientSecret { get; set; }
        public string AuthorityHost { get; set; }
        public string TenantId { get; set; }
    }
}