export default function rehypeMermaid() {
  return function transform(node) {
    if (node.type === 'element' && node.tagName === 'pre') {
      const code = node.children[0];
      if (
        code?.tagName === 'code' &&
        code.properties.className?.includes('language-mermaid')
      ) {
        node.tagName = 'div';
        node.properties = { className: ['mermaid'], ariaBusy: 'true' };
        node.children = code.children;
      }
    }
    for (const child of node.children ?? []) transform(child);
  };
}
