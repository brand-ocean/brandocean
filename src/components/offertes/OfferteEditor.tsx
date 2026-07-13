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
import { Selection } from "@tiptap/extensions";
import {
	EditorContent,
	EditorContext,
	type JSONContent,
	useEditor,
} from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { useEffect, useRef, useState } from "react";

import { ArrowLeftIcon } from "@/components/tiptap-icons/arrow-left-icon";
import { HighlighterIcon } from "@/components/tiptap-icons/highlighter-icon";
import { LinkIcon } from "@/components/tiptap-icons/link-icon";
import { HorizontalRule } from "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension";
import { ImageUploadNode } from "@/components/tiptap-node/image-upload-node/image-upload-node-extension";
import { BlockquoteButton } from "@/components/tiptap-ui/blockquote-button";
import { CodeBlockButton } from "@/components/tiptap-ui/code-block-button";
import {
	ColorHighlightPopover,
	ColorHighlightPopoverButton,
	ColorHighlightPopoverContent,
} from "@/components/tiptap-ui/color-highlight-popover";
import { HeadingDropdownMenu } from "@/components/tiptap-ui/heading-dropdown-menu";
import { ImageUploadButton } from "@/components/tiptap-ui/image-upload-button";
import {
	LinkButton,
	LinkContent,
	LinkPopover,
} from "@/components/tiptap-ui/link-popover";
import { ListDropdownMenu } from "@/components/tiptap-ui/list-dropdown-menu";
import { MarkButton } from "@/components/tiptap-ui/mark-button";
import { TextAlignButton } from "@/components/tiptap-ui/text-align-button";
import { UndoRedoButton } from "@/components/tiptap-ui/undo-redo-button";
import { Button } from "@/components/tiptap-ui-primitive/button";
import { Spacer } from "@/components/tiptap-ui-primitive/spacer";
import {
	Toolbar,
	ToolbarGroup,
	ToolbarSeparator,
} from "@/components/tiptap-ui-primitive/toolbar";
import { useCursorVisibility } from "@/hooks/use-cursor-visibility";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { useIsBreakpoint } from "@/hooks/use-is-breakpoint";
import { useWindowSize } from "@/hooks/use-window-size";
import { handleImageUpload, MAX_FILE_SIZE } from "@/lib/tiptap-utils";

import "@/components/tiptap-node/blockquote-node/blockquote-node.scss";
import "@/components/tiptap-node/code-block-node/code-block-node.scss";
import "@/components/tiptap-node/heading-node/heading-node.scss";
import "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss";
import "@/components/tiptap-node/image-node/image-node.scss";
import "@/components/tiptap-node/list-node/list-node.scss";
import "@/components/tiptap-node/paragraph-node/paragraph-node.scss";
import "@/styles/_variables.scss";
import "@/styles/_keyframe-animations.scss";
import "./offerte-editor.scss";

type OfferteEditorProps = {
	value?: JSONContent;
	onChange?: (value: JSONContent) => void;
	editable?: boolean;
};

const EMPTY_DOC: JSONContent = {
	type: "doc",
	content: [{ type: "paragraph" }],
};

const MainToolbarContent = ({
	onHighlighterClick,
	onLinkClick,
	isMobile,
	onPasteMarkdown,
	onPastePlain,
}: {
	onHighlighterClick: () => void;
	onLinkClick: () => void;
	isMobile: boolean;
	onPasteMarkdown: () => void;
	onPastePlain: () => void;
}) => (
	<>
		<Spacer />
		<ToolbarGroup>
			<UndoRedoButton action="undo" />
			<UndoRedoButton action="redo" />
		</ToolbarGroup>
		<ToolbarSeparator />
		<ToolbarGroup>
			<HeadingDropdownMenu modal={false} levels={[1, 2, 3, 4]} />
			<ListDropdownMenu
				modal={false}
				types={["bulletList", "orderedList", "taskList"]}
			/>
			<BlockquoteButton />
			<CodeBlockButton />
		</ToolbarGroup>
		<ToolbarSeparator />
		<ToolbarGroup>
			<MarkButton type="bold" />
			<MarkButton type="italic" />
			<MarkButton type="strike" />
			<MarkButton type="code" />
			<MarkButton type="underline" />
			{!isMobile ? (
				<ColorHighlightPopover />
			) : (
				<ColorHighlightPopoverButton onClick={onHighlighterClick} />
			)}
			{!isMobile ? <LinkPopover /> : <LinkButton onClick={onLinkClick} />}
		</ToolbarGroup>
		<ToolbarSeparator />
		<ToolbarGroup>
			<TextAlignButton align="left" />
			<TextAlignButton align="center" />
			<TextAlignButton align="right" />
		</ToolbarGroup>
		<ToolbarSeparator />
		<ToolbarGroup>
			<ImageUploadButton text="Add image" />
		</ToolbarGroup>
		<ToolbarSeparator />
		<ToolbarGroup>
			<Button
				data-style="ghost"
				type="button"
				onClick={onPasteMarkdown}
				aria-label="Paste from clipboard as markdown"
				title="Paste as markdown"
			>
				MD
			</Button>
			<Button
				data-style="ghost"
				type="button"
				onClick={onPastePlain}
				aria-label="Paste from clipboard as plain text"
				title="Paste as plain text"
			>
				TXT
			</Button>
		</ToolbarGroup>
		<Spacer />
	</>
);

const MobileToolbarContent = ({
	type,
	onBack,
}: {
	type: "highlighter" | "link";
	onBack: () => void;
}) => (
	<>
		<ToolbarGroup>
			<Button variant="ghost" onClick={onBack}>
				<ArrowLeftIcon className="tiptap-button-icon" />
				{type === "highlighter" ? (
					<HighlighterIcon className="tiptap-button-icon" />
				) : (
					<LinkIcon className="tiptap-button-icon" />
				)}
			</Button>
		</ToolbarGroup>
		<ToolbarSeparator />
		{type === "highlighter" ? (
			<ColorHighlightPopoverContent />
		) : (
			<LinkContent />
		)}
	</>
);

export function OfferteEditor({
	value,
	onChange,
	editable = true,
}: OfferteEditorProps) {
	const isMobile = useIsBreakpoint();
	const { height } = useWindowSize();
	const [mobileView, setMobileView] = useState<"main" | "highlighter" | "link">(
		"main",
	);
	const toolbarRef = useRef<HTMLDivElement>(null);

	const debouncedSave = useDebouncedCallback((doc: JSONContent) => {
		onChange?.(doc);
	}, 500);

	const editor = useEditor({
		editable,
		immediatelyRender: false,
		editorProps: {
			attributes: {
				autocomplete: "off",
				autocorrect: "off",
				autocapitalize: "off",
				"aria-label":
					"Offerte content area. Start typing or pick a block from the toolbar.",
				class: "simple-editor offerte-editor",
			},
		},
		extensions: [
			StarterKit.configure({
				horizontalRule: false,
				link: { openOnClick: false, enableClickSelection: true },
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
			Selection,
			Markdown.configure({
				html: false,
				// Keep normal Cmd+V paste as rich content. When true, every paste is
				// re-parsed as markdown with html:false, which escapes any stray
				// "<"/">" into literal &lt;/&gt; and flattens formatting. Markdown
				// import stays available through the explicit "MD" button below.
				transformPastedText: false,
				transformCopiedText: false,
				breaks: true,
			}),
			Table.configure({ resizable: true }),
			TableRow,
			TableHeader,
			TableCell,
			ImageUploadNode.configure({
				accept: "image/*",
				maxSize: MAX_FILE_SIZE,
				limit: 3,
				upload: handleImageUpload,
				onError: (error) => console.error("Upload failed:", error),
			}),
		],
		content: value ?? EMPTY_DOC,
		onUpdate: ({ editor }) => {
			debouncedSave(editor.getJSON());
		},
	});

	const rect = useCursorVisibility({
		editor,
		overlayHeight: toolbarRef.current?.getBoundingClientRect().height ?? 0,
	});

	useEffect(() => {
		if (!isMobile && mobileView !== "main") setMobileView("main");
	}, [isMobile, mobileView]);

	const lastSyncedRef = useRef<JSONContent | undefined>(value);
	useEffect(() => {
		if (!editor) return;
		if (value === lastSyncedRef.current) return;
		const current = editor.getJSON();
		if (JSON.stringify(current) === JSON.stringify(value)) return;
		editor.commands.setContent(value ?? EMPTY_DOC, { emitUpdate: false });
		lastSyncedRef.current = value;
	}, [editor, value]);

	useEffect(() => {
		if (!editor) return;
		if (editor.isEditable !== editable) editor.setEditable(editable);
	}, [editor, editable]);

	const pasteAsMarkdown = async () => {
		if (!editor) return;
		try {
			const text = await navigator.clipboard.readText();
			if (!text) return;
			// tiptap-markdown parses a raw string passed to insertContent as
			// markdown. Do NOT pre-convert to HTML first: insertContent(html) is
			// re-escaped into a literal &lt;p&gt;… text node, which is what wiped
			// the layout on earlier offertes.
			editor.chain().focus().insertContent(text).run();
		} catch (err) {
			console.error("Paste as markdown failed", err);
		}
	};

	const pasteAsPlain = async () => {
		if (!editor) return;
		try {
			const text = await navigator.clipboard.readText();
			if (!text) return;
			// Insert explicit paragraph nodes so the markdown extension does not
			// re-interpret the string (a bare string would be parsed as markdown).
			const nodes = text.split(/\r?\n/).map((line) => ({
				type: "paragraph",
				content: line ? [{ type: "text", text: line }] : [],
			}));
			editor.chain().focus().insertContent(nodes).run();
		} catch (err) {
			console.error("Paste as plain text failed", err);
		}
	};

	if (!editor) return null;

	return (
		<div className="offerte-editor-wrapper">
			<EditorContext.Provider value={{ editor }}>
				{editable && (
					<Toolbar
						ref={toolbarRef}
						style={
							isMobile ? { bottom: `calc(100% - ${height - rect.y}px)` } : {}
						}
					>
						{mobileView === "main" ? (
							<MainToolbarContent
								onHighlighterClick={() => setMobileView("highlighter")}
								onLinkClick={() => setMobileView("link")}
								isMobile={isMobile}
								onPasteMarkdown={pasteAsMarkdown}
								onPastePlain={pasteAsPlain}
							/>
						) : (
							<MobileToolbarContent
								type={mobileView === "highlighter" ? "highlighter" : "link"}
								onBack={() => setMobileView("main")}
							/>
						)}
					</Toolbar>
				)}
				<EditorContent
					editor={editor}
					role="presentation"
					className="offerte-editor-content"
				/>
			</EditorContext.Provider>
		</div>
	);
}
