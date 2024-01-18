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
import {
  PipelineRequest, PipelineResponse, PipelineState, htmlPipe,
} from '@adobe/helix-html-pipeline';

export const render = async (url, source) => {
  const req = new PipelineRequest(url, {
    headers: new Map([['host', url.hostname]]),
    body: '',
  });

  const s3Loader = {
    async getObject(_bucketId, key) {
      if (key.endsWith('.md')) {
        return new PipelineResponse(source);
      }
      if (key === 'adobe/helix-pages/super-test/helix-config.json') {
        return new PipelineResponse('{}');
      }
      return new PipelineResponse('', { status: 404 });
    },

    // eslint-disable-next-line no-unused-vars
    async headObject(_bucketId, _key) {
      return new PipelineResponse('', { status: 404 });
    },
  };

  const log = null;

  const state = new PipelineState({
    log,
    s3Loader,
    ref: 'super-test',
    site: 'site',
    org: 'org',
    partition: 'live',
    path: url.pathname,
    timer: {
      update: () => {},
    },
    config: {
      owner: 'adobe',
      repo: 'helix-pages',
      contentBusId: 'foo-id',
    },
  });
  state.contentBusId = 'foo-id';

  return htmlPipe(state, req);
};
