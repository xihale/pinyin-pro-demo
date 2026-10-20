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
- 「复制注音稿」为双行段落式（PPT/Word/微信通用）；「Word 注音版」下载 `.docx`，内嵌原生拼音指南（`w:ruby`，居中对齐），Word/WPS 打开即逐字对齐
- LibreOffice 编辑视图会给拼音指南画灰色底纹（应用显示行为，文件里没有任何背景）；打印、导出 PDF、Word/WPS 打开均无灰底

## 许可

MIT
