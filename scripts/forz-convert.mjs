import { JSDOM } from "jsdom";
import fs from "node:fs";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;
globalThis.Node = dom.window.Node;
globalThis.HTMLElement = dom.window.HTMLElement;
try {
  Object.defineProperty(globalThis, "navigator", {
    value: dom.window.navigator,
    configurable: true,
  });
} catch {}

const { Editor } = await import("@tiptap/core");
const { StarterKit } = await import("@tiptap/starter-kit");
const { TaskItem, TaskList } = await import("@tiptap/extension-list");
const { Table, TableCell, TableHeader, TableRow } = await import("@tiptap/extension-table");
const { Highlight } = await import("@tiptap/extension-highlight");
const { Image } = await import("@tiptap/extension-image");
const { Typography } = await import("@tiptap/extension-typography");
const { Superscript } = await import("@tiptap/extension-superscript");
const { Subscript } = await import("@tiptap/extension-subscript");
const { TextAlign } = await import("@tiptap/extension-text-align");
const { Markdown } = await import("tiptap-markdown");

const md = fs.readFileSync(process.argv[2], "utf8");

const baseExtensions = [
  StarterKit.configure({ link: { openOnClick: false } }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Highlight.configure({ multicolor: true }),
  Image,
  Typography,
  Superscript,
  Subscript,
  Table.configure({ resizable: true }),
  TableRow,
  TableHeader,
  TableCell,
];

// Editor A: markdown -> HTML via tiptap-markdown parser
const mdEditor = new Editor({
  extensions: [
    ...baseExtensions,
    Markdown.configure({ html: true, transformPastedText: true, breaks: true }),
  ],
});
const html = mdEditor.storage.markdown.parser.parse(md);

// Editor B: HTML -> ProseMirror JSON (no Markdown extension to intercept)
const htmlEditor = new Editor({
  extensions: baseExtensions,
  content: html,
  parseOptions: { preserveWhitespace: false },
});
const json = htmlEditor.getJSON();
fs.writeFileSync(process.argv[3], JSON.stringify(json));

function depth(n, d = 1) {
  if (!n || !Array.isArray(n.content)) return d;
  return Math.max(...n.content.map((c) => depth(c, d + 1)), d);
}
console.log("nodes:", json.content?.length, "maxDepth:", depth(json), "bytes:", JSON.stringify(json).length);
