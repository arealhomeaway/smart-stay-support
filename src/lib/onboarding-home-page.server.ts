/**
 * Add task to this stage (Part 1, 1.7): one one-off Task on one home, written as the
 * signed-in person (RLS applies), checked here against the same who-may-act rule the page
 * shows, logged with who and when. Never touches the plan template.
 */
import { canAddOneOff, oneOffColumns, stageIndexOf, type AddViewer, type Whose } from "@/lib/onboarding-home-page";

type Db = {
  from: (t: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

export type AddStageTaskInput = { propertyId: string; stage: string; title: string; whose: Whose; dueOn: string | null };

export const ADD_REFUSED = "You can add Tasks only on your own homes or for your own work.";

export async function addStageTask(
  sb: Db,
  uid: string,
  viewer: Omit<AddViewer, "userId">,
  input: AddStageTaskInput,
  audit: (entry: { actorId: string; action: string; entityType: string; entityId: string; entityLabel: string; after: unknown }) => Promise<void>,
): Promise<{ id: string }> {
  if (!canAddOneOff({ ...viewer, userId: uid }, input.whose)) throw new Error(ADD_REFUSED);
  if (stageIndexOf(input.stage) < 0) throw new Error("Pick one of the six stages.");
  const title = input.title.trim();
  if (title.length < 3) throw new Error("Say what needs doing (at least 3 characters).");
  const home = await sb.from("properties").select("id, is_demo, handoff_accepted_at, lifecycle_status").eq("id", input.propertyId).maybeSingle();
  if (home.error) throw home.error;
  if (!home.data) throw new Error("This home could not be found.");
  if (home.data.handoff_accepted_at || ["handoff_requested", "active_operations"].includes(home.data.lifecycle_status ?? ""))
    throw new Error("Operations has accepted this home, so its onboarding plan is locked.");
  if (input.whose.kind === "person") {
    const person = await sb.from("profiles").select("id").eq("id", input.whose.personId).maybeSingle();
    if (person.error) throw person.error;
    if (!person.data) throw new Error("That teammate could not be found.");
  }
  const cols = oneOffColumns(input.whose, uid);
  const row = {
    property_id: input.propertyId,
    stage: input.stage,
    title,
    detail: null,
    ...cols,
    due_on: input.dueOn,
    status: "open",
    requires_owner_approval: false,
    owner_approval_status: "not_required",
    evidence_required: false,
    blocks_handoff: true,
    depends_on: [],
    created_by: uid,
    is_demo: Boolean(home.data.is_demo),
  };
  const saved = await sb.from("onboarding_tasks").insert(row).select("id, created_at").single();
  if (saved.error) throw saved.error;
  if (!saved.data) throw new Error("The Task could not be added.");
  await audit({
    actorId: uid,
    action: "onboarding_task_created",
    entityType: "onboarding_task",
    entityId: saved.data.id,
    entityLabel: title,
    after: { ...row, one_off: true, added_from: "property_page" },
  });
  return { id: saved.data.id };
}
