import {
  SAMPLE,
  buildPlainText,
  buildRubyHtml,
  buildUniversalHtml,
  countHanzi,
  renderSheetHtml,
  type Tone,
} from '../lib/sheet';

type Size = 's' | 'm' | 'l';

const HANZI_PX: Record<Size, number> = { s: 38, m: 48, l: 60 };
const HANZI_PT: Record<Size, number> = { s: 14, m: 17, l: 21 };

const sheet = document.getElementById('sheet') as HTMLDivElement | null;
const count = document.getElementById('count');
const status = document.getElementById('status');
const copyButton = document.getElementById('copy') as HTMLButtonElement | null;
const wordButton = document.getElementById('copy-word') as HTMLButtonElement | null;

if (sheet && count && status && copyButton && wordButton) {
  const state = {
    text: SAMPLE,
    tone: 'symbol' as Tone,
    size: 'm' as Size,
  };

  const lineElements = () =>
    Array.from(sheet.children).filter((child): child is HTMLElement =>
      child.classList.contains('line'),
    );

  const lineText = (line: HTMLElement) => {
    const probe = document.createElement('div');
    probe.appendChild(line.cloneNode(true));
    probe.querySelectorAll('rt').forEach((node) => node.remove());
    return (probe.textContent ?? '').replace(/\u00a0/g, ' ');
  };

  const readLines = () => {
    const lines = lineElements().map(lineText);
    return lines.length ? lines : [''];
  };


  state.text = readLines().join('\n') || SAMPLE;

  const announce = (message: string) => {
    status.textContent = '';
    window.setTimeout(() => {
      status.textContent = message;
    }, 20);
  };

  const updateChrome = () => {
    count.textContent = `${countHanzi(state.text)} 字`;
    copyButton.disabled = !state.text.trim();
    wordButton.disabled = !state.text.trim();
  };

  const render = () => {
    sheet.innerHTML = renderSheetHtml(state.text, state.tone);
    sheet.dataset.empty = state.text.length ? 'false' : 'true';
    updateChrome();
  };

  const offsetAt = (container: Node, offset: number, lines: string[]) => {
    if (!sheet.contains(container)) return state.text.length;

    const range = document.createRange();
    range.selectNodeContents(sheet);

    try {
      range.setEnd(container, offset);
    } catch {
      return state.text.length;
    }

    const holder = document.createElement('div');
    holder.appendChild(range.cloneContents());
    holder.querySelectorAll('rt').forEach((node) => node.remove());

    const parts = Array.from(holder.querySelectorAll('.line')).map((line) =>
      (line.textContent ?? '').replace(/\u00a0/g, ' '),
    );

    if (!parts.length) return 0;

    const column = parts.join('\n').length;
    return Math.min(column, lines.join('\n').length);
  };

  const caretOffset = (lines: string[]) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return state.text.length;
    const range = selection.getRangeAt(0);
    return offsetAt(range.startContainer, range.startOffset, lines);
  };

  // 只把光标放进文字节点：元素位置（例如 <span class="cell"> 的第 1 个位置）
  // 在 ruby 里会被浏览器画到拼音那一行，看着就像光标跑进了拼音。
  const pointAt = (line: HTMLElement, column: number) => {
    const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) =>
        node.parentElement?.closest('rt')
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT,
    });

    let seen = 0;
    let last: Text | null = null;

    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      last = node;
      if (seen + node.data.length >= column) {
        return { node, offset: Math.max(0, Math.min(column - seen, node.data.length)) };
      }
      seen += node.data.length;
    }

    if (last) return { node: last, offset: last.data.length };
    return { node: line, offset: 0 };
  };

  const placeCaret = (line: HTMLElement, column: number) => {
    const selection = window.getSelection();
    if (!selection) return;

    const point = pointAt(line, column);
    const range = document.createRange();
    range.setStart(point.node, point.offset);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const locate = (offset: number) => {
    const lines = lineElements();
    let remaining = Math.max(0, Math.min(offset, state.text.length));

    for (const line of lines) {
      const length = lineText(line).length;
      if (remaining <= length) return { line, column: remaining };
      remaining -= length + 1;
    }

    const last = lines[lines.length - 1];
    return last ? { line: last, column: lineText(last).length } : null;
  };

  const lineStart = (target: HTMLElement) => {
    let offset = 0;
    for (const line of lineElements()) {
      if (line === target) return offset;
      offset += lineText(line).length + 1;
    }
    return offset;
  };

  const setCaret = (offset: number) => {
    const target = locate(offset);
    if (target) placeCaret(target.line, target.column);
  };

  const setSelection = (anchor: number, focus: number) => {
    const selection = window.getSelection();
    const a = locate(anchor);
    const f = locate(focus);
    if (!selection || !a || !f) return;

    const pa = pointAt(a.line, a.column);
    const pf = pointAt(f.line, f.column);

    selection.collapse(pa.node, pa.offset);
    selection.extend(pf.node, pf.offset);
  };

  const selectionOffsets = () => {
    const lines = readLines();
    const selection = window.getSelection();
    if (!selection) return { anchor: state.text.length, focus: state.text.length };

    const anchor = selection.anchorNode
      ? offsetAt(selection.anchorNode, selection.anchorOffset, lines)
      : state.text.length;
    const focus = selection.focusNode
      ? offsetAt(selection.focusNode, selection.focusOffset, lines)
      : anchor;

    return { anchor, focus };
  };

  const clampOffset = (offset: number) =>
    Math.max(0, Math.min(offset, state.text.length));

  const lineStep = (offset: number, dir: number) => {
    const lines = readLines();
    let acc = 0;
    let line = lines.length - 1;
    let column = (lines[line] ?? '').length;

    for (let i = 0; i < lines.length; i += 1) {
      const text = lines[i] ?? '';
      if (offset <= acc + text.length || i === lines.length - 1) {
        line = i;
        column = offset - acc;
        break;
      }
      acc += text.length + 1;
    }

    column = Math.max(0, Math.min(column, (lines[line] ?? '').length));

    const target = Math.min(Math.max(line + dir, 0), lines.length - 1);
    let start = 0;
    for (let i = 0; i < target; i += 1) {
      start += (lines[i] ?? '').length + 1;
    }

    return start + Math.min(column, (lines[target] ?? '').length);
  };

  const charClass = (ch: string) => {
    if (ch === '\n' || /\s/.test(ch)) return 'space';
    if (/\p{Script=Han}/u.test(ch)) return 'han';
    if (/[A-Za-z0-9'’-]/.test(ch)) return 'latin';
    return 'punct';
  };

  const wordStep = (offset: number, dir: number) => {
    const text = state.text;
    let index = clampOffset(offset);

    if (dir === 1) {
      if (index >= text.length) return text.length;
      if (charClass(text[index] ?? '') === 'space') {
        while (index < text.length && charClass(text[index] ?? '') === 'space') {
          index += 1;
        }
      }
      const kind = charClass(text[index] ?? '');
      while (index < text.length && charClass(text[index] ?? '') === kind) {
        index += 1;
      }
      return index;
    }

    if (index <= 0) return 0;
    if (charClass(text[index - 1] ?? '') === 'space') {
      while (index > 0 && charClass(text[index - 1] ?? '') === 'space') {
        index -= 1;
      }
    }
    const kind = charClass(text[index - 1] ?? '');
    while (index > 0 && charClass(text[index - 1] ?? '') === kind) {
      index -= 1;
    }
    return index;
  };

  const history: { text: string; caret: number }[] = [
    { text: state.text, caret: 0 },
  ];
  let historyIndex = 0;
  let lastPush = 0;
  let coalescing = false;

  const push = (text: string, caret: number, coalesce: boolean) => {
    const now = performance.now();
    const previous = history[historyIndex];
    const extendsTyping =
      coalesce &&
      coalescing &&
      previous !== undefined &&
      now - lastPush < 700 &&
      text.length === previous.text.length + 1 &&
      caret === previous.caret + 1 &&
      text.slice(0, previous.caret) ===
        previous.text.slice(0, previous.caret) &&
      text.slice(previous.caret + 1) === previous.text.slice(previous.caret);

    if (extendsTyping) {
      history[historyIndex] = { text, caret };
    } else {
      history.splice(historyIndex + 1);
      history.push({ text, caret });
      if (history.length > 200) history.shift();
      historyIndex = history.length - 1;
    }

    lastPush = now;
    coalescing = coalesce;
  };

  let composing = false;
  let justComposed = false;

  const commit = (typing: boolean) => {
    const lines = readLines();
    const caret = caretOffset(lines);
    const next = lines.join('\n');

    state.text = next;
    push(next, caret, typing);
    render();
    setCaret(Math.min(caret, next.length));
  };

  const applySnapshot = () => {
    const snapshot = history[historyIndex];
    if (!snapshot) return;

    state.text = snapshot.text;
    render();
    sheet.focus();
    setCaret(snapshot.caret);
    coalescing = false;
  };

  const undo = () => {
    if (historyIndex === 0) return;
    historyIndex -= 1;
    applySnapshot();
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    historyIndex += 1;
    applySnapshot();
  };

  const selectionBounds = () => {
    const { anchor, focus } = selectionOffsets();
    return { start: Math.min(anchor, focus), end: Math.max(anchor, focus) };
  };

  // 模型优先：插入与删除都由 state.text 计算，浏览器不直接改 DOM。
  // 否则跨 ruby 的替换会把 <rt> 里的拼音一并搬进正文（“zshā”那种）。
  const insertText = (value: string) => {
    const { start, end } = selectionBounds();
    const next = `${state.text.slice(0, start)}${value}${state.text.slice(end)}`;
    const target = start + value.length;

    state.text = next;
    push(next, target, value.length === 1 && !value.includes('\n'));
    render();
    setCaret(target);
  };

  const deleteText = (inputType: string) => {
    const { start, end } = selectionBounds();
    let from = start;
    let to = end;

    if (from === to) {
      const byWord = /Word|Line/.test(inputType);
      if (/Backward/.test(inputType)) {
        from = byWord ? wordStep(from, -1) : Math.max(0, from - 1);
        to = start;
      } else {
        to = byWord ? wordStep(to, 1) : Math.min(state.text.length, to + 1);
      }
    }

    if (from === to) return;

    const next = `${state.text.slice(0, from)}${state.text.slice(to)}`;
    state.text = next;
    push(next, from, to - from === 1);
    render();
    setCaret(from);
  };

  sheet.addEventListener('input', () => {
    if (composing) return;
    if (justComposed) {
      justComposed = false;
      return;
    }
    commit(true);
  });

  sheet.addEventListener('compositionstart', () => {
    const node = document.getSelection()?.anchorNode ?? null;
    const element =
      node?.nodeType === Node.ELEMENT_NODE
        ? (node as HTMLElement)
        : node?.parentElement;

    if (element?.closest('rt')) {
      setCaret(Math.min(caretOffset(readLines()), state.text.length));
    }

    composing = true;
  });

  sheet.addEventListener('compositionend', () => {
    composing = false;
    commit(false);
    justComposed = true;
    window.setTimeout(() => {
      justComposed = false;
    }, 0);
  });

  // 浏览器会把光标放到元素位置（如 .cell 的第 1 个位置）或 <rt> 里；这两种
  // 位置在 ruby 上都会被画到拼音那一行。只要出现，就换算成模型偏移再落回文字
  // 节点。方向键已在 keydown 里接管，这里兜住点击、辅助技术和程序化选区。
  let redirecting = false;
  let skippedNode: Node | null = null;
  let skippedOffset = -1;

  const normalizeCaret = () => {
    if (composing || redirecting) return;

    const selection = document.getSelection();
    if (!selection || !selection.isCollapsed || selection.rangeCount === 0) return;

    const node = selection.anchorNode;
    if (!node || !sheet.contains(node)) return;

    const element =
      node.nodeType === Node.ELEMENT_NODE
        ? (node as HTMLElement)
        : node.parentElement;

    const inPinyin = Boolean(element?.closest('rt'));
    const atElement = node.nodeType === Node.ELEMENT_NODE;
    if (!inPinyin && !atElement) return;

    if (node === skippedNode && selection.anchorOffset === skippedOffset) return;

    const offset = offsetAt(node, selection.anchorOffset, readLines());
    redirecting = true;
    try {
      setCaret(offset);
    } finally {
      redirecting = false;
    }

    const after = document.getSelection()?.anchorNode;
    if (after && after.nodeType === Node.ELEMENT_NODE) {
      skippedNode = after;
      skippedOffset = document.getSelection()?.anchorOffset ?? -1;
    }
  };

  document.addEventListener('selectionchange', normalizeCaret);

  const navigate = (event: KeyboardEvent) => {
    const { anchor, focus } = selectionOffsets();
    const extend = event.shiftKey;
    const word = event.metaKey || event.ctrlKey || event.altKey;
    const collapsed = anchor === focus;

    let target = focus;

    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const dir = event.key === 'ArrowLeft' ? -1 : 1;
      if (!extend && !collapsed) {
        target = dir < 0 ? Math.min(anchor, focus) : Math.max(anchor, focus);
      } else {
        target = word ? wordStep(focus, dir) : clampOffset(focus + dir);
      }
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      const dir = event.key === 'ArrowUp' ? -1 : 1;
      if (!extend && !collapsed) {
        target = dir < 0 ? Math.min(anchor, focus) : Math.max(anchor, focus);
      } else {
        target = lineStep(focus, dir);
      }
    } else {
      const at = locate(focus);
      const start = at ? lineStart(at.line) : 0;
      const wholeDoc = event.metaKey || event.ctrlKey;
      if (wholeDoc) {
        target = event.key === 'End' ? state.text.length : 0;
      } else {
        target = event.key === 'End' ? start + (at ? lineText(at.line).length : 0) : start;
      }
    }

    if (extend) setSelection(anchor, target);
    else setCaret(target);
  };

  sheet.addEventListener('keydown', (event) => {
    if (event.isComposing) return;

    const key = event.key.toLowerCase();

    if ((event.metaKey || event.ctrlKey) && key === 'z') {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
      return;
    }

    if ((event.metaKey || event.ctrlKey) && key === 'y') {
      event.preventDefault();
      redo();
      return;
    }

    if (
      event.key === 'ArrowLeft' ||
      event.key === 'ArrowRight' ||
      event.key === 'ArrowUp' ||
      event.key === 'ArrowDown' ||
      event.key === 'Home' ||
      event.key === 'End'
    ) {
      event.preventDefault();
      navigate(event);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      insertText('\n');
      return;
    }

    if (event.key === 'Escape') {
      sheet.blur();
    }
  });

  sheet.addEventListener('beforeinput', (event) => {
    if (event.isComposing) return;

    if (
      event.inputType === 'insertParagraph' ||
      event.inputType === 'insertLineBreak'
    ) {
      event.preventDefault();
      insertText('\n');
      return;
    }

    if (event.inputType === 'insertText') {
      event.preventDefault();
      if (event.data) insertText(event.data);
      return;
    }

    if (event.inputType.startsWith('delete')) {
      // 剪切交给浏览器（还能带走系统剪贴板），其余删除由模型完成。
      if (event.inputType === 'deleteByCut') return;
      event.preventDefault();
      deleteText(event.inputType);
    }
  });

  sheet.addEventListener('paste', (event) => {
    event.preventDefault();
    const text = (event.clipboardData?.getData('text/plain') ?? '').replace(
      /\r\n?/g,
      '\n',
    );
    if (text) insertText(text);
  });

  sheet.addEventListener('drop', (event) => {
    event.preventDefault();
    const text = (event.dataTransfer?.getData('text/plain') ?? '').replace(
      /\r\n?/g,
      '\n',
    );
    if (text) insertText(text);
  });

  let pendingCopy: { html: string; plain: string } | null = null;

  const clipToSheet = (range: Range, sheetRange: Range) => {
    let start: { c: Node; o: number } = {
      c: range.startContainer,
      o: range.startOffset,
    };
    let end: { c: Node; o: number } = {
      c: range.endContainer,
      o: range.endOffset,
    };

    try {
      if (sheetRange.comparePoint(start.c, start.o) < 0) {
        start = { c: sheetRange.startContainer, o: sheetRange.startOffset };
      }
      if (sheetRange.comparePoint(end.c, end.o) > 0) {
        end = { c: sheetRange.endContainer, o: sheetRange.endOffset };
      }

      const clipped = document.createRange();
      clipped.setStart(start.c, start.o);
      clipped.setEnd(end.c, end.o);
      return clipped.collapsed ? null : clipped;
    } catch {
      return null;
    }
  };

  document.addEventListener('copy', (event) => {
    let copy = pendingCopy;

    if (!copy) {
      const selection = document.getSelection();

      if (
        selection &&
        !selection.isCollapsed &&
        selection.rangeCount > 0 &&
        selection.containsNode(sheet, true)
      ) {
        const sheetRange = document.createRange();
        sheetRange.selectNodeContents(sheet);

        const parts: string[] = [];
        for (let i = 0; i < selection.rangeCount; i += 1) {
          const clipped = clipToSheet(selection.getRangeAt(i), sheetRange);
          if (!clipped) continue;

          const probe = document.createElement('div');
          probe.appendChild(clipped.cloneContents());
          probe.querySelectorAll('rt').forEach((node) => node.remove());

          let buffer = '';
          for (const child of Array.from(probe.childNodes)) {
            const isLine =
              child.nodeType === Node.ELEMENT_NODE &&
              (child as HTMLElement).classList.contains('line');
            if (isLine) {
              if (buffer.trim()) parts.push(buffer.trim());
              buffer = '';
              const text = (child.textContent ?? '')
                .replace(/\u00a0/g, ' ')
                .trim();
              if (text) parts.push(text);
              continue;
            }
            buffer += child.textContent ?? '';
          }
          if (buffer.trim()) parts.push(buffer.trim());
        }

        const selected = parts.join('\n').replace(/\r\n?/g, '\n');

        if (selected.trim()) {
          copy = {
            html: buildUniversalHtml(
              selected,
              state.tone,
              HANZI_PT[state.size],
            ),
            plain: selected,
          };
        }
      }
    }

    if (!copy) return;

    event.preventDefault();
    event.clipboardData?.setData('text/plain', copy.plain);
    event.clipboardData?.setData('text/html', copy.html);
  });

  document.addEventListener('keydown', (event) => {
    if (
      !(event.metaKey || event.ctrlKey) ||
      event.key.toLowerCase() !== 'a' ||
      event.isComposing
    ) {
      return;
    }

    if (
      document.activeElement === sheet ||
      (document.getSelection()?.containsNode(sheet, true) ?? false)
    ) {
      event.preventDefault();
      const range = document.createRange();
      range.selectNodeContents(sheet);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  });

  const selectSheet = () => {
    sheet.focus();
    const range = document.createRange();
    range.selectNodeContents(sheet);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  const legacyCopyHtml = (html: string, plain: string) => {
    pendingCopy = { html, plain };
    const host = document.createElement('div');
    host.innerHTML = html;
    host.setAttribute('aria-hidden', 'true');
    host.style.position = 'fixed';
    host.style.left = '-10000px';
    host.style.top = '0';
    host.style.opacity = '0';
    document.body.appendChild(host);

    const range = document.createRange();
    range.selectNodeContents(host);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch {
      copied = false;
    } finally {
      pendingCopy = null;
      selection?.removeAllRanges();
      host.remove();
    }

    if (!copied) throw new Error('copy failed');
  };


  const labelTimers = new WeakMap<HTMLButtonElement, number>();

  const flash = (
    button: HTMLButtonElement,
    label: string,
    mode: 'copied' | 'error',
    duration = 1600,
  ) => {
    if (!button.dataset.label) {
      button.dataset.label = button.textContent ?? '';
    }

    window.clearTimeout(labelTimers.get(button));
    button.textContent = label;
    button.dataset.state = mode;

    const timer = window.setTimeout(() => {
      button.textContent = button.dataset.label ?? '';
      delete button.dataset.state;
    }, duration);
    labelTimers.set(button, timer);
  };

  const writeClipboard = async (
    button: HTMLButtonElement,
    html: string,
    plain: string,
    message: string,
  ) => {
    try {
      if (
        navigator.clipboard?.write &&
        typeof ClipboardItem !== 'undefined'
      ) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([plain], { type: 'text/plain' }),
          }),
        ]);
      } else {
        legacyCopyHtml(html, plain);
      }
      flash(button, '已复制', 'copied');
      announce(message);
    } catch {
      try {
        legacyCopyHtml(html, plain);
        flash(button, '已复制', 'copied');
        announce(message);
      } catch {
        selectSheet();
        flash(button, '复制失败', 'error', 2400);
        announce('复制失败，已选中文字，请按 Control 或 Command 加 C');
      }
    }
  };

  const copySheet = () => {
    if (!state.text.trim()) return;
    writeClipboard(
      copyButton,
      buildUniversalHtml(state.text, state.tone, HANZI_PT[state.size]),
      buildPlainText(state.text, state.tone),
      '已复制注音稿，拼音在上汉字在下，PPT 和 Word 都可直接粘贴',
    );
  };

  const copyWord = () => {
    if (!state.text.trim()) return;
    writeClipboard(
      wordButton,
      buildRubyHtml(state.text, state.tone, HANZI_PT[state.size]),
      buildPlainText(state.text, state.tone),
      '已复制 Word 注音版，逐字对齐，粘贴到 Word 或 WPS 即为标准拼音',
    );
  };

  copyButton.addEventListener('click', copySheet);
  wordButton.addEventListener('click', copyWord);

  const segments = Array.from(
    document.querySelectorAll<HTMLElement>('.segment'),
  );

  const syncSegment = (name: 'tone' | 'size', value: string) => {
    const segment = segments.find((item) => item.dataset.segment === name);
    if (!segment) return;

    const buttons = Array.from(segment.querySelectorAll('button'));
    const index = buttons.findIndex((button) => button.dataset.value === value);
    if (index < 0) return;

    buttons.forEach((button) => {
      button.setAttribute(
        'aria-pressed',
        button.dataset.value === value ? 'true' : 'false',
      );
    });
    segment.style.setProperty('--i', String(index));
    segment.style.setProperty('--n', String(buttons.length));
  };

  for (const segment of segments) {
    segment.style.setProperty(
      '--n',
      String(segment.querySelectorAll('button').length),
    );
    segment.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest('button');
      if (!button) return;

      const name = segment.dataset.segment as 'tone' | 'size';
      const value = button.dataset.value;
      if (!value) return;

      if (name === 'tone') {
        state.tone = value as Tone;
        syncSegment('tone', value);
        render();
        announce('声调已切换');
      } else {
        state.size = value as Size;
        syncSegment('size', value);
        document.documentElement.style.setProperty(
          '--hz',
          `${HANZI_PX[state.size]}px`,
        );
      }
    });
  }

  syncSegment('tone', state.tone);
  syncSegment('size', state.size);
  document.documentElement.style.setProperty('--hz', `${HANZI_PX[state.size]}px`);
  sheet.dataset.empty = state.text.length ? 'false' : 'true';
  updateChrome();

  window.setTimeout(() => {
    sheet.classList.remove('is-entering');
  }, 1000);
}
