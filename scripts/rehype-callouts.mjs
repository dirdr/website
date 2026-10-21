const icons = {
  note: ['M12 16v-4', 'M12 8h.01', 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0'],
  tip: ['M9 18h6M10 22h4', 'M9 15a6 6 0 1 1 6 0c-1 1-1 2-1 3h-4c0-1 0-2-1-3'],
  important: ['M12 8v4M12 16h.01', 'M12 2 2 12l10 10 10-10Z'],
  warning: ['M12 9v4M12 17h.01', 'M12 3 1 21h22Z'],
  caution: ['M12 8v4M12 16h.01', 'M8 2h8l6 6v8l-6 6H8l-6-6V8Z'],
};

export default function rehypeCallouts() {
  return function transform(node) {
    if (node.type === 'element' && node.tagName === 'blockquote') {
      const paragraph = node.children.find((child) => child.type === 'element');
      const first = paragraph?.children?.[0];
      const match =
        paragraph?.tagName === 'p' &&
        first?.type === 'text' &&
        first.value.match(
          /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(?:\r?\n|$)/i,
        );

      if (match) {
        const type = match[1].toLowerCase();
        first.value = first.value.slice(match[0].length);
        if (!first.value) {
          paragraph.children.shift();
          if (paragraph.children[0]?.tagName === 'br')
            paragraph.children.shift();
        }
        if (!paragraph.children.length)
          node.children.splice(node.children.indexOf(paragraph), 1);

        node.tagName = 'div';
        node.properties = {
          ...node.properties,
          className: ['markdown-alert', `markdown-alert-${type}`],
        };
        node.children.unshift({
          type: 'element',
          tagName: 'p',
          properties: { className: ['markdown-alert-title'] },
          children: [
            {
              type: 'element',
              tagName: 'svg',
              properties: {
                viewBox: '0 0 24 24',
                width: 18,
                height: 18,
                fill: 'none',
                stroke: 'currentColor',
                strokeWidth: 1.75,
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
                ariaHidden: 'true',
              },
              children: icons[type].map((d) => ({
                type: 'element',
                tagName: 'path',
                properties: { d },
                children: [],
              })),
            },
            { type: 'text', value: type[0].toUpperCase() + type.slice(1) },
          ],
        });
      }
    }
    for (const child of node.children ?? []) transform(child);
  };
}
