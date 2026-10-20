import { pinyin } from 'pinyin-pro';

export type Tone = 'symbol' | 'num' | 'none';

export const SAMPLE = [
  '春晓',
  '孟浩然',
  '春眠不觉晓，',
  '处处闻啼鸟。',
  '夜来风雨声，',
  '花落知多少。',
].join('\n');

type Token =
  | { kind: 'hanzi'; ch: string; py: string }
  | { kind: 'punct'; ch: string }
  | { kind: 'latin'; text: string }
  | { kind: 'space' };

const LEADING_PUNCT = '（《「『【〔〈“‘([{';
const CLOSING_PUNCT = '，。！？；：、）》」』】〕〉”’…—～,.;:!?)]}»';

type CellCluster =
  | { kind: 'space' }
  | {
      kind: 'cell';
      main: Exclude<Token, { kind: 'space' }>;
      leads: string[];
      tails: string[];
    };

type Entry = {
  origin: string;
  pinyin: string;
  isZh: boolean;
};

export function tokenizeLine(line: string, tone: Tone): Token[] {
  if (!line) return [];

  let entries: Entry[];
  try {
    entries = pinyin(line, { type: 'all', toneType: tone });
  } catch {
    entries = Array.from(line).map((char) => ({
      origin: char,
      pinyin: '',
      isZh: false,
    }));
  }

  const tokens: Token[] = [];
  let latin = '';

  const flushLatin = () => {
    if (latin) {
      tokens.push({ kind: 'latin', text: latin });
      latin = '';
    }
  };

  for (const entry of entries) {
    const char = entry.origin;
    if (!char) continue;

    if (entry.isZh) {
      flushLatin();
      tokens.push({ kind: 'hanzi', ch: char, py: entry.pinyin });
    } else if (char === ' ' || char === '\t') {
      flushLatin();
      tokens.push({ kind: 'space' });
    } else if (/^\p{P}$/u.test(char)) {
      flushLatin();
      tokens.push({ kind: 'punct', ch: char });
    } else {
      latin += char;
    }
  }
  flushLatin();

  return tokens;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

function clusterTokens(tokens: Token[]): CellCluster[] {
  const clusters: CellCluster[] = [];
  let leads: string[] = [];

  const flushLeads = () => {
    for (const punct of leads) {
      clusters.push({
        kind: 'cell',
        main: { kind: 'punct', ch: punct },
        leads: [],
        tails: [],
      });
    }
    leads = [];
  };

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (!token) continue;

    if (token.kind === 'space') {
      flushLeads();
      clusters.push({ kind: 'space' });
      continue;
    }

    if (token.kind === 'punct') {
      if (LEADING_PUNCT.includes(token.ch)) {
        leads.push(token.ch);
        continue;
      }

      if (CLOSING_PUNCT.includes(token.ch)) {
        const last = clusters[clusters.length - 1];
        if (last?.kind === 'cell') {
          last.tails.push(token.ch);
          continue;
        }
      }

      clusters.push({
        kind: 'cell',
        main: token,
        leads: leads.splice(0),
        tails: [],
      });
      continue;
    }

    const cluster: CellCluster = {
      kind: 'cell',
      main: token,
      leads: leads.splice(0),
      tails: [],
    };
    clusters.push(cluster);

    while (i + 1 < tokens.length) {
      const next = tokens[i + 1];
      if (next?.kind === 'punct' && CLOSING_PUNCT.includes(next.ch)) {
        cluster.tails.push(next.ch);
        i += 1;
        continue;
      }
      break;
    }
  }

  flushLeads();
  return clusters;
}

function renderCluster(cluster: CellCluster) {
  if (cluster.kind === 'space') {
    return '<span class="space"> </span>';
  }

  const { main, leads, tails } = cluster;
  const leadHtml = leads
    .map((punct) => `<span class="lead">${escapeHtml(punct)}</span>`)
    .join('');
  const tailHtml = tails
    .map((punct) => `<span class="tail">${escapeHtml(punct)}</span>`)
    .join('');
  const character = escapeHtml(main.kind === 'latin' ? main.text : main.ch);
  const className = main.kind === 'latin' ? 'cell is-latin' : 'cell';

  if (main.kind !== 'hanzi') {
    return `<span class="${className}">${leadHtml}<span class="ch">${character}</span>${tailHtml}</span>`;
  }

  return `<span class="${className}">${leadHtml}<ruby class="ch">${character}<rt>${escapeHtml(main.py)}</rt></ruby>${tailHtml}</span>`;
}

export function renderSheetHtml(text: string, tone: Tone) {
  return text
    .split('\n')
    .map((line, index) => {
      const tokens = tokenizeLine(line, tone);
      const inner = tokens.length
        ? clusterTokens(tokens).map(renderCluster).join('')
        : '<br>';

      return `<div class="line${tokens.length ? '' : ' is-empty'}" style="--i:${index}">${inner}</div>`;
    })
    .join('');
}

export function countHanzi(text: string) {
  return (text.match(/\p{Script=Han}/gu) ?? []).length;
}

const HANZI_STACK =
  "'Helvetica Neue',Arial,'PingFang SC','Microsoft YaHei',sans-serif";
const LATIN_STACK = "'Helvetica Neue',Arial,sans-serif";
const RED = '#e1000f';
const INK = '#111111';

export function buildRubyHtml(text: string, tone: Tone, hanziPt: number) {
  const pinyinPt = Math.max(8, Math.round(hanziPt * 0.42));

  const paragraphs = text
    .split('\n')
    .map((line) => {
      const tokens = tokenizeLine(line, tone);

      const runs = tokens
        .map((token) => {
          if (token.kind === 'space') return ' ';
          if (token.kind === 'hanzi') {
            return `<ruby style="ruby-align:center;">${escapeHtml(token.ch)}<rt style="font-family:${LATIN_STACK};font-size:${pinyinPt}pt;line-height:1.15;color:${RED};">${escapeHtml(token.py)}</rt></ruby>`;
          }
          return token.kind === 'latin'
            ? escapeHtml(token.text)
            : escapeHtml(token.ch);
        })
        .join('');

      return `<p style="margin:0 0 6pt;font-family:${HANZI_STACK};font-size:${hanziPt}pt;line-height:1.8;color:${INK};">${runs || '&nbsp;'}</p>`;
    })
    .join('');

  return paragraphs;
}

export function buildUniversalHtml(text: string, tone: Tone, hanziPt: number) {
  const pinyinPt = Math.max(8, Math.round(hanziPt * 0.42));

  const paragraphs = text
    .split('\n')
    .map((line) => {
      const tokens = tokenizeLine(line, tone);

      if (!tokens.length) {
        return `<p style="margin:0;text-align:center;font-size:${hanziPt}pt;line-height:1.5;">&nbsp;</p>`;
      }

      const pinyin = annotateLine(tokens);
      const characters = plainLine(tokens);

      return `<p style="margin:0;text-align:center;font-family:${LATIN_STACK};font-size:${pinyinPt}pt;line-height:1.5;color:${RED};">${escapeHtml(pinyin)}</p><p style="margin:0 0 10pt;text-align:center;font-family:${HANZI_STACK};font-size:${hanziPt}pt;line-height:1.4;color:${INK};">${escapeHtml(characters)}</p>`;
    })
    .join('');

  return paragraphs;
}

function annotateLine(tokens: Token[]) {
  return tokens
    .map((token) => {
      if (token.kind === 'hanzi') return token.py;
      if (token.kind === 'space') return ' ';
      if (token.kind === 'punct') return token.ch;
      return token.text;
    })
    .join(' ')
    .replace(/\s+(\p{P})/gu, '$1')
    .replace(/(\p{P})\s+(?=\p{Script=Han})/gu, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function plainLine(tokens: Token[]) {
  return tokens
    .map((token) => {
      if (token.kind === 'hanzi') return token.ch;
      if (token.kind === 'space') return ' ';
      if (token.kind === 'punct') return token.ch;
      return token.text;
    })
    .join('')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function buildPlainText(text: string, tone: Tone) {
  return text
    .split('\n')
    .map((line) => {
      const tokens = tokenizeLine(line, tone);
      if (!tokens.length) return '';
      return `${annotateLine(tokens)}\n${plainLine(tokens)}`;
    })
    .join('\n\n');
}
