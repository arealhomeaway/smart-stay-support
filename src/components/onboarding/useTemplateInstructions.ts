/**
 * The instructions box on an onboarding work order follows the chosen Breezeway template's own
 * instructions until the person edits it; whatever is in the box at send is what Breezeway gets.
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { onboardingTemplateInstructionsFn } from "@/lib/onboarding-kati.functions";

export function useTemplateInstructions(templateId: number | null, enabled = true) {
  const fn = useServerFn(onboardingTemplateInstructionsFn);
  const [text, setText] = useState("");
  const [edited, setEdited] = useState(false);
  const q = useQuery({
    queryKey: ["bz-template-instructions", templateId],
    queryFn: () => fn({ data: { templateId: templateId! } }),
    enabled: enabled && templateId !== null,
    staleTime: 10 * 60_000,
    retry: false,
  });
  useEffect(() => {
    if (!enabled || edited) return;
    if (templateId === null) setText("");
    else if (q.data) setText(q.data.text ?? "");
  }, [enabled, edited, templateId, q.data]);
  const loading = enabled && templateId !== null && !edited && q.isFetching;
  const hint = !enabled || templateId === null || edited
    ? null
    : q.isFetching
      ? "Loading the template's instructions from Breezeway…"
      : q.error
        ? "Could not read this template's instructions from Breezeway."
        : q.data && !q.data.text
          ? "This template has no instructions in Breezeway."
          : null;
  return {
    text,
    setText: (v: string) => { setEdited(true); setText(v); },
    loading,
    hint,
  };
}
