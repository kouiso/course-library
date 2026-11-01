// Stateful fenced-code recognition shared by non-rendering Markdown checks.
export function fenceTracker() {
  let marker = null;
  return function fenced(line) {
    let content = line.replace(/\r$/, ''), indent = 0, quotes = 0, container;
    if (marker) {
      for (let i = 0; i < marker.quotes; i++) {
        const quote = /^ {0,3}>[ \t]?/.exec(content);
        if (!quote) { marker = null; return fenced(line); }
        content = content.slice(quote[0].length);
      }
      if (marker.indent) {
        if (content.startsWith(' '.repeat(marker.indent))) content = content.slice(marker.indent);
        else if (content.trim()) { marker = null; return fenced(line); }
      }
    } else {
      while ((container = /^ {0,3}>[ \t]?/.exec(content))) { quotes++; content = content.slice(container[0].length); }
      while ((container = /^ {0,3}(?:[-+*]|\d{1,9}[.)])[ \t]+/.exec(content))) { indent += container[0].length; content = content.slice(container[0].length); }
    }
    const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(content);
    if (marker) {
      if (match && match[1][0] === marker.char && match[1].length >= marker.length && /^\s*$/.test(match[2])) marker = null;
      return true;
    }
    if (match && !(match[1][0] === '`' && match[2].includes('`'))) {
      marker = { char: match[1][0], length: match[1].length, indent, quotes };
      return true;
    }
    return false;
  };
}
