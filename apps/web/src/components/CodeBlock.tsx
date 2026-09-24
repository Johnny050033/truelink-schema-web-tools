import { memo, type ReactNode } from 'react';

const TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}[\],])/g;

/** Tokenizes JSON into React text nodes; nothing is ever injected as HTML. */
export function highlightJson(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    if (index > last) nodes.push(text.slice(last, index));
    const [whole, string, colon, literal, number] = match;
    if (string !== undefined) {
      nodes.push(
        <span key={key++} className={colon ? 'tok-key' : 'tok-string'}>
          {string}
        </span>,
      );
      if (colon) nodes.push(<span key={key++} className="tok-punct">{colon}</span>);
    } else if (literal !== undefined) nodes.push(<span key={key++} className="tok-literal">{literal}</span>);
    else if (number !== undefined) nodes.push(<span key={key++} className="tok-number">{number}</span>);
    else nodes.push(<span key={key++} className="tok-punct">{whole}</span>);
    last = index + whole.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export const CodeBlock = memo(function CodeBlock({ json, wrapScript, label }: { json: string; wrapScript?: boolean; label: string }) {
  return (
    <pre className="code-block" tabIndex={0} aria-label={label}>
      <code>
        {wrapScript ? (
          <>
            <span className="tok-tag">{'<script type="application/ld+json">'}</span>
            {'\n'}
          </>
        ) : null}
        {highlightJson(json)}
        {wrapScript ? (
          <>
            {'\n'}
            <span className="tok-tag">{'</script>'}</span>
          </>
        ) : null}
      </code>
    </pre>
  );
});
