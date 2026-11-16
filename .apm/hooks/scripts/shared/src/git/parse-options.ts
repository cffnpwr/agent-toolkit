const NO_PREFIX = "no-";

export type OptionArgument = "none" | "optional" | "required";

export interface OptionSpec {
  short?: string;
  long?: string;
  argument: OptionArgument;
  // `--no-<long>`での否定を受け付けるか
  negatable: boolean;
}

// permuteは位置引数の後もオプションを解釈し、stop-at-non-optionは最初の位置引数で止める
export type ScanMode = "permute" | "stop-at-non-option";

interface ScannedOption<S extends OptionSpec> {
  type: "option";
  spec: S;
  negated: boolean;
}

interface ScannedPositional {
  type: "positional";
  index: number;
}

// gitがエラーで終了する未知・曖昧なオプション
interface ScannedUnknownOption {
  type: "unknown-option";
}

// オプションの位置にある、静的に解決できない語
interface ScannedUnresolved {
  type: "unresolved";
  index: number;
}

export type ScannedArg<S extends OptionSpec> = ScannedOption<S>
  | ScannedPositional | ScannedUnknownOption | ScannedUnresolved;

interface LongMatch<S extends OptionSpec> {
  type: "match";
  spec: S;
  negated: boolean;
  hasInlineValue: boolean;
}

type LongResolution<S extends OptionSpec> = LongMatch<S> | { type: "ambiguous"; }
  | { type: "unknown"; };

interface Abbreviation<S extends OptionSpec> {
  spec: S;
  negated: boolean;
}

// argは先頭の`--`を除いた語
export const resolveLongOption = <S extends OptionSpec>(
  arg: string,
  specs: readonly S[],
): LongResolution<S> => {
  const eq = arg.indexOf("=");
  const nameEnd = eq === -1 ? arg.length : eq;
  let start = 0;
  let isArgNegated = false;
  let startsWithNoNo = false;
  if (arg.startsWith(NO_PREFIX)) {
    start = NO_PREFIX.length;
    if (arg.startsWith(NO_PREFIX, start)) {
      start += NO_PREFIX.length;
      startsWithNoNo = true;
    } else {
      isArgNegated = true;
    }
  }
  const body = arg.slice(start);
  const abbreviated = arg.slice(start, nameEnd);

  const abbreviations: Abbreviation<S>[] = [];
  for (const spec of specs) {
    if (spec.long === undefined) {
      continue;
    }
    let name = spec.long;
    let isOptionNegated = false;
    if (name.startsWith(NO_PREFIX)) {
      name = name.slice(NO_PREFIX.length);
      isOptionNegated = true;
    } else if (startsWithNoNo) {
      continue;
    }
    const negated = isArgNegated !== isOptionNegated;
    if (negated && !spec.negatable) {
      continue;
    }

    if (body.startsWith(name)) {
      const rest = body.slice(name.length);
      if (rest === "" || rest.startsWith("=")) {
        return { type: "match", spec, negated, hasInlineValue: rest !== "" };
      }
      continue;
    }
    if (name.startsWith(abbreviated)) {
      abbreviations.push({ spec, negated });
    }
    // `--n`・`--no`・`--no-`は否定形の省略としても数える
    if (spec.negatable && NO_PREFIX.startsWith(arg)) {
      abbreviations.push({ spec, negated: !isOptionNegated });
    }
  }

  const [abbreviation, ...rest] = abbreviations;
  if (abbreviation === undefined) {
    return { type: "unknown" };
  }
  if (rest.length > 0) {
    return { type: "ambiguous" };
  }

  return { type: "match", ...abbreviation, hasInlineValue: eq !== -1 };
};

// 値を取るオプションが後続の語を値として消費するか
const consumesNextArg = (
  argument: OptionArgument,
  hasInlineValue: boolean,
): boolean => {
  switch (argument) {
    case "required":
      return !hasInlineValue;
    case "optional":
    case "none":
      return false;
  }
};

// `-abc`形式の短いオプションの連結を解釈し、後続の語を消費するかを返す
const scanShortCluster = <S extends OptionSpec>(
  cluster: string,
  specs: readonly S[],
  out: ScannedArg<S>[],
): boolean => {
  for (let k = 0; k < cluster.length; k++) {
    const spec = specs.find((s) => s.short === cluster[k]);
    if (spec === undefined) {
      out.push({ type: "unknown-option" });
      continue;
    }
    out.push({ type: "option", spec, negated: false });
    if (spec.argument !== "none") {
      // 連結の残りは値になる
      return consumesNextArg(spec.argument, k + 1 < cluster.length);
    }
  }

  return false;
};

// 長いオプションを解釈し、後続の語を消費するかを返す
const scanLongOption = <S extends OptionSpec>(
  arg: string,
  specs: readonly S[],
  out: ScannedArg<S>[],
): boolean => {
  const resolution = resolveLongOption(arg, specs);
  switch (resolution.type) {
    case "match": {
      const { spec, negated, hasInlineValue } = resolution;
      out.push({ type: "option", spec, negated });

      return !negated && consumesNextArg(spec.argument, hasInlineValue);
    }
    case "ambiguous":
    case "unknown":
      out.push({ type: "unknown-option" });

      return false;
  }
};

export const scanOptions = <S extends OptionSpec>(
  args: readonly (string | null)[],
  specs: readonly S[],
  mode: ScanMode,
): ScannedArg<S>[] => {
  const out: ScannedArg<S>[] = [];
  let isOptionsEnded = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === undefined) {
      continue;
    }
    if (isOptionsEnded) {
      out.push({ type: "positional", index: i });
      continue;
    }
    if (arg === null) {
      out.push({ type: "unresolved", index: i });
      continue;
    }
    if (!arg.startsWith("-") || arg === "-") {
      out.push({ type: "positional", index: i });
      isOptionsEnded = mode === "stop-at-non-option";
      continue;
    }
    if (arg === "--" || arg === "--end-of-options") {
      isOptionsEnded = true;
      continue;
    }
    const consumesNext = arg.startsWith("--")
      ? scanLongOption(arg.slice(2), specs, out)
      : scanShortCluster(arg.slice(1), specs, out);
    if (consumesNext) {
      i++;
    }
  }

  return out;
};
