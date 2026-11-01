// Stateful fenced-code recognition shared by non-rendering Markdown checks.
export function fenceTracker() {
  let marker = null;
  return line => {
    let content = line.replace(/^(?: {0,3}>[ \t]?)+/, '');
    let indent = 0, list;
    while ((list = /^ {0,3}(?:[-+*]|\d{1,9}[.)])[ \t]+/.exec(content))) { indent += list[0].length; content = content.slice(list[0].length); }
    if (marker?.indent && !indent && content.startsWith(' '.repeat(marker.indent))) content = content.slice(marker.indent);
    const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(content);
    if (marker) {
      if (match && match[1][0] === marker.char && match[1].length >= marker.length && /^\s*$/.test(match[2])) marker = null;
      return true;
    }
    if (match && !(match[1][0] === '`' && match[2].includes('`'))) {
      marker = { char: match[1][0], length: match[1].length, indent };
      return true;
    }
    return false;
  };
}
