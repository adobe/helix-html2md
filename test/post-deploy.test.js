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

const TEST_MD = `
# Helix Test Content

Content is: sharepoint-/main/index.docx

And more...newcontent

---

<table>
  <tr>
    <td colspan="2">Metadata</td>
  </tr>
  <tr>
    <td>title</td>
    <td>Helix Test Content</td>
  </tr>
  <tr>
    <td>description</td>
    <td>Content is: sharepoint-/main/index.docx</td>
  </tr>
</table>
`;

createTargets().forEach((target) => {
  describe(`Post-Deploy Tests (${target.title()})`, () => {
    const fetchContext = noCache();
    const { fetch } = fetchContext;

    afterEach(() => {
      fetchContext.reset();
    });

    it('converts html from the helix site', async () => {
      const url = new URL(`${target.host()}${target.urlPath()}`);
      url.searchParams.append('url', ' https://main--helix-test-content-onedrive--adobe.hlx.page/');
      url.searchParams.append('owner', 'owner');
      url.searchParams.append('repo', 'repo');
      url.searchParams.append('contentBusId', 'foo-id');
      const res = await fetch(url);
      assert.strictEqual(res.status, 200);
      assert.strictEqual((await res.text()).trim(), TEST_MD.trim());
    }).timeout(50000);
  });
});