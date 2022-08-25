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
import wrap from '@adobe/helix-shared-wrap';
import { logger } from '@adobe/helix-universal-logger';
import { wrap as status } from '@adobe/helix-status';
import bodyData from '@adobe/helix-shared-body-data';
import { Response, context as fetchContext, h1 } from '@adobe/helix-fetch';
import { cleanupHeaderValue } from '@adobe/helix-shared-utils';
import { MediaHandler } from '@adobe/helix-mediahandler';
import { fetchFstab, getContentBusId } from '@adobe/helix-admin-support';
import pkgJson from './package.cjs';
import { html2md } from './html2md.js';

/* c8 ignore next 7 */
export const { fetch } = process.env.HELIX_FETCH_FORCE_HTTP1
  ? h1()
  : fetchContext();

/**
 * Generates an error response
 * @param {string} message - error message
 * @param {number} statusCode - error code.
 * @returns {Response} A response object.
 */
export function error(message, statusCode = 500) {
  return new Response('', {
    status: statusCode,
    headers: {
      'Cache-Control': 'no-store, private, must-revalidate',
      'x-error': cleanupHeaderValue(message),
    },
  });
}

/**
 * This is the main function
 * @param {Request} request the request object (see fetch api)
 * @param {UniversalContext} ctx the context of the universal serverless function
 * @returns {Response} a response
 */
async function run(request, ctx) {
  const { log } = ctx;
  const {
    owner, repo,
    gridTables,
    path,
  } = ctx.data;
  let { url, contentBusId } = ctx.data;
  ctx.attributes = {};

  if (path) {
    // resolve url via fstab
    if (!owner || !repo) {
      return error('owner and repo parameters are required in path-mode.', 400);
    }

    const fstab = await fetchFstab(ctx, ctx.data);
    const mp = fstab.match(path);
    url = new URL(mp.relPath, mp.url).href;
    contentBusId = await getContentBusId(ctx, ctx.data);
  } else if (!url) {
    return error('url or path parameter is required.', 400);
  }

  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404 || res.status === 403 || res.status === 401) {
      // only propagate 404, 401 and 403
      return error(`resource not found: ${url}`, res.status);
    } else {
      return error(`error fetching resource at ${url}: ${res.status}`, 502);
    }
  }
  const html = await res.text();

  // only use media handler when loaded via fstab. otherwise images are not processed.
  let mediaHandler;
  if (contentBusId) {
    mediaHandler = new MediaHandler({
      owner,
      repo,
      ref: 'main',
      contentBusId,
      log,
      filter: /* c8 ignore next */ (blob) => ((blob.contentType || '').startsWith('image/')),
      blobAgent: `html2md-${pkgJson.version}`,
    });
  }

  const md = await html2md(html, {
    mediaHandler,
    log,
    url,
    gridTables,
  });

  const headers = {
    'content-type': 'text/markdown; charset=utf-8',
    'content-length': md.length,
    'cache-control': 'no-store, private, must-revalidate',
    'x-source-location': cleanupHeaderValue(url),
  };

  const lastMod = res.headers.get('last-modified');
  if (lastMod) {
    headers['last-modified'] = lastMod;
  }

  return new Response(md, {
    status: 200,
    headers,
  });
}

export const main = wrap(run)
  .with(bodyData)
  .with(status)
  .with(logger);
