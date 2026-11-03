#!/usr/bin/env node
/**
 * Fail fast if the Lambda zip tree is incomplete.
 * Today's stg outage: missing @smithy/types after terraform apply with a
 * partial node_modules (fileexists(client-s3) alone was not enough).
 */
'use strict';

var required = [
  '@aws-sdk/client-s3',
  '@smithy/types',
  '@smithy/core',
];

required.forEach(function (name) {
  require.resolve(name);
  require(name);
});

console.log('lambda package ok:', required.join(', '));
