/*
 * Copyright 2021 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
import assert from 'assert';
import nock from 'nock';
import { Scope } from 'nock/lib/scope.js';

function extractMeta(hdrs) {
  return Object
    .keys(hdrs)
    .filter((key) => (key.startsWith('x-amz-meta-')))
    .reduce((prev, key) => ({ ...prev, [key.substring(11)]: hdrs[key] }), {});
}
/**
 * Add custom scope interceptor chain for multipart uploads
 */
Scope.prototype.putObject = function putObject(path, expectedMeta, count = 1) {
  return this.put(`${path}?x-id=PutObject`)
    .times(count)
    .reply(function reply() {
      assert.deepStrictEqual(extractMeta(this.req.headers), expectedMeta);
      return [201];
    });
};

// eslint-disable-next-line import/prefer-default-export
export function Nock() {
  const scopes = {};

  let unmatched;

  let savedEnv;

  function noMatchHandler(req) {
    unmatched.push(req);
  }

  function nocker(url) {
    let scope = scopes[url];
    if (!scope) {
      scope = nock(url);
      scopes[url] = scope;
    }
    if (!unmatched) {
      unmatched = [];
      nock.emitter.on('no match', noMatchHandler);
    }
    return scope;
  }

  nocker.env = (overrides = {}) => {
    savedEnv = { ...process.env };
    Object.assign(process.env, {
      AWS_REGION: 'us-east-1',
      AWS_ACCESS_KEY_ID: 'dummy-id',
      AWS_SECRET_ACCESS_KEY: 'dummy-key',
      ...overrides,
    });
    return nocker;
  };

  nocker.done = () => {
    if (savedEnv) {
      process.env = savedEnv;
    }

    try {
      Object.values(scopes).forEach((s) => s.done());
    } finally {
      nock.cleanAll();
    }
    if (unmatched) {
      assert.deepStrictEqual(unmatched.map((req) => req.options || req), []);
      nock.emitter.off('no match', noMatchHandler);
    }
  };

  return nocker;
}
