"use client";

import type { ProcessOptions } from "@/lib/processors/types";
import type { Tool } from "@/lib/registry";
import { MergeOptions } from "@/components/tools/options/MergeOptions";
import { SplitOptions } from "@/components/tools/options/SplitOptions";
import { RotateOptions } from "@/components/tools/options/RotateOptions";
import { OrganizeOptions } from "@/components/tools/options/OrganizeOptions";
import { RemovePagesOptions } from "@/components/tools/options/RemovePagesOptions";
import { CompressOptions } from "@/components/tools/options/CompressOptions";
import { ProtectOptions } from "@/components/tools/options/ProtectOptions";
import { UnlockOptions } from "@/components/tools/options/UnlockOptions";
import { NoOptions } from "@/components/tools/options/NoOptions";
import { ExtractPagesOptions } from "@/components/tools/options/ExtractPagesOptions";
import { PageNumbersOptions } from "@/components/tools/options/PageNumbersOptions";
import { WatermarkOptions } from "@/components/tools/options/WatermarkOptions";
import { SignOptions } from "@/components/tools/options/SignOptions";

/*
 * Dynamic options panel (Section 4.3). Renders the component named by the
 * tool's `optionsComponent` field via this lookup map — no if/else chain.
 * Adding a tool's options = one entry here + one small component file. Each
 * options component owns its own defaults and reports changes up via
 * onChange; the tool page holds the options state (Section 13.6: options
 * reset to defaults on each new file — the page remounts the panel per file).
 */
export type OptionsComponent = (props: {
  files: File[];
  value: ProcessOptions;
  onChange: (value: ProcessOptions) => void;
}) => React.ReactNode;

const OPTIONS_COMPONENTS: Record<string, OptionsComponent> = {
  MergeOptions,
  SplitOptions,
  RotateOptions,
  OrganizeOptions,
  RemovePagesOptions,
  CompressOptions,
  ProtectOptions,
  UnlockOptions,
  NoOptions,
  ExtractPagesOptions,
  PageNumbersOptions,
  WatermarkOptions,
  SignOptions,
};

export function OptionsPanel({
  tool,
  files,
  value,
  onChange,
}: {
  tool: Tool;
  files: File[];
  value: ProcessOptions;
  onChange: (value: ProcessOptions) => void;
}) {
  const Component = OPTIONS_COMPONENTS[tool.optionsComponent];
  if (!Component) return null;
  return <Component files={files} value={value} onChange={onChange} />;
}
