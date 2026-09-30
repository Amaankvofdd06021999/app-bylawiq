// A small, strict XML parser for BC Laws (CiviX) documents.
// It handles elements, attributes, text, comments, processing instructions, CDATA and the
// predefined and numeric entities. It does not handle DTDs. Anything malformed throws, so an
// import stops instead of producing wrong legal text.

export type XmlElement = { name: string; attrs: Record<string, string>; children: XmlNode[] };
export type XmlNode = XmlElement | string;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (whole, ref: string) => {
    if (ref.startsWith('#x')) return String.fromCodePoint(parseInt(ref.slice(2), 16));
    if (ref.startsWith('#')) return String.fromCodePoint(parseInt(ref.slice(1), 10));
    const v = ENTITIES[ref];
    if (v === undefined) throw new Error(`unknown XML entity ${whole}`);
    return v;
  });
}

export function parseXml(xml: string): XmlElement {
  let i = 0;
  const root: XmlElement = { name: '#root', attrs: {}, children: [] };
  const stack: XmlElement[] = [root];
  const top = () => stack[stack.length - 1];

  while (i < xml.length) {
    const lt = xml.indexOf('<', i);
    if (lt === -1) {
      pushText(xml.slice(i));
      break;
    }
    if (lt > i) pushText(xml.slice(i, lt));
    if (xml.startsWith('<!--', lt)) {
      i = mustFind('-->', lt) + 3;
    } else if (xml.startsWith('<?', lt)) {
      i = mustFind('?>', lt) + 2;
    } else if (xml.startsWith('<![CDATA[', lt)) {
      const end = mustFind(']]>', lt);
      top().children.push(xml.slice(lt + 9, end));
      i = end + 3;
    } else if (xml.startsWith('<!', lt)) {
      throw new Error(`unsupported markup declaration at offset ${lt}`);
    } else if (xml[lt + 1] === '/') {
      const gt = mustFind('>', lt);
      const name = xml.slice(lt + 2, gt).trim();
      const open = stack.pop();
      if (!open || open === root || open.name !== name) {
        throw new Error(`mismatched closing tag </${name}> at offset ${lt} (open: ${open?.name ?? 'none'})`);
      }
      i = gt + 1;
    } else {
      const gt = findTagEnd(lt);
      let raw = xml.slice(lt + 1, gt);
      const selfClosing = raw.endsWith('/');
      if (selfClosing) raw = raw.slice(0, -1);
      const m = /^([A-Za-z_][\w.:-]*)/.exec(raw);
      if (!m) throw new Error(`bad tag at offset ${lt}`);
      const el: XmlElement = { name: m[1], attrs: parseAttrs(raw.slice(m[1].length), lt), children: [] };
      top().children.push(el);
      if (!selfClosing) stack.push(el);
      i = gt + 1;
    }
  }
  if (stack.length !== 1) throw new Error(`unclosed element <${top().name}>`);
  const elements = root.children.filter((c): c is XmlElement => typeof c !== 'string');
  if (elements.length !== 1) throw new Error(`expected one root element, found ${elements.length}`);
  return elements[0];

  function pushText(t: string) {
    if (stack.length === 1) {
      if (t.trim()) throw new Error('text outside the root element');
      return;
    }
    top().children.push(decodeEntities(t));
  }
  function mustFind(token: string, from: number): number {
    const at = xml.indexOf(token, from);
    if (at === -1) throw new Error(`unterminated markup at offset ${from}`);
    return at;
  }
  function findTagEnd(from: number): number {
    let quote: string | null = null;
    for (let j = from + 1; j < xml.length; j++) {
      const c = xml[j];
      if (quote) {
        if (c === quote) quote = null;
      } else if (c === '"' || c === "'") quote = c;
      else if (c === '>') return j;
    }
    throw new Error(`unterminated tag at offset ${from}`);
  }
}

function parseAttrs(s: string, offset: number): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /\s*([A-Za-z_][\w.:-]*)\s*=\s*("([^"]*)"|'([^']*)')/y;
  let pos = 0;
  while (pos < s.length) {
    if (/^\s*$/.test(s.slice(pos))) break;
    re.lastIndex = pos;
    const m = re.exec(s);
    if (!m) throw new Error(`bad attribute near offset ${offset}: ${s.slice(pos, pos + 40)}`);
    attrs[m[1]] = decodeEntities(m[3] ?? m[4] ?? '');
    pos = re.lastIndex;
  }
  return attrs;
}

export const isElement = (n: XmlNode | undefined): n is XmlElement => typeof n === 'object' && n !== null;

export function elements(el: XmlElement, name?: string): XmlElement[] {
  return el.children.filter((c): c is XmlElement => isElement(c) && (name === undefined || c.name === name));
}

export function child(el: XmlElement, name: string): XmlElement | undefined {
  return elements(el, name)[0];
}

/** All text below el, in document order, with no whitespace changes. */
export function textContent(node: XmlNode): string {
  return typeof node === 'string' ? node : node.children.map(textContent).join('');
}
