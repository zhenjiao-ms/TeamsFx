using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Hosting;
using TeamsDevFunction;

[assembly: WebJobsStartup(typeof(TeamsFxBindingStartup))]
namespace TeamsDevFunction
{
    public class TeamsFxBindingStartup : IWebJobsStartup
    {
        public void Configure(IWebJobsBuilder builder)
        {
            builder.AddTeamsFxBinding();
        }
    }
}
