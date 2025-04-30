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
import { noCache } from '@adobe/fetch';
import { createTargets } from './post-deploy-utils.js';

const TEST_MD = `
# Helix Test Content

Content is: sharepoint-/main/index.docx

\\>95%

And more...newcontent

+----------------------------------------------------------------+
| Metadata                                                       |
+----------------------+-----------------------------------------+
| title                | Helix Test Content                      |
+----------------------+-----------------------------------------+
| description          | Content is: sharepoint-/main/index.docx |
+----------------------+-----------------------------------------+
| og:title             | Helix Test Content                      |
+----------------------+-----------------------------------------+
| og:description       | Content is: sharepoint-/main/index.docx |
+----------------------+-----------------------------------------+
| og:url               | https\\://www\\.example.com/              |
+----------------------+-----------------------------------------+
| og:image             | ![][image0]                             |
+----------------------+-----------------------------------------+
| og:image:secure\\_url | ![][image0]                             |
+----------------------+-----------------------------------------+
| twitter:card         | summary\\_large\\_image                   |
+----------------------+-----------------------------------------+
| twitter:title        | Helix Test Content                      |
+----------------------+-----------------------------------------+
| twitter:description  | Content is: sharepoint-/main/index.docx |
+----------------------+-----------------------------------------+
| twitter:image        | ![][image0]                             |
+----------------------+-----------------------------------------+
| serp-content-type    | overlay                                 |
+----------------------+-----------------------------------------+

[image0]: about:error
`;

createTargets({ _version: 'ci' }).forEach((target) => {
  describe(`Post-Deploy Tests (${target.title()})`, () => {
    const fetchContext = noCache();
    const { fetch } = fetchContext;

    afterEach(async () => {
      await fetchContext.reset();
    });

    it('converts html from the helix site', async () => {
      const url = new URL(`${target.host()}${target.urlPath()}`);
      url.searchParams.append('sourceUrl', 'https://main--helix-test-content-onedrive--adobe.hlx.page');
      url.searchParams.append('org', 'tripodsan');
      url.searchParams.append('site', 'helix-test-content-html');
      url.searchParams.append('contentBusId', '9fec4a532ea34cd9cd4900e9a7955b502ad83b3cc4b5f123ea7711b5305');
      const res = await fetch(url, {
        headers: target.headers,
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual((await res.text()).trim(), TEST_MD.trim());
    }).timeout(50000);
  });
});
