using Microsoft.Azure.WebJobs.Host.Bindings;
using Microsoft.Extensions.Logging;
using System.Threading.Tasks;

namespace TeamsDevFunction
{
    public class TeamsFxBindingProvider : IBindingProvider
    {
        private readonly ILogger _logger;
        public TeamsFxBindingProvider(ILogger logger)
        {
            _logger = logger;
        }
        public Task<IBinding> TryCreateAsync(BindingProviderContext context)
        {
            IBinding binding = new TeamsFxBinding(context, _logger);
            return Task.FromResult(binding);
        }
    }
}