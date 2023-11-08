import { Capture, Match, Template } from "aws-cdk-lib/assertions";
import * as cdk from "aws-cdk-lib";
import * as sns from "aws-cdk-lib/aws-sns";
import { AutoAnalyzeStack } from "../lib/auto-analyze-stack";

describe("AutoAnalyzeStack", () => {
    test("synthesizes the way we expect", () => {
        const app = new cdk.App();

        // Since the StateMachineStack consumes resources from a separate stack
        // (cross-stack references), we create a stack for our SNS topics to live
        // in here. These topics can then be passed to the StateMachineStack later,
        // creating a cross-stack reference.
        const topicsStack = new cdk.Stack(app, "TopicsStack");

        // Create the topic the stack we're testing will reference.
        const topics = [new sns.Topic(topicsStack, "Topic1", {})];

        // Create the StateMachineStack.
        const autoAnalyzeStack = new AutoAnalyzeStack(app, "AutoAnalyzeStack", {
            topics: topics, // Cross-stack reference
        });

        // Prepare the stack for assertions.
        const template = Template.fromStack(autoAnalyzeStack);

        // Assert it creates the function with the correct properties...
        template.hasResourceProperties("AWS::Lambda::Function", {
            Handler: "handler",
            Runtime: "nodejs18.x",
        });

        // Creates the subscription...
        template.resourceCountIs("AWS::SNS::Subscription", 1);
    })
})
