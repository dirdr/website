import { visit } from 'unist-util-visit';

/** Turn unhighlighted Mermaid fences into source text for the browser renderer. */
export default function rehypeMermaid() {
  return (tree) => {
    visit(tree, 'element', (node) => {
      if (node.tagName !== 'pre') return;

      const code = node.children[0];
      if (
        code?.type !== 'element' ||
        code.tagName !== 'code' ||
        !code.properties.className?.includes('language-mermaid')
      ) {
        return;
      }

      node.properties.className = ['mermaid'];
      node.children = code.children;
    });
  };
}
