#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SetlistaStack } from '../lib/setlista-stack';

const app = new cdk.App();

new SetlistaStack(app, 'SetlistaStack', {
  env: {
    account: '836481963552',
    region: 'us-east-1',
  },
  description: 'Setlista application infrastructure',
});

app.synth();