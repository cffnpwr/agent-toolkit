import { describe, expect, it } from "bun:test";

import { tokenize } from "kuromojin";

import type { MorphologyFinding, PositionedToken } from "./morphology.ts";

import { bannedVerbFindings, countClauses, motionVerbFindings } from "./morphology.ts";

const positionedTokensOf = async (
  text: string,
): Promise<PositionedToken[]> => (await tokenize(text))
  .map((token) => ({ token, offset: token.word_position - 1 }));

describe("bannedVerbFindings", () => {
  it.each<{ text: string; want: MorphologyFinding[]; }>([
    { text: "設定を足した。", want: [{ offset: 3, length: 2, message: "足し => 追加する" }] },
    { text: "値を足さない。", want: [{ offset: 2, length: 2, message: "足さ => 追加する" }] },
    { text: "キャッシュが効かず遅い。", want: [{ offset: 6, length: 2, message: "効か => （何が良くなったかを具体的に書く）" }] },
    { text: "権限が要ります。", want: [{ offset: 3, length: 2, message: "要り => 必要である" }] },
    { text: "ヘッダーに乗せて送る。", want: [{ offset: 5, length: 2, message: "乗せ => 追加する・含める・実行する" }] },
    { text: "画像を貼る。", want: [{ offset: 3, length: 2, message: "貼る => 記載する・添付する" }] },
  ])("[positive] 「$text」のとき、比喩的な動詞を活用形によらず検出する", async ({ text, want }) => {
    const findings = bannedVerbFindings(await positionedTokensOf(text));

    expect(findings).toEqual(want);
  });

  it.each([
    { name: "切り捨て", text: "端数を切り捨てる。" },
    { name: "通し番号", text: "通し番号を振る。" },
    { name: "踏まえる", text: "結果を踏まえる。" },
    { name: "割り当て", text: "割り当てを変更する。" },
    { name: "割り込み", text: "割り込みを処理する。" },
    { name: "貼り付け(名詞)", text: "画像の貼り付けを行う。" },
    { name: "貼り付け(動詞)", text: "画像を貼り付けて送る。" },
    { name: "満足し", text: "条件を満足し、終了する。" },
    { name: "共通し", text: "処理が共通している。" },
  ])("[negative] $nameのような用語・熟語は検出しない", async ({ text }) => {
    const findings = bannedVerbFindings(await positionedTokensOf(text));

    expect(findings).toEqual([]);
  });
});

describe("motionVerbFindings", () => {
  it.each<{ text: string; want: MorphologyFinding[]; }>([
    { text: "処理が走る。", want: [{ offset: 3, length: 2, message: "が走る => （比喩・擬人化であれば、実際の処理・事象を表す動詞に書き換える）" }] },
    { text: "ログを吐く。", want: [{ offset: 3, length: 2, message: "を吐く => （比喩・擬人化であれば、実際の処理・事象を表す動詞に書き換える）" }] },
    { text: "設定は生きている。", want: [{ offset: 3, length: 2, message: "は生き => （比喩・擬人化であれば、実際の処理・事象を表す動詞に書き換える）" }] },
  ])("[positive] 「$text」のとき、助詞の直後の動作の動詞を検出する", async ({ text, want }) => {
    const findings = motionVerbFindings(await positionedTokensOf(text));

    expect(findings).toEqual(want);
  });

  it.each([
    { name: "助詞の直後でない", text: "車が速く走る。" },
    { name: "確定の規則で検出する動詞", text: "値を拾う。" },
    { name: "動作の動詞でない", text: "ファイルを読む。" },
  ])("[negative] $nameとき検出しない", async ({ text }) => {
    const findings = motionVerbFindings(await positionedTokensOf(text));

    expect(findings).toEqual([]);
  });
});

describe("countClauses", () => {
  it.each([
    { name: "動詞の連用形と読点が3つ続く", text: "ファイルを読み、内容を解析し、結果を整形し、標準出力へ書き込みます。", want: 4 },
    { name: "て・での後に読点が続く", text: "ファイルを読み込んで、形式を変換して、保存します。", want: 3 },
    { name: "形容詞の連用形(連用テ接続)と読点が続く", text: "値が高く、処理が遅い。", want: 2 },
    { name: "格助詞の「で」と読点が続く", text: "東京で、会議を開く。", want: 1 },
    { name: "括弧の中で連用形と読点が続く", text: "設定（読み込み、変換し、保存し、出力）をします。", want: 1 },
  ])("[positive] $nameとき$want節と数える", async ({ text, want }) => {
    const count = countClauses(await tokenize(text));

    expect(count).toBe(want);
  });
});
