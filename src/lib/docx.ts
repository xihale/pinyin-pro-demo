import { strToU8, zipSync } from 'fflate';

import { tokenizeLine, type Tone } from './sheet';

const FONT = 'Microsoft YaHei';
const RED = 'E1000F';
const INK = '111111';

export function buildRubyDocx(
  text: string,
  tone: Tone,
  hanziPt: number,
): Uint8Array<ArrayBuffer> {
  const pinyinPt = Math.max(8, Math.round(hanziPt * 0.42));

  const body = text
    .split('\n')
    .map((line) => {
      const runs = tokenizeLine(line, tone)
        .map((token) => {
          if (token.kind === 'hanzi') {
            return token.py
              ? rubyRun(token.ch, token.py, hanziPt, pinyinPt)
              : textRun(token.ch, hanziPt);
          }
          if (token.kind === 'latin') return textRun(token.text, hanziPt);
          if (token.kind === 'punct') return textRun(token.ch, hanziPt);
          return textRun(' ', hanziPt);
        })
        .join('');

      return `<w:p><w:pPr><w:spacing w:after="120"/></w:pPr>${runs}</w:p>`;
    })
    .join('');

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1418" w:bottom="1440" w:left="1418" w:header="851" w:footer="992" w:gutter="0"/></w:sectPr></w:body></w:document>`;

  const zip = zipSync({
    '[Content_Types].xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
    ),
    '_rels/.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    ),
    'word/document.xml': strToU8(documentXml),
  });
  return zip as Uint8Array<ArrayBuffer>;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function runPr(color: string, pt: number) {
  return `<w:rPr><w:rFonts w:ascii="${FONT}" w:eastAsia="${FONT}" w:hAnsi="${FONT}"/><w:color w:val="${color}"/><w:sz w:val="${pt * 2}"/><w:szCs w:val="${pt * 2}"/></w:rPr>`;
}

function textRun(value: string, pt: number) {
  return `<w:r>${runPr(INK, pt)}<w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r>`;
}

function rubyRun(ch: string, py: string, hanziPt: number, pyPt: number) {
  return `<w:r><w:ruby><w:rubyPr><w:rubyAlign w:val="center"/><w:hps w:val="${pyPt * 2}"/><w:hpsRaise w:val="${hanziPt * 2}"/><w:hpsBaseText w:val="${hanziPt * 2}"/><w:lid w:val="zh-CN"/></w:rubyPr><w:rt><w:r>${runPr(RED, pyPt)}<w:t>${escapeXml(py)}</w:t></w:r></w:rt><w:rubyBase><w:r>${runPr(INK, hanziPt)}<w:t>${escapeXml(ch)}</w:t></w:r></w:rubyBase></w:ruby></w:r>`;
}
