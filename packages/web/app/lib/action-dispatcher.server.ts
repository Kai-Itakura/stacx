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
  console.log("🔥", submission);
  if (submission.status !== "success") {
    return submission.reply();
  }

  const payload = submission.value;
  const handler = handlers[payload.intent as keyof typeof handlers];
  return handler(payload as never, submission.reply);
}

export function unexpectedErrorSubmissionReply(submissionReply: SubmissionReply): SubmissionResult {
  return submissionReply({ formErrors: ["不明なエラーが発生しました。"] });
}
