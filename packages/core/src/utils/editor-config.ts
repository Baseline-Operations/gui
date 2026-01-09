import { EditorConfig } from "../types/config.js";

/**
 * Normalize editor config (string or array) to array of editor IDs.
 */
export function normalizeEditorConfig(editor: EditorConfig | undefined): string[] {
	if (!editor) return [];
	if (typeof editor === "string") return [editor];
	return editor;
}

/**
 * Check if an editor should be generated based on config.
 */
export function shouldGenerateEditor(editor: EditorConfig | undefined, editorId: string): boolean {
	return normalizeEditorConfig(editor).includes(editorId);
}

