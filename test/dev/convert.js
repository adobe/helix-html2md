/*
 * Copyright 2024 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
import { readFile } from 'fs/promises';
import { html2md } from '../../src/html2md.js';

async function run() {
  const input = await readFile(process.argv[2], 'utf-8');
  const md = await html2md(input, {
    log: console,
    url: process.argv[2],
  });
  process.stdout.write(md);
  process.stdout.write('\n');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
