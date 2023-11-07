#!/usr/bin/env python3
import aws_cdk as cdk
from .compute import omics_workflow_Stack
from .constants import DEV_ENV, DEV_CONFIG

app = cdk.App()

omics_workflow = omics_workflow_Stack(
    app, "omics-eventbridge-solution", env=DEV_ENV, config=DEV_CONFIG
)

app.synth()
