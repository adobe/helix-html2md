/*
 * Copyright 2019 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/* eslint-env mocha */
import assert from 'assert';
import { noCache } from '@adobe/helix-fetch';
import { createTargets } from './post-deploy-utils.js';

createTargets().forEach((target) => {
  describe(`Post-Deploy Tests (${target.title()})`, () => {
    const fetchContext = noCache();
    const { fetch } = fetchContext;

    afterEach(() => {
      fetchContext.reset();
    });

    it('returns the status of the function', async () => {
      const res = await fetch(`${target.host()}${target.urlPath()}/_status_check/healthcheck.json`);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      delete json.process;
      delete json.response_time;
      assert.deepStrictEqual(json, {
        status: 'OK',
        version: target.version,
      });
    }).timeout(50000);

    it('converts html from the helix site', async () => {
      const url = new URL(`${target.host()}${target.urlPath()}`);
      url.searchParams.append('url', ' https://main--helix-test-content-onedrive--adobe.hlx.page/');
      url.searchParams.append('owner', 'owner');
      url.searchParams.append('repo', 'repo');
      url.searchParams.append('contentBusId', 'foo-id');
      const res = await fetch(url);
      assert.strictEqual(res.status, 200);
      assert.strictEqual((await res.text()).trim(), '<!-- Content is: github-main-/head.html  -->\n'
        + '\n'
        + '# Helix Test Content\n'
        + '\n'
        + 'Content is: sharepoint-/main/index.docx\n'
        + '\n'
        + 'And more...newcontent');
    }).timeout(50000);
  });
});
