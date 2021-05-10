import * as React from 'react';
import { Icon, Stack, Image, PrimaryButton } from '@fluentui/react'
import './SampleGallery.scss'
import { Commands } from './Commands'
import HelloWorld from '../../media/helloworld.gif'

export default class SampleGallery extends React.Component<any, any> {
    constructor(props: any) {
        super(props);
    }

    componentDidMount() {
        window.addEventListener("message", this.receiveMessage, false);
    }

    render() {
        return(
            <div className="sample-gallery">
                <div className="section">
                    <div className="logo">
                        <Icon iconName="Heart" className="logo" />
                    </div>
                    <div className="title">
                        <h2>Samples</h2>
                        <h3>Explore our samples to help you quickly get started with the basic Teams app concepts and code structures.</h3>
                    </div>
                </div>
                <Stack
                    horizontal
                    verticalFill
                    wrap
                    horizontalAlign={'start'}
                    verticalAlign={'start'}
                    styles={{root:{overflow: "visible"}}}
                    tokens={{childrenGap: 20}}>
                    <SampleAppCard
                        image={HelloWorld}
                        tags={["React", "Azure function", "Azure SQL", "JS"]}
                        title="Todo List with backend on Azure"
                        description="Todo List provides easy way to manage to-do items in Teams Client. This app helps enabling task collaboration and management for your team in which the app is installed. The frontend is a React page and the backend is hosted on Azure, you will need an Azure subscription to run the app."
                        sampleAppFolder="todo-list-with-Azure-backend"
                        sampleAppUrl="https://github.com/OfficeDev/TeamsFx-Samples/archive/refs/heads/main.zip"/>
                    <SampleAppCard
                        image={HelloWorld}
                        tags={["SharePoint", "SPFx", "TS"]}
                        title="Todo List with SPFx "
                        description="Todo List with SPFx is a Todo List for individual user to manage his/her personal to-do items in the format of an app installed on Teams client instead of in a Teams Channel. This app is hosted on M365 subscriptions with no requirements of Azure resources."
                        sampleAppFolder="todo-list-SPFx"
                        sampleAppUrl="https://github.com/OfficeDev/TeamsFx-Samples/archive/refs/heads/main.zip" />
                    <SampleAppCard
                        image={HelloWorld}
                        tags={["Tab", "Message Extension", "TS"]}
                        title="Share Now"
                        description="The Share Now promotes the exchange of information between colleagues by enabling users to share content within the Teams environment. Users engage the app to share items of interest, discover new shared content, set preferences, and bookmark favorites for later reading."
                        sampleAppFolder="share-now"
                        sampleAppUrl="https://github.com/OfficeDev/TeamsFx-Samples/archive/refs/heads/main.zip" />
                    <SampleAppCard
                        image={HelloWorld}
                        tags={["Easy QnA", "Bot", "JS"]}
                        title="FAQ Plus"
                        description="FAQ Plus is a conversational Q&A bot providing an easy way to answer frequently asked questions by users. One can ask a question and the bot responds if it is contained in the knowledge base. If not, the bot submits the question to a pre-configured team of experts who help to provide support."
                        sampleAppFolder="faq-plus"
                        sampleAppUrl="https://github.com/OfficeDev/TeamsFx-Samples/archive/refs/heads/main.zip" />
                    <SampleAppCard
                        image={HelloWorld}
                        tags={["Meeting extension", "JS"]}
                        title="In-meeting App"
                        description="In-meeting app is a hello-world template which shows how to build an app working in the context of a Teams meeting. This is a helloworld sample which does not provide any functional feature. This app contains a side panel and a Bot which only shows user profile and can only be added to a Teams meeting."
                        sampleAppFolder="in-meeting-app"
                        sampleAppUrl="https://github.com/OfficeDev/TeamsFx-Samples/archive/refs/heads/main.zip" />
                </Stack>
            </div>
        );
    }

    receiveMessage = (event: any) => {
        const message = event.data.message;

        switch (message) {
            default:
                break;
        }
    }
}

class SampleAppCard extends React.Component<any, any>{
    constructor(props: any) {
        super(props);
    }

    render() {
        return (
            <div className="sample-app-card">
                <Image 
                src={this.props.image} width={278} height={160}/>
                <div className="section">
                    {
                        this.props.tags && (
                            this.props.tags.map((value: string) => {
                                return <p className="tag">{value}</p>
                            })
                        )
                    }
                </div>
                <h2>{this.props.title}</h2>
                <h3>{this.props.description}</h3>
                <div className="section buttons">
                    <PrimaryButton 
                        text="Download"
                        className="right-aligned"
                        onClick={() => { this.cloneSampleApp(this.props.title, this.props.sampleAppUrl, this.props.sampleAppFolder)}}/>
                    <PrimaryButton
                        style={{display: "none"}}
                        text="Preview" />
                </div>
            </div>
        )
    }

    cloneSampleApp = (sampleAppName: string, sampleAppUrl: string, sampleAppFolder: string) => {
        vscode.postMessage({
            command: Commands.CloneSampleApp,
            data: {
                appName: sampleAppName,
                appUrl: sampleAppUrl,
                appFolder: sampleAppFolder
            }
        })
    }
}

