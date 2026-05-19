import { Highlight } from "@tiptap/extension-highlight";
import { Image } from "@tiptap/extension-image";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Subscript } from "@tiptap/extension-subscript";
import { Superscript } from "@tiptap/extension-superscript";
import {
	Table,
	TableCell,
	TableHeader,
	TableRow,
} from "@tiptap/extension-table";
import { TextAlign } from "@tiptap/extension-text-align";
import { Typography } from "@tiptap/extension-typography";
import type { JSONContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { renderToReactElement } from "@tiptap/static-renderer";

import { HorizontalRule } from "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension";

import "@/components/tiptap-node/blockquote-node/blockquote-node.scss";
import "@/components/tiptap-node/code-block-node/code-block-node.scss";
import "@/components/tiptap-node/heading-node/heading-node.scss";
import "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss";
import "@/components/tiptap-node/image-node/image-node.scss";
import "@/components/tiptap-node/list-node/list-node.scss";
import "@/components/tiptap-node/paragraph-node/paragraph-node.scss";
import "@/styles/_variables.scss";
import "./offerte-editor.scss";

const STATIC_EXTENSIONS = [
	StarterKit.configure({
		horizontalRule: false,
		link: { openOnClick: true },
	}),
	HorizontalRule,
	TextAlign.configure({ types: ["heading", "paragraph"] }),
	TaskList,
	TaskItem.configure({ nested: true }),
	Highlight.configure({ multicolor: true }),
	Image,
	Typography,
	Superscript,
	Subscript,
	Table.configure({ resizable: false }),
	TableRow,
	TableHeader,
	TableCell,
];

type Props = {
	content: JSONContent;
	className?: string;
};

export function OfferteStaticContent({ content, className }: Props) {
	const rendered = renderToReactElement({
		content,
		extensions: STATIC_EXTENSIONS,
	});

	return (
		<div className={className ?? "offerte-editor-content"}>
			<div className="tiptap ProseMirror offerte-editor offerte-editor--static simple-editor">
				{rendered}
			</div>
		</div>
	);
}
