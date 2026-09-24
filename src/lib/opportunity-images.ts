/**
 * Controlled card imagery for Opportunities. A fixed set of image keys: no
 * generated or random images. Library templates pick a key; ARHA
 * Opportunities choose one from what they are about.
 */
import market from "@/assets/opportunity/market.jpg";
import localArea from "@/assets/opportunity/local_area.jpg";
import guestJourney from "@/assets/opportunity/guest_journey.jpg";
import events from "@/assets/opportunity/events.jpg";
import houseNotes from "@/assets/opportunity/house_notes.jpg";
import remoteWork from "@/assets/opportunity/remote_work.jpg";
import listing from "@/assets/opportunity/listing.jpg";
import education from "@/assets/opportunity/education.jpg";
import floorPlan from "@/assets/opportunity/floor_plan.jpg";
import design from "@/assets/opportunity/design.jpg";
import project from "@/assets/opportunity/project.jpg";

export const OPPORTUNITY_IMAGES = {
  market: { label: "Market research", src: market },
  local_area: { label: "Local area & dining", src: localArea },
  guest_journey: { label: "Guest journey", src: guestJourney },
  events: { label: "Seasonal events", src: events },
  house_notes: { label: "House notes", src: houseNotes },
  remote_work: { label: "Remote work", src: remoteWork },
  listing: { label: "Listing", src: listing },
  education: { label: "Education", src: education },
  floor_plan: { label: "Floor plans", src: floorPlan },
  design: { label: "Design", src: design },
  project: { label: "Home project", src: project },
} as const;
export type OpportunityImageKey = keyof typeof OPPORTUNITY_IMAGES;

export const LIBRARY_CATEGORIES = [
  { code: "market", label: "Market" },
  { code: "local_area", label: "Local area" },
  { code: "guest_experience", label: "Guest experience" },
  { code: "property_knowledge", label: "Property knowledge" },
  { code: "listing", label: "Listing" },
  { code: "education", label: "Education" },
  { code: "design_inspiration", label: "Design inspiration" },
] as const;

export function imageFor(key: string | null | undefined) {
  return (key && key in OPPORTUNITY_IMAGES ? OPPORTUNITY_IMAGES[key as OpportunityImageKey] : OPPORTUNITY_IMAGES.project).src;
}

/**
 * ARHA Opportunity cover: what the Opportunity is about (floor plans, design),
 * then the home's own photo, then the controlled project image.
 */
export function arhaCover(title: string, resourceLabels: string[], propertyPhoto: string | null) {
  const text = [title, ...resourceLabels].join(" ").toLowerCase();
  if (/floor ?plan|layout/.test(text)) return OPPORTUNITY_IMAGES.floor_plan.src;
  if (/mood ?board|design|furnish|staging|decor/.test(text)) return OPPORTUNITY_IMAGES.design.src;
  if (/listing|photo/.test(text)) return OPPORTUNITY_IMAGES.listing.src;
  return propertyPhoto ?? OPPORTUNITY_IMAGES.project.src;
}

/** Words that mark an optional idea as overlapping an ARHA Opportunity's subject. */
const TOPIC_WORDS: Record<string, RegExp> = {
  design_inspiration: /design|mood ?board|floor ?plan|furnish|decor/,
  listing: /listing/,
  local_area: /local area|dining|guidebook/,
  property_knowledge: /house notes/,
};

/** Suppress an optional idea when an active ARHA Opportunity on that home covers the same topic. */
export function duplicatesArha(category: string, title: string, arhaTitles: string[]) {
  const words = TOPIC_WORDS[category];
  const t = title.toLowerCase();
  return arhaTitles.some((a) => {
    const at = a.toLowerCase();
    if (at === t) return true;
    return words ? words.test(at) && words.test(t) : false;
  });
}
