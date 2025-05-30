#!/usr/bin/env node
require('source-map-support/register');
const cdk = require('aws-cdk-lib');
const { SetlistaStack } = require('../lib/setlista-stack');

const app = new cdk.App();

new SetlistaStack(app, 'SetlistaStack', {
  env: {
    account: '836481963552',
    region: 'us-east-1',
  },
  description: 'Setlista application infrastructure',
});

app.synth();