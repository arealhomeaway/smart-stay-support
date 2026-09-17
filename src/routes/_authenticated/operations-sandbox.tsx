import { createFileRoute } from "@tanstack/react-router";
import { OperationsSandbox } from "@/components/operations/OperationsSandbox";

export const Route = createFileRoute("/_authenticated/operations-sandbox")({
  component: OperationsSandbox,
});
