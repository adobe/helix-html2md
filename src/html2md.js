/*
 * Copyright 2022 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
import { unified } from 'unified';
import parse from 'rehype-parse';
import { toMdast } from 'hast-util-to-mdast';
import { toMarkdown } from 'mdast-util-to-markdown';
import { select } from 'hast-util-select';

export async function html2md(html, opts) {
  const { log, url } = opts;
  const t0 = Date.now();
  const hast = unified()
    .use(parse)
    .parse(html);

  const main = select('main', hast);
  if (!main) {
    log.info(`${url} contains no <main>`);
    return '';
  }

  const mdast = toMdast(main);
  const md = toMarkdown(mdast);
  const t1 = Date.now();
  log.info(`converted ${url} in ${t1 - t0}ms`);
  return md;
}
