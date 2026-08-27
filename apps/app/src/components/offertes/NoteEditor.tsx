import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { EditorContent, type JSONContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef } from "react";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";

type NoteEditorProps = {
	value: JSONContent | undefined;
	onChange: (value: JSONContent) => void;
	placeholder?: string;
};

export function NoteEditor({ value, onChange, placeholder }: NoteEditorProps) {
	const debouncedSave = useDebouncedCallback((doc: JSONContent) => {
		onChange(doc);
	}, 500);

	const editor = useEditor({
		extensions: [
			StarterKit.configure({}),
			TaskList,
			TaskItem.configure({ nested: true }),
		],
		content: value ?? { type: "doc", content: [{ type: "paragraph" }] },
		editorProps: {
			attributes: {
				class:
					"tiptap-content prose prose-sm max-w-none focus:outline-none text-sm text-muted-foreground",
				"data-placeholder": placeholder ?? "Notes…",
			},
		},
		onUpdate: ({ editor }) => {
			debouncedSave(editor.getJSON());
		},
		immediatelyRender: false,
	});

	const lastSyncedRef = useRef<JSONContent | undefined>(value);
	useEffect(() => {
		if (!editor) return;
		if (value === lastSyncedRef.current) return;
		const current = editor.getJSON();
		if (JSON.stringify(current) === JSON.stringify(value)) return;
		editor.commands.setContent(
			value ?? { type: "doc", content: [{ type: "paragraph" }] },
			{ emitUpdate: false },
		);
		lastSyncedRef.current = value;
	}, [editor, value]);

	if (!editor) return null;

	return <EditorContent editor={editor} />;
}
