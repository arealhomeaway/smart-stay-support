import { AbsoluteFill } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { wipe } from "@remotion/transitions/wipe";
import { fade } from "@remotion/transitions/fade";
import { loadFont } from "@remotion/google-fonts/Carlito";
import { PersistentAccents, PersistentBackground } from "./components/Layers";
import { TrainingIntro } from "./scenes/TrainingIntro";
import { PortalMap } from "./scenes/PortalMap";
import { UiHub } from "./scenes/UiHub";
import { UiIntegrations } from "./scenes/UiIntegrations";
import { UiLog } from "./scenes/UiLog";
import { UiCoach } from "./scenes/UiCoach";
import { UiTicket } from "./scenes/UiTicket";
import { UiVendorJob } from "./scenes/UiVendorJob";
import { UiVendorScore } from "./scenes/UiVendorScore";
import { UiHandoff } from "./scenes/UiHandoff";
import { UiOwner } from "./scenes/UiOwner";
import { UiQuarterly } from "./scenes/UiQuarterly";
import { UiLibrary } from "./scenes/UiLibrary";
import { UiOversight } from "./scenes/UiOversight";
import { UiCommand } from "./scenes/UiCommand";
import { DayInLife } from "./scenes/DayInLife";
import { TrainingOutro } from "./scenes/TrainingOutro";

const { fontFamily } = loadFont("normal", { weights: ["400", "700"], subsets: ["latin"] });

const OVERLAP = 22;
const T = springTiming({ config: { damping: 200 }, durationInFrames: OVERLAP });

/** Slow, chapter-paced training cut. Each screen holds long enough to read. */
const CHAPTERS: { c: React.FC; d: number; t: "wipeL" | "wipeR" | "wipeB" | "fade" }[] = [
  { c: TrainingIntro, d: 210, t: "wipeL" },
  { c: PortalMap, d: 330, t: "wipeB" },
  { c: UiHub, d: 240, t: "fade" },
  { c: UiIntegrations, d: 320, t: "fade" },
  { c: UiLog, d: 280, t: "fade" },
  { c: UiCoach, d: 340, t: "wipeR" },
  { c: UiTicket, d: 340, t: "fade" },
  { c: UiVendorJob, d: 300, t: "fade" },
  { c: UiVendorScore, d: 300, t: "wipeR" },
  { c: UiHandoff, d: 240, t: "fade" },
  { c: UiOwner, d: 300, t: "fade" },
  { c: UiQuarterly, d: 260, t: "wipeL" },
  { c: UiLibrary, d: 240, t: "fade" },
  { c: UiOversight, d: 230, t: "fade" },
  { c: UiCommand, d: 280, t: "wipeB" },
  { c: DayInLife, d: 300, t: "fade" },
  { c: TrainingOutro, d: 240, t: "fade" },
];

const presentationFor = (t: string) =>
  t === "fade"
    ? fade()
    : wipe({ direction: t === "wipeL" ? "from-left" : t === "wipeR" ? "from-right" : "from-bottom" });

export const TRAINING_TOTAL =
  CHAPTERS.reduce((a, b) => a + b.d, 0) - (CHAPTERS.length - 1) * OVERLAP;

export const TrainingVideo: React.FC = () => {
  const children: React.ReactNode[] = [];
  CHAPTERS.forEach(({ c: Comp, d, t }, i) => {
    children.push(
      <TransitionSeries.Sequence key={`s${i}`} durationInFrames={d}>
        <Comp />
      </TransitionSeries.Sequence>,
    );
    if (i < CHAPTERS.length - 1) {
      children.push(
        <TransitionSeries.Transition key={`t${i}`} presentation={presentationFor(t)} timing={T} />,
      );
    }
  });

  return (
    <AbsoluteFill style={{ ["--brand-font" as string]: fontFamily, fontFamily }}>
      <PersistentBackground />
      <TransitionSeries>{children}</TransitionSeries>
      <PersistentAccents />
    </AbsoluteFill>
  );
};
