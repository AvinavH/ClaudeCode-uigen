import { test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { getToolLabel, ToolCallBadge } from "../ToolCallBadge";

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// getToolLabel — pure function tests
// ---------------------------------------------------------------------------

// str_replace_editor: create
test("getToolLabel: str_replace_editor create in-progress", () => {
  expect(getToolLabel("str_replace_editor", { command: "create", path: "/App.jsx" }, false)).toBe("Creating App.jsx");
});

test("getToolLabel: str_replace_editor create done", () => {
  expect(getToolLabel("str_replace_editor", { command: "create", path: "/App.jsx" }, true)).toBe("Created App.jsx");
});

// str_replace_editor: str_replace
test("getToolLabel: str_replace_editor str_replace in-progress", () => {
  expect(getToolLabel("str_replace_editor", { command: "str_replace", path: "/App.jsx" }, false)).toBe("Editing App.jsx");
});

test("getToolLabel: str_replace_editor str_replace done", () => {
  expect(getToolLabel("str_replace_editor", { command: "str_replace", path: "/App.jsx" }, true)).toBe("Edited App.jsx");
});

// str_replace_editor: insert (same label as str_replace)
test("getToolLabel: str_replace_editor insert in-progress", () => {
  expect(getToolLabel("str_replace_editor", { command: "insert", path: "/App.jsx" }, false)).toBe("Editing App.jsx");
});

test("getToolLabel: str_replace_editor insert done", () => {
  expect(getToolLabel("str_replace_editor", { command: "insert", path: "/App.jsx" }, true)).toBe("Edited App.jsx");
});

// str_replace_editor: view
test("getToolLabel: str_replace_editor view in-progress", () => {
  expect(getToolLabel("str_replace_editor", { command: "view", path: "/App.jsx" }, false)).toBe("Reading App.jsx");
});

test("getToolLabel: str_replace_editor view done", () => {
  expect(getToolLabel("str_replace_editor", { command: "view", path: "/App.jsx" }, true)).toBe("Read App.jsx");
});

// str_replace_editor: undo_edit
test("getToolLabel: str_replace_editor undo_edit in-progress", () => {
  expect(getToolLabel("str_replace_editor", { command: "undo_edit", path: "/App.jsx" }, false)).toBe("Reverting App.jsx");
});

test("getToolLabel: str_replace_editor undo_edit done", () => {
  expect(getToolLabel("str_replace_editor", { command: "undo_edit", path: "/App.jsx" }, true)).toBe("Reverted App.jsx");
});

// file_manager: rename
test("getToolLabel: file_manager rename in-progress", () => {
  expect(getToolLabel("file_manager", { command: "rename", path: "/App.jsx", new_path: "/Button.jsx" }, false)).toBe("Renaming App.jsx");
});

test("getToolLabel: file_manager rename done", () => {
  expect(getToolLabel("file_manager", { command: "rename", path: "/App.jsx", new_path: "/Button.jsx" }, true)).toBe("Renamed App.jsx to Button.jsx");
});

// file_manager: delete
test("getToolLabel: file_manager delete in-progress", () => {
  expect(getToolLabel("file_manager", { command: "delete", path: "/App.jsx" }, false)).toBe("Deleting App.jsx");
});

test("getToolLabel: file_manager delete done", () => {
  expect(getToolLabel("file_manager", { command: "delete", path: "/App.jsx" }, true)).toBe("Deleted App.jsx");
});

// Nested path — should extract only the basename
test("getToolLabel: extracts basename from nested path", () => {
  expect(getToolLabel("str_replace_editor", { command: "create", path: "/src/components/Button.tsx" }, false)).toBe("Creating Button.tsx");
});

// Missing/empty path — should not crash, just produce an empty filename gracefully
test("getToolLabel: handles missing path gracefully", () => {
  expect(() => getToolLabel("str_replace_editor", { command: "create" }, false)).not.toThrow();
  expect(getToolLabel("str_replace_editor", { command: "create" }, false)).toBe("Creating ");
});

test("getToolLabel: handles empty path gracefully", () => {
  expect(getToolLabel("str_replace_editor", { command: "create", path: "" }, false)).toBe("Creating ");
});

// Unknown tool — falls back to raw toolName
test("getToolLabel: unknown tool falls back to toolName", () => {
  expect(getToolLabel("some_unknown_tool", { command: "do_thing", path: "/foo.ts" }, false)).toBe("some_unknown_tool");
  expect(getToolLabel("some_unknown_tool", { command: "do_thing", path: "/foo.ts" }, true)).toBe("some_unknown_tool");
});

// Empty args (fallback case used in MessageList tests)
test("getToolLabel: empty args falls back to toolName", () => {
  expect(getToolLabel("str_replace_editor", {}, true)).toBe("str_replace_editor");
});

// ---------------------------------------------------------------------------
// ToolCallBadge — render tests
// ---------------------------------------------------------------------------

test("ToolCallBadge shows spinner when state is 'call'", () => {
  const { container } = render(
    <ToolCallBadge toolName="str_replace_editor" args={{ command: "create", path: "/App.jsx" }} state="call" />
  );
  // Loader2 renders as an svg with the animate-spin class
  const spinner = container.querySelector(".animate-spin");
  expect(spinner).not.toBeNull();
});

test("ToolCallBadge shows spinner when state is 'partial-call'", () => {
  const { container } = render(
    <ToolCallBadge toolName="str_replace_editor" args={{ command: "create", path: "/App.jsx" }} state="partial-call" />
  );
  const spinner = container.querySelector(".animate-spin");
  expect(spinner).not.toBeNull();
});

test("ToolCallBadge shows green dot when state is 'result'", () => {
  const { container } = render(
    <ToolCallBadge toolName="str_replace_editor" args={{ command: "create", path: "/App.jsx" }} state="result" />
  );
  const dot = container.querySelector(".bg-emerald-500");
  expect(dot).not.toBeNull();
  // No spinner
  expect(container.querySelector(".animate-spin")).toBeNull();
});

test("ToolCallBadge renders friendly label text when in-progress", () => {
  render(
    <ToolCallBadge toolName="str_replace_editor" args={{ command: "create", path: "/App.jsx" }} state="call" />
  );
  expect(screen.getByText("Creating App.jsx")).toBeDefined();
});

test("ToolCallBadge renders friendly label text when done", () => {
  render(
    <ToolCallBadge toolName="str_replace_editor" args={{ command: "create", path: "/App.jsx" }} state="result" />
  );
  expect(screen.getByText("Created App.jsx")).toBeDefined();
});

test("ToolCallBadge renders file_manager delete label", () => {
  render(
    <ToolCallBadge toolName="file_manager" args={{ command: "delete", path: "/OldComponent.tsx" }} state="result" />
  );
  expect(screen.getByText("Deleted OldComponent.tsx")).toBeDefined();
});

test("ToolCallBadge falls back to toolName for unknown tool", () => {
  render(
    <ToolCallBadge toolName="str_replace_editor" args={{}} state="result" />
  );
  expect(screen.getByText("str_replace_editor")).toBeDefined();
});
