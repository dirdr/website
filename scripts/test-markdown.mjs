import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import rehypeCallouts from './rehype-callouts.mjs';

const processor = await createMarkdownProcessor({
  syntaxHighlight: false,
  rehypePlugins: [rehypeCallouts],
});

test('all five callouts render with a label, icon, and formatted content', async () => {
  for (const type of ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION']) {
    const { code } = await processor.render(
      `> [!${type}]\n> Read **this** [report](/projects/).\n>\n> - First item\n> - Second item`,
    );
    assert.match(code, new RegExp(`markdown-alert-${type.toLowerCase()}`));
    assert.match(code, /<svg[^>]*aria-hidden="true"/);
    assert.match(code, /<strong>this<\/strong>/);
    assert.match(code, /<a href="\/projects\/">report<\/a>/);
    assert.match(code, /<li>Second item<\/li>/);
    assert.doesNotMatch(code, /\[!/);
  }
});

test('ordinary quotes, unknown markers, inline markers, and code stay unchanged', async () => {
  for (const content of [
    '> An ordinary quote.',
    '> [!UNKNOWN]\n> Text.',
    '> [!NOTE] This marker is not on its own line.',
    '`[!NOTE]`',
    '```markdown\n> [!NOTE]\n> Example\n```',
  ]) {
    const { code } = await processor.render(content);
    assert.doesNotMatch(code, /class="markdown-alert/);
  }
});

test('callouts support separate paragraphs, hard breaks, and lowercase markers', async () => {
  for (const separator of ['\n>\n', '  \n', '\n']) {
    const { code } = await processor.render(`> [!note]${separator}> Content.`);
    assert.match(code, /markdown-alert-note/);
    assert.match(code, /<p>\s*Content\.<\/p>/);
    assert.doesNotMatch(code, /<p>\s*<\/p>|<br>/);
  }
});
