/*
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
import { defineConfig, globalIgnores } from '@eslint/config-helpers'
import { recommended, source, test } from '@adobe/eslint-config-helix';

export default defineConfig([
  globalIgnores([
    '.vscode/*',
    'coverage/*',
    'dist/*',
  ]),
  {
    rules: {
      'import/extensions': ['error', 'ignorePackages'],
      'import/prefer-default-export': 0,
      // see https://github.com/import-js/eslint-plugin-import/issues/1868
      'import/no-unresolved': ['error', { ignore: ['@adobe/helix-markdown-support/matter'] }]
    },
    plugins: {
      import: recommended.plugins.import,
    },
    extends: [recommended],
  },
  {
    ...source,
    files: [...source.files, 'secrets/**.js'],
  },
  {
    ...test,
    files: [...test.files, 'test/**.cjs'],
  }
]);
