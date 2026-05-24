"use client";

import { Loader2 } from "lucide-react";

interface ToolCallBadgeProps {
  toolName: string;
  args: Record<string, unknown>;
  state: "call" | "result" | "partial-call";
}

function getFilename(path: unknown): string {
  if (typeof path !== "string" || !path) return "";
  return path.split("/").filter(Boolean).pop() ?? path;
}

export function getToolLabel(
  toolName: string,
  args: Record<string, unknown>,
  done: boolean
): string {
  const filename = getFilename(args.path);
  const command = typeof args.command === "string" ? args.command : "";

  if (toolName === "str_replace_editor") {
    switch (command) {
      case "create":
        return done ? `Created ${filename}` : `Creating ${filename}`;
      case "str_replace":
      case "insert":
        return done ? `Edited ${filename}` : `Editing ${filename}`;
      case "view":
        return done ? `Read ${filename}` : `Reading ${filename}`;
      case "undo_edit":
        return done ? `Reverted ${filename}` : `Reverting ${filename}`;
    }
  }

  if (toolName === "file_manager") {
    switch (command) {
      case "rename": {
        const newFilename = getFilename(args.new_path);
        return done
          ? `Renamed ${filename} to ${newFilename}`
          : `Renaming ${filename}`;
      }
      case "delete":
        return done ? `Deleted ${filename}` : `Deleting ${filename}`;
    }
  }

  return toolName;
}

export function ToolCallBadge({ toolName, args, state }: ToolCallBadgeProps) {
  const done = state === "result";
  const label = getToolLabel(toolName, args, done);

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs font-mono border border-neutral-200">
      {done ? (
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
      ) : (
        <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
      )}
      <span className="text-neutral-700">{label}</span>
    </div>
  );
}
