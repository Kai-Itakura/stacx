import type { SubmissionResult } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import type z from "zod";

type ZodUnionWithIntent = z.ZodDiscriminatedUnion<z.ZodType<{ intent: string }>[]>;
type WithIntent = z.infer<ZodUnionWithIntent>;

type SubmissionReply = (options?: { formErrors?: string[] }) => SubmissionResult;

type ActionResult = Response | SubmissionResult;

export type ActionHandlers<Payload extends WithIntent> = {
  [K in Payload["intent"]]: (
    payload: Extract<Payload, { intent: K }>,
    submissionReply: SubmissionReply,
  ) => Promise<ActionResult>;
};

export async function handleAction<Schema extends ZodUnionWithIntent>(
  request: Request,
  schema: Schema,
  handlers: ActionHandlers<z.infer<Schema>>,
) {
  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema });
  if (submission.status !== "success") {
    return submission.reply();
  }

  const payload = submission.value;
  // 制約の z.ZodType<{ intent: string }> が intent を string に潰すため、payload.intent は
  // リテラルの union に解決されない。そのままでは handlers の添字に使えないのでキーを広げる。
  const handler = handlers[payload.intent as keyof typeof handlers];
  // ユニオンの添字なので handler は関数型の union になり、引数型は各 payload の交差
  // （intent が衝突するため到達不能）になる。never はあらゆる型に代入できるのでこれを満たす。
  // 実行時の対応は payload.intent で引いたことが担保している。
  return handler(payload as never, submission.reply);
}

export function unexpectedErrorSubmissionReply(submissionReply: SubmissionReply): SubmissionResult {
  return submissionReply({ formErrors: ["不明なエラーが発生しました。"] });
}
