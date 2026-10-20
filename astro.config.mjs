import { unified } from '@astrojs/markdown-remark';
import mdx from '@astrojs/mdx';
import { defineConfig } from 'astro/config';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import rehypeMermaid from './scripts/rehype-mermaid.mjs';

export default defineConfig({
  output: 'static',
  redirects: {
    '/blog/': '/writing/',
    '/blog/[...id]': '/writing/[...id]',
  },
  prefetch: true,
  integrations: [mdx()],
  vite: {
    worker: { format: 'es' },
    optimizeDeps: { include: ['mermaid'] },
  },
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeKatex, rehypeMermaid],
    }),
    syntaxHighlight: { type: 'shiki', excludeLangs: ['mermaid'] },
    shikiConfig: {
      themes: { light: 'gruvbox-light-medium', dark: 'gruvbox-dark-medium' },
      transformers: [
        {
          name: 'code-language-label',
          pre(node) {
            const language = this.options.lang || 'text';
            node.properties['data-language'] = language;
            node.properties['aria-label'] = `${language} code`;
            node.properties.tabIndex = 0;
          },
        },
      ],
    },
  },
});
