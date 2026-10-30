import type { KuromojiToken } from "kuromojin";

// 文中の位置を持つ形態素
export interface PositionedToken {
  token: Readonly<KuromojiToken>;
  // 検査した本文の先頭からの文字数
  offset: number;
}

export interface MorphologyFinding {
  offset: number;
  length: number;
  message: string;
}

interface BannedVerb {
  // suggestionはprhの規則から移した書き換え先
  suggestion: string;
  // 後に続くと用語になる語の基本形
  termFollowers?: string[];
}

// 比喩的な動詞。活用形によらず基本形で検出
const BANNED_VERBS = new Map<string, BannedVerb>([
  ["足す", { suggestion: "追加する" }],
  ["効く", { suggestion: "（何が良くなったかを具体的に書く）" }],
  ["利く", { suggestion: "有効になる・機能する" }],
  ["捨てる", { suggestion: "破棄する・削除する" }],
  ["飛ばす", { suggestion: "スキップする・省略する・送信する" }],
  ["通す", { suggestion: "渡す・許可する・通過させる" }],
  ["落とす", { suggestion: "停止する・削除する・ダウンロードする" }],
  ["踏む", { suggestion: "（発生した事象を具体的に書く。例: 不具合が発生する・○○を経由する）" }],
  ["尽きる", { suggestion: "上限に達する・残量が無くなる" }],
  ["抑える", { suggestion: "削減する・制限する" }],
  ["絞る", { suggestion: "限定する・制限する" }],
  ["緩める", { suggestion: "条件を変更する・制限を解除する" }],
  ["張る", { suggestion: "作成する・設定する" }],
  ["壊す", { suggestion: "破損させる・不正な状態にする" }],
  ["弾く", { suggestion: "拒否する・除外する" }],
  ["委ねる", { suggestion: "（処理を実行する主体を書く。例: ○○が処理する）" }],
  ["打ち切る", { suggestion: "中止する・終了する" }],
  ["組み立てる", { suggestion: "構築する・生成する" }],
  ["要る", { suggestion: "必要である" }],
  ["乗る", { suggestion: "追加する・含める・実行する" }],
  ["乗せる", { suggestion: "追加する・含める・実行する" }],
  ["割る", { suggestion: "下回る・分割する" }],
  ["撃つ", { suggestion: "送信する・実行する" }],
  ["捌く", { suggestion: "処理する" }],
  ["借りる", { suggestion: "利用する" }],
  // 「貼り付け」は操作の名称のため除外
  ["貼る", { suggestion: "記載する・添付する", termFollowers: ["付ける", "つける", "付け"] }],
  ["流す", { suggestion: "実行する・出力する・送信する" }],
  ["断る", { suggestion: "拒否する" }],
  ["許す", { suggestion: "許可する・受け入れる" }],
  ["差し込む", { suggestion: "挿入する・追加する" }],
  ["噛ませる", { suggestion: "間に配置する・経由させる" }],
  ["噛ます", { suggestion: "間に配置する・経由させる" }],
  ["生やす", { suggestion: "追加する・作成する" }],
  ["寄せる", { suggestion: "統合する・移動する" }],
  ["畳む", { suggestion: "統合する・削除する" }],
  ["剥がす", { suggestion: "削除する・除去する" }],
  ["潰す", { suggestion: "修正する・解消する・削除する" }],
  ["握る", { suggestion: "保持する・管理する" }],
  ["拾う", { suggestion: "取得する・検出する" }],
]);

// 主語・目的語を受けたときに、比喩・擬人化になりうる動作の動詞
const MOTION_VERBS = new Set([
  "引く", "通る", "響く", "抜ける", "抜く", "落ちる", "走る", "走らせる", "回す", "回る",
  "投げる", "吐く", "叩く", "刺さる", "刺す", "生える", "流れる", "噛む", "食う", "食べる",
  "飛ぶ", "掴む", "潰れる", "殺す", "死ぬ", "生きる", "育つ", "眠る", "溜まる", "溜める",
  "詰まる", "絡む", "漏れる", "溢れる", "折れる", "割れる", "崩れる", "背負う", "抱える", "担ぐ",
  "跨ぐ", "触る", "当たる", "当てる", "被る", "寄る", "逃がす", "逃げる", "捕まえる", "掬う",
  "汲む", "撫でる", "揉む", "締める", "壊れる", "焼く", "黙る", "崩す", "運ぶ", "住む",
  "語る", "守る", "届く",
]);

const SUBJECT_OR_OBJECT_PARTICLES = new Set(["が", "を", "に", "も", "は"]);

// 形容詞の「〜く、」のIPADICでの活用形は連用テ接続
const CONTINUATIVE_FORMS = new Set(["連用形", "連用テ接続"]);

const CONJUGATED_POS = new Set(["動詞", "形容詞"]);

const TE_PARTICLES = new Set(["て", "で"]);

const OPENING_PARENTHESES = new Set(["（", "("]);

const CLOSING_PARENTHESES = new Set(["）", ")"]);

const COMMA = "、";

export const CONFIRMED_CLAUSE_COUNT = 4;

export const NEEDS_JUDGMENT_CLAUSE_COUNT = 3;

const isVerb = (token: Readonly<KuromojiToken>): boolean => token.pos === "動詞";

const findingOf = (
  { token, offset }: PositionedToken,
  message: string,
): MorphologyFinding => ({
  offset,
  length: token.surface_form.length,
  message,
});

export const bannedVerbFindings = (
  tokens: PositionedToken[],
): MorphologyFinding[] => tokens.flatMap((current, index) => {
  const bannedVerb = BANNED_VERBS.get(current.token.basic_form);
  if (!isVerb(current.token) || bannedVerb === undefined) {
    return [];
  }
  const next = tokens[index + 1]?.token;
  const termFollowers = bannedVerb.termFollowers ?? [];
  if (next !== undefined && termFollowers.includes(next.basic_form)) {
    return [];
  }

  return [findingOf(current, `${current.token.surface_form} => ${bannedVerb.suggestion}`)];
});

export const motionVerbFindings = (
  tokens: PositionedToken[],
): MorphologyFinding[] => tokens.flatMap((current, index) => {
  const previous = tokens[index - 1]?.token;
  if (
    !isVerb(current.token)
    || !MOTION_VERBS.has(current.token.basic_form)
    || previous?.pos !== "助詞"
    || !SUBJECT_OR_OBJECT_PARTICLES.has(previous.surface_form)
  ) {
    return [];
  }

  return [findingOf(current, `${previous.surface_form}${current.token.surface_form} => （比喩・擬人化であれば、実際の処理・事象を表す動詞に書き換える）`)];
});

const isClauseBoundary = (
  token: Readonly<KuromojiToken>,
  next: Readonly<KuromojiToken> | undefined,
): boolean => next?.surface_form === COMMA
  && (
    // 連用中止は、連用形の直後に読点が続く場合
    (
      CONJUGATED_POS.has(token.pos)
      && CONTINUATIVE_FORMS.has(token.conjugated_form)
    )
    || (token.pos_detail_1 === "接続助詞" && TE_PARTICLES.has(token.surface_form))
  );

export const countClauses = (
  tokens: readonly Readonly<KuromojiToken>[],
): number => tokens.reduce(
  ({ depth, count }, token, index) => {
    if (OPENING_PARENTHESES.has(token.surface_form)) {
      return { depth: depth + 1, count };
    }
    if (CLOSING_PARENTHESES.has(token.surface_form)) {
      return { depth: Math.max(depth - 1, 0), count };
    }

    // 括弧の中の列挙は、文の節の数の対象外
    const isBoundary = depth === 0
      && isClauseBoundary(token, tokens[index + 1]);

    return { depth, count: isBoundary ? count + 1 : count };
  },
  { depth: 0, count: 1 },
).count;

export const describeClauseCount = (count: number): string => `連用中止で${count}つの節を続けている => （文を分割し、1文に1つの主張を書く）`;
