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
import { helixStatus } from '@adobe/helix-status';
import bodyData from '@adobe/helix-shared-body-data';
import {
  Response,
  h1NoCache,
  timeoutSignal,
  AbortError,
} from '@adobe/fetch';
import { cleanupHeaderValue } from '@adobe/helix-shared-utils';
import { MediaHandler } from '@adobe/helix-mediahandler';
import { fetchFstab, getContentBusId } from '@adobe/helix-admin-support';
import pkgJson from './package.cjs';
import { html2md } from './html2md.js';
import { TooManyImagesError } from './mdast-process-images.js';

/* c8 ignore next 7 */
export const { fetch } = h1NoCache();

/**
 * Generates an error response
 * @param {string} message - error message
 * @param {number} status - error code.
 * @returns {Response} A response object.
 */
export function error(message, status = 500, severity = null) {
  const headers = {
    'Cache-Control': 'no-store, private, must-revalidate',
    'x-error': cleanupHeaderValue(message),
  };
  if (severity) {
    headers['x-severity'] = severity;
  }
  return new Response('', { status, headers });
}

/**
 * Creates a filter function to test if a given URL matches a set of img-src policies.
 *
 * @param {String} baseUrlStr
 * @param {String[]} imgSrcPolicy
 * @returns {(url: URL) => true|false}
 */
export function createImgSrcPolicy(baseUrlStr, imgSrcPolicy) {
  const baseUrl = new URL(baseUrlStr);
  const imgSrcPolicFilters = imgSrcPolicy.map((policyValue) => {
    // filter according to https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/Sources
    if (policyValue === '*') {
      return () => true;
    }

    if (policyValue === 'self') {
      return (url) => baseUrl.host === url.host;
    }

    return (url) => {
      // omit the protocol check, as https:// is enforced earlier already
      // omit the pathname check, as we may not need it (yet)
      const protocolEndIdx = policyValue.indexOf('://');
      let host = protocolEndIdx < 0 ? policyValue : policyValue.substring(protocolEndIdx + 3);
      const slashIdx = host.indexOf('/');
      if (slashIdx >= 0) {
        host = host.substring(0, slashIdx);
      }

      if (host.startsWith('*')) {
        // allow subdomain
        const dotIdx = url.host.indexOf('.');
        return dotIdx > 0 && url.host.substring(dotIdx) === host.substring(1);
      } else {
        return url.host === host;
      }
    };
  });

  return (url) => imgSrcPolicFilters.some((f) => f(url));
}

/**
 * This is the main function
 * @param {Request} request the request object (see fetch api)
 * @param {UniversalContext} ctx the context of the universal serverless function
 * @returns {Response} a response
 */
async function run(request, ctx) {
  const { log } = ctx;
  const { owner, repo, path } = ctx.data;
  ctx.attributes = {};

  // resolve url via fstab
  if (!path || !owner || !repo) {
    return error('path, owner and repo parameters are required.', 400);
  }

  const fstab = await fetchFstab(ctx, ctx.data);
  const mp = fstab.match(path);
  let { relPath } = mp;
  if (relPath.endsWith('/index.md')) {
    relPath = relPath.substring(0, relPath.length - 8);
  } else if (relPath.endsWith('.md')) {
    relPath = relPath.substring(0, relPath.length - 3);
  }
  const mpUrl = new URL(mp.url);
  const mpPathname = mpUrl.pathname.endsWith('/')
    ? mpUrl.pathname.substring(0, mpUrl.pathname.length - 1)
    : mpUrl.pathname;
  const url = new URL(mpPathname + relPath, mp.url).href;
  const contentBusId = await getContentBusId(ctx, ctx.data);

  const reqHeaders = {};
  const auth = request.headers.get('authorization');
  if (auth) {
    reqHeaders.authorization = auth;
  }

  const sourceLocation = request.headers.get('x-content-source-location');
  if (sourceLocation) {
    reqHeaders['x-content-source-location'] = sourceLocation;
  }

  let html;
  let res;
  // limit response time of content provider to 10s
  const signal = timeoutSignal(ctx.env?.HTML_FETCH_TIMEOUT || 10_000);
  try {
    res = await fetch(url, {
      headers: reqHeaders,
      signal,
    });
    html = await res.text();
    if (!res.ok) {
      const { status } = res;
      if (status >= 400 && status < 500) {
        switch (status) {
          case 401:
          case 403:
          case 404:
            return error(`resource not found: ${url}`, status);
          default:
            return error(`error fetching resource at ${url}`, status);
        }
      } else {
        // propagate other errors as 502
        return error(`error fetching resource at ${url}: ${status}`, 502);
      }
    }
    // limit response size of content provider to 1mb
    if (html.length > 1024 * 1024) {
      return error(`error fetching resource at ${url}: html source larger than 1mb`, 409);
    }
  } catch (e) {
    if (e instanceof AbortError) {
      return error(`error fetching resource at ${url}: timeout after 10s`, 504, 'warn');
    }
    return error(`error fetching resource at ${url}: ${e.message}`, 502);
  } finally {
    signal.clear();
  }

  // only use media handler when loaded via fstab. otherwise images are not processed.
  let mediaHandler;
  if (contentBusId) {
    const imgSrc = res.headers.get('x-html2md-img-src')?.split(/\s+/) || [];
    if (imgSrc.indexOf('self') < 0) {
      imgSrc.push('self');
    }
    const imgSrcPolicy = createImgSrcPolicy(url, imgSrc);
    const {
      MEDIAHANDLER_NOCACHHE: noCache,
      CLOUDFLARE_ACCOUNT_ID: r2AccountId,
      CLOUDFLARE_R2_ACCESS_KEY_ID: r2AccessKeyId,
      CLOUDFLARE_R2_SECRET_ACCESS_KEY: r2SecretAccessKey,
    } = ctx.env;
    mediaHandler = new MediaHandler({
      r2AccountId,
      r2AccessKeyId,
      r2SecretAccessKey,
      owner,
      repo,
      ref: 'main',
      contentBusId,
      log,
      auth: (src) => (imgSrcPolicy(src) ? auth : undefined),
      filter: /* c8 ignore next */ (blob) => ((blob.contentType || '').startsWith('image/')),
      blobAgent: `html2md-${pkgJson.version}`,
      noCache,
      fetchTimeout: 5000, // limit image fetches to 5s
      forceHttp1: true,
    });
  }

  try {
    const md = await html2md(html, {
      mediaHandler,
      log,
      url,
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
  } catch (e) {
    if (e instanceof TooManyImagesError) {
      return error(`error fetching resource at ${url}: ${e.message}`, 409);
    }
    /* c8 ignore next 2 */
    return error(`error fetching resource at ${url}: ${e.message}`, 500);
  } finally {
    await mediaHandler?.fetchContext.reset();
  }
}

export const main = wrap(run)
  .with(bodyData)
  .with(helixStatus);
