import * as React from 'react';
import { ActionButton, Icon, PrimaryButton, Image } from '@fluentui/react'
import "./QuickStart.scss"
import { Commands } from './Commands'
import { PanelType } from './PanelType'
import CommandsIMG from '../../media/step_commands.svg'
import NodeIMG from '../../media/step_nodejs.svg'
import M365IMG from '../../media/step_m365.svg'
import AzureIMG from '../../media/step_azure.svg'
import BuildAppIMG from '../../media/step_buildapp.svg'
import Step_Done from '../../media/Done.svg'
import Step_Active_0 from '../../media/active-0.svg'
import Step_Active_1 from '../../media/active-1.svg'
import Step_Active_2 from '../../media/active-2.svg'
import Step_Active_3 from '../../media/active-3.svg'
import Step_Active_4 from '../../media/active-4.svg'
import Step_Active_5 from '../../media/active-5.svg'
import Step_Inactive_0 from '../../media/inactive-0.svg'
import Step_Inactive_1 from '../../media/inactive-1.svg'
import Step_Inactive_2 from '../../media/inactive-2.svg'
import Step_Inactive_3 from '../../media/inactive-3.svg'
import Step_Inactive_4 from '../../media/inactive-4.svg'
import Step_Inactive_5 from '../../media/inactive-5.svg'

export default class QuickStart extends React.Component<any, any>{
    constructor(props: any) {
        super(props);

        this.state = {
            currentStep: 1,
            m365Account: undefined,
            azureAccount: undefined,
            stepsDone: [false, false, false, false, false, false]
        }
    }

    componentDidMount() {
        window.addEventListener("message", this.receiveMessage, false);
    }

    render() {
        let m365AccountContent: (string | JSX.Element)[] | string;
        if (this.state.m365Account === undefined) {
            m365AccountContent = ["The Teams Toolkit requires a Microsoft 365 (Organizational Account) where Teams is running and has been registered.", <br />, <br />, "You can still experience making a Teams app by using a testing account from ", <a href="https://developer.microsoft.com/en-us/microsoft-365/dev-program">M365 Developer Program</a>, "."];
        } else {
            m365AccountContent = `You have successfully signed in with your M365 account (${this.state.m365Account}).`;
        }

        let azureAccountContent: (string | JSX.Element)[] | string;
        if (this.state.azureAccount === undefined) {
            azureAccountContent = ["The Teams Toolkit requires an Azure account and subscription to deploy the Azure resources for your project.", <br />, <br />, "You will not be charged without your further confirmation."];
        } else {
            azureAccountContent = `You have successfully signed in with your Azure account (${this.state.azureAccount}).`;
        }

        let stepCount: number = 1;

        return (
            <div className="quick-start-page">
                <div className="section">
                    <div className="logo">
                        <Icon iconName="LightningBolt" className="logo" />
                    </div>
                    <div className="title">
                        <h2>Quick Start</h2>
                        <h3 className="text">Jumpstart your Teams app development experience</h3>
                    </div>
                </div>
                <div className="flex-section">
                    <div className="table-of-contents">
                        {(()=>{
                            const curStep = stepCount;
                            stepCount++;
                            return <GetStartedAction
                                title={`What are Teams app "Capabilities"?`}
                                content={[<a href="https://docs.microsoft.com/en-us/microsoftteams/platform/concepts/capabilities-overview">Capabilities</a>, " are the extension points for building apps on the Microsoft Teams platform."]}
                                actionText="Watch Video (1 min)"
                                onAction={this.onWatchVideo}
                                secondaryActionText="Next"
                                onSecondaryAction={() => { this.onNextStep(curStep); }}
                                expanded={this.state.currentStep === curStep}
                                onCollapsedCardClicked={this.onCollapsedCardClicked}
                                step={curStep}
                                done={this.state.stepsDone[curStep - 1]}
                            />
                        })()}
                        {(() => {
                            const shortcut = isMacPlatform ? '⇧⌘P': 'Ctrl+Shift+P';
                            const curStep = stepCount;
                            stepCount++;
                            return <GetStartedAction
                                title={`Explore Teams Toolkit commands`}
                                content={`Open Command Palette (${shortcut}) and type ‘Teamsfx’ to find all relevant commands. `}
                                actionText="Display TeamsFx commands"
                                onAction={this.displayCommands}
                                secondaryActionText="Next"
                                onSecondaryAction={() => { this.onNextStep(curStep); }}
                                expanded={this.state.currentStep === curStep}
                                tip={["Tip: Use ", <a href="https://github.com/OfficeDev/TeamsFx/tree/main/packages/cli">Command Line Interface (CLI)</a>, " to increase productivity"]}
                                onCollapsedCardClicked={this.onCollapsedCardClicked}
                                step={curStep}
                                done={this.state.stepsDone[curStep - 1]}
                                />
                        })()}
                        {(() => {
                            if(!isSupportedNode){
                                const curStep = stepCount;
                                stepCount++;
                                return <GetStartedAction
                                    title={`Install Node.js`}
                                    content={["The toolkit cannot detect the right version of Node.js on your machine.", <br />, <br />, "As a fundamental runtime context for Teams app, Node.js v10.x, v12.x or v14.x is required (v.12.x is recommended). Please install the appropriate version to run the Microsoft Teams Toolkit. ", <br />, <br />, "Read more about ", <a href="http://npm.github.io/installation-setup-docs/installing/using-a-node-version-manager.html">managing Node.js versions</a>, "."]}
                                    actionText="Download Node.js (v.12.x)"
                                    onAction={this.downloadNode}
                                    secondaryActionText="Next"
                                    onSecondaryAction={() => { this.onNextStep(curStep); }}
                                    expanded={this.state.currentStep === curStep}
                                    onCollapsedCardClicked={this.onCollapsedCardClicked}
                                    step={curStep}
                                    done={this.state.stepsDone[curStep - 1]}
                                />
                            }
                        })()}
                        {(() => {
                            const curStep = stepCount;
                            stepCount++;
                            return <GetStartedAction
                                title={`Prepare M365 account`}
                                content={m365AccountContent}
                                actionText={this.state.m365Account === undefined ? "Sign in to M365" : undefined}
                                onAction={this.signinM365}
                                secondaryActionText="Next"
                                onSecondaryAction={() => { this.onNextStep(curStep); }}
                                expanded={this.state.currentStep === curStep}
                                onCollapsedCardClicked={this.onCollapsedCardClicked}
                                step={curStep}
                                done={this.state.stepsDone[curStep - 1] || this.state.m365Account}
                            />
                        })()}
                        {(() => {
                            const curStep = stepCount;
                            stepCount++;
                            return <GetStartedAction
                                title={`Prepare Azure account`}
                                content={azureAccountContent}
                                actionText={this.state.azureAccount === undefined ? "Sign in to Azure" : undefined}
                                onAction={this.signinAzure}
                                secondaryActionText="Next"
                                onSecondaryAction={() => { this.onNextStep(curStep); }}
                                expanded={this.state.currentStep === curStep}
                                onCollapsedCardClicked={this.onCollapsedCardClicked}
                                step={curStep}
                                done={this.state.stepsDone[curStep - 1] || this.state.azureAccount}
                            />
                        })()}
                        {(() => {
                            const curStep = stepCount;
                            stepCount++;
                            return <GetStartedAction
                                title={`Build your first Teams app from samples`}
                                content={["Explore our sample apps to help you quickly get started with the Teams app concepts and code structures.", <br />, <br />, "Do you already have a clear idea of which Teams app to build? If so, create a new project from the scratch."]}
                                actionText="View all Samples"
                                onAction={this.viewAllSamples}
                                secondaryActionText="Create New Project"
                                onSecondaryAction={this.createNewProject}
                                expanded={this.state.currentStep === curStep}
                                onCollapsedCardClicked={this.onCollapsedCardClicked}
                                step={curStep}
                                done={this.state.stepsDone[curStep - 1]}
                            />
                        })()}
                    </div>
                    <div className="stage">
                        {
                            this.state.currentStep === 1 && (
                                <div className="player" onMouseOver={this.onShowWatchOnBrowser} onMouseLeave={this.onHideWatchOnBrowser}>
                                    <video id="capabilitiesVideo" className="capabilitiesVideo" controls disablePictureInPicture>
                                        <source src="http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"></source>
                                    </video>
                                    <div>
                                        <a id="watchOnBrowser" className="watchOnBrowser" href="http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" target="_blank">Watch on browser</a>
                                    </div>
                                </div>
                            )
                        }
                        {
                            this.state.currentStep === 2 && (
                                <Image
                                    src={CommandsIMG}
                                />
                            )
                        }
                        {
                            this.state.currentStep === 3 && !isSupportedNode && (
                                <Image
                                    src={NodeIMG}
                                />
                            )
                        }
                        {
                            this.state.currentStep === (isSupportedNode? 3: 4) && (
                                <Image
                                    src={M365IMG}
                                />
                            )
                        }
                        {
                            this.state.currentStep === (isSupportedNode ? 4 : 5) && (
                                <Image
                                    src={AzureIMG}
                                />
                            )
                        }
                        {
                            this.state.currentStep === (isSupportedNode ? 5 : 6) && (
                                <Image
                                    src={BuildAppIMG}
                                />
                            )
                        }
                    </div>
                </div>
            </div>
        )
    }

    receiveMessage = (event: any) => {
        const message = event.data.message;

        switch (message) {
            case 'm365AccountChange':
                this.setState({ m365Account: event.data.data });
                break;
            case 'azureAccountChange':
                this.setState({ azureAccount: event.data.data });
                break;
            default:
                break;
        }
    }

    onNextStep = (step: number) => {
        this.setState({
            currentStep: step + 1
        });
    }

    createNewProject = () => {
        vscode.postMessage({
            command: Commands.CreateNewProject
        });
    }

    onCollapsedCardClicked = (step: number) => {
        this.setState({
            currentStep: step
        })
    }

    onWatchVideo = () => {
        const video = document.getElementById("capabilitiesVideo") as HTMLMediaElement;
        if(video && video.paused){
            video!.play();
        }

        let done = this.state.stepsDone;
        done[0] = true;
        this.setState({
            stepsDone: done
        });
    }

    onHideWatchOnBrowser = () => {
        const video = document.getElementById("capabilitiesVideo") as HTMLMediaElement;
        const watchOnBrowser = document.getElementById("watchOnBrowser") as any;

        if(video && video.paused !== true) {
            watchOnBrowser.style.display = "none";
        }
        
    }

    onShowWatchOnBrowser = () => {
        const watchOnBrowser = document.getElementById("watchOnBrowser") as any;

        watchOnBrowser.style.display = "";
    }

    displayCommands = () => {
        vscode.postMessage({
            command: Commands.DisplayCommands,
            data: "Teams"
        });

        let done = this.state.stepsDone;
        done[1] = true;
        this.setState({
            stepsDone: done
        });
    }

    downloadNode = () => {
        vscode.postMessage({
            command: Commands.OpenExternalLink,
            data: "https://nodejs.org/dist/latest-v12.x/"
        });

        let done = this.state.stepsDone;
        done[2] = true;
        this.setState({
            stepsDone: done
        });
    }

    signinM365 = () => {
        vscode.postMessage({
            command: Commands.SigninM365
        });

        let done = this.state.stepsDone;
        done[3] = true;
        this.setState({
            stepsDone: done
        });
    }

    signinAzure = () => {
        vscode.postMessage({
            command: Commands.SigninAzure
        });

        let done = this.state.stepsDone;
        done[4] = true;
        this.setState({
            stepsDone: done
        });
    }

    viewAllSamples = () => {
        let done = this.state.stepsDone;
        done[5] = true;
        this.setState({
            stepsDone: done
        });

        vscode.postMessage({
            command: Commands.SwitchPanel,
            data: PanelType.SampleGallery
        })
    }
}

class GetStartedAction extends React.Component<any, any>{
    constructor(props: any) {
        super(props);
    }

    render() {
        if (this.props.expanded) {
            return (
                <div className="action-card">
                    <div className="flex-section card-line">
                        {
                            this.props.done && (
                                <Image src={Step_Done} className="action-icon" />
                            )
                        }
                        {
                            !this.props.done && (
                                <Image src={this.getStepIcon()} className="action-icon" />
                            )
                        }
                        <div className="action-title">{this.props.title}</div>
                    </div>
                    <div className="card-line action-content">{this.props.content}</div>
                    <div className="left-right-align">
                        <div className="left">
                            {
                                this.props.actionText && (
                                    <PrimaryButton
                                        onClick={this.props.onAction}
                                        text={this.props.actionText}
                                    />
                                )
                            }
                        </div>
                        <div className="right">
                            <ActionButton
                                onClick={this.props.onSecondaryAction}
                                text={this.props.secondaryActionText}
                            />
                        </div>
                    </div>
                    <div className="tip">
                        {this.props.tip}
                    </div>
                </div>
            );
        } else {
            return (
                <div className="collapse-action-card"
                    onClick={this.onCollapseClicked}>
                    <div className="flex-section">
                        {
                            this.props.done && (
                                <Image src={Step_Done} className="action-icon" />
                            )
                        }
                        {
                            !this.props.done && (
                                <Image src={this.getStepIcon()} className="action-icon" />
                            )
                        }
                        <div className="action-title">{this.props.title}</div>
                    </div>
                </div>
            )
        }
    }

    onCollapseClicked = () => {
        this.props.onCollapsedCardClicked(this.props.step);
    }

    getStepIcon = () =>{
        if(this.props.expanded){
            switch (this.props.step - 1) {
                case 0: return Step_Active_0;
                case 1: return Step_Active_1;
                case 2: return Step_Active_2;
                case 3: return Step_Active_3;
                case 4: return Step_Active_4;
                case 5: return Step_Active_5;
            }
        } else{
            switch (this.props.step - 1) {
                case 0: return Step_Inactive_0;
                case 1: return Step_Inactive_1;
                case 2: return Step_Inactive_2;
                case 3: return Step_Inactive_3;
                case 4: return Step_Inactive_4;
                case 5: return Step_Inactive_5;
            }
        }
    }
}

