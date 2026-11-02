import { type } from "arktype";

export const finding = type({
  "+": "reject",
  rule: "string",
  quote: "string",
  reason: "string",
  suggestion: "string",
});

export const reviewOutput = type({
  "+": "reject",
  findings: finding.array(),
});

export const reviewOutputJsonSchema = JSON.stringify(
  reviewOutput.toJsonSchema({ dialect: null }),
);

export type Finding = typeof finding.infer;
