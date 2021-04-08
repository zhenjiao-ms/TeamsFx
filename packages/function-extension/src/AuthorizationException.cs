using System;

namespace TeamsDevFunction
{
    public class AuthorizationException : Exception
    {
        public AuthorizationException(string message)
            : base(message) { }
    }
}
