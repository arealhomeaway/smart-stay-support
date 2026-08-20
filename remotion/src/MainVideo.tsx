import { AbsoluteFill } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { wipe } from "@remotion/transitions/wipe";
import { fade } from "@remotion/transitions/fade";
import { loadFont } from "@remotion/google-fonts/Carlito";
import { PersistentAccents, PersistentBackground } from "./components/Layers";
import { Scene1 } from "./scenes/Scene1";
import { Scene2 } from "./scenes/Scene2";
import { Scene6 } from "./scenes/Scene6";
import { UiLog } from "./scenes/UiLog";
import { UiDashboard } from "./scenes/UiDashboard";
import { UiTicket } from "./scenes/UiTicket";
import { UiHandoff } from "./scenes/UiHandoff";
import { UiOversight } from "./scenes/UiOversight";
import { UiLibrary } from "./scenes/UiLibrary";

const { fontFamily } = loadFont("normal", { weights: ["400", "700"], subsets: ["latin"] });

const T = (frames: number) => springTiming({ config: { damping: 200 }, durationInFrames: frames });

export const TOTAL = 1422;

export const MainVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ ["--brand-font" as string]: fontFamily, fontFamily }}>
      <PersistentBackground />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={110}>
          <Scene1 />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={wipe({ direction: "from-left" })} timing={T(22)} />
        <TransitionSeries.Sequence durationInFrames={90}>
          <Scene2 />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={wipe({ direction: "from-bottom" })} timing={T(22)} />
        <TransitionSeries.Sequence durationInFrames={230}>
          <UiLog />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={T(22)} />
        <TransitionSeries.Sequence durationInFrames={190}>
          <UiDashboard />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={wipe({ direction: "from-right" })} timing={T(22)} />
        <TransitionSeries.Sequence durationInFrames={300}>
          <UiTicket />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={T(22)} />
        <TransitionSeries.Sequence durationInFrames={190}>
          <UiHandoff />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={wipe({ direction: "from-left" })} timing={T(22)} />
        <TransitionSeries.Sequence durationInFrames={170}>
          <UiOversight />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={T(22)} />
        <TransitionSeries.Sequence durationInFrames={208}>
          <UiLibrary />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={T(22)} />
        <TransitionSeries.Sequence durationInFrames={110}>
          <Scene6 />
        </TransitionSeries.Sequence>
      </TransitionSeries>
      <PersistentAccents />
    </AbsoluteFill>
  );
};
