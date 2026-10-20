# 注音稿

汉字逐字注音，拼音直接落在字上方。页面本身就是稿纸：点进去改中文，拼音即时更新，复制后粘进 Word 或 PPT。

## 开发

```sh
bun install
bun run dev
```

`bun run build` 输出到 `dist/`，`bun run check` 做类型检查。

## 技术

- Astro 静态站点，无前端框架
- pinyin-pro 生成拼音，页面用标准 `<ruby>/<rt>` 逐字标注
- 复制导出两种格式：双行段落式（PPT/Word 通用）与 Word 注音版（ruby，逐字对齐）

## 许可

MIT
