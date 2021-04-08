﻿using System;
using Microsoft.Azure.WebJobs.Description;

namespace TeamsDevFunction
{
    [Binding]
    [AttributeUsage(AttributeTargets.Parameter)]
    public sealed class TeamsFxAttribute : Attribute
    {
        public TeamsFxAttribute()
        {
            ClientId = Environment.GetEnvironmentVariable(ConfigurationNames.ClientId);
            ClientSecret = Environment.GetEnvironmentVariable(ConfigurationNames.ClientSecret);
            OAuthAuthority = Environment.GetEnvironmentVariable(ConfigurationNames.OAuthAuthorityHost).TrimEnd('/')
                + '/' + Environment.GetEnvironmentVariable(ConfigurationNames.TenantId);
            AllowedAppIds = Environment.GetEnvironmentVariable(ConfigurationNames.AllowedAppIds);

            var TokenRefreshBufferMinutesConfig = Environment.GetEnvironmentVariable(ConfigurationNames.TokenRefreshBufferMinutes);
            if (int.TryParse(TokenRefreshBufferMinutesConfig, out int bufferMinutes))
            {
                TokenRefreshBufferMinutes = bufferMinutes;
            }
            else
            {
                TokenRefreshBufferMinutes = 5; // Follow MSAL's refresh policy
            }
        }

        public string ClientId { get; private set; }
        public string ClientSecret { get; private set; }
        public string OAuthAuthority { get; set; }
        public string AllowedAppIds { get; set; }

        // Refresh token if token expires in TokenRefreshBufferMinutes minutes
        public int TokenRefreshBufferMinutes { get; private set; }
    }
}
