import { AbsoluteFill } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { wipe } from "@remotion/transitions/wipe";
import { fade } from "@remotion/transitions/fade";
import { loadFont } from "@remotion/google-fonts/Carlito";
import { PersistentAccents, PersistentBackground } from "./components/Layers";
import { Scene1 } from "./scenes/Scene1";
import { Scene2 } from "./scenes/Scene2";
import { Scene3 } from "./scenes/Scene3";
import { Scene4 } from "./scenes/Scene4";
import { Scene5 } from "./scenes/Scene5";
import { Scene6 } from "./scenes/Scene6";

const { fontFamily } = loadFont("normal", { weights: ["400", "700"], subsets: ["latin"] });

const T = (frames: number) => springTiming({ config: { damping: 200 }, durationInFrames: frames });

export const MainVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ ["--brand-font" as string]: fontFamily, fontFamily }}>
      <PersistentBackground />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={140}>
          <Scene1 />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={wipe({ direction: "from-left" })} timing={T(24)} />
        <TransitionSeries.Sequence durationInFrames={110}>
          <Scene2 />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={wipe({ direction: "from-bottom" })} timing={T(24)} />
        <TransitionSeries.Sequence durationInFrames={150}>
          <Scene3 />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={wipe({ direction: "from-left" })} timing={T(24)} />
        <TransitionSeries.Sequence durationInFrames={185}>
          <Scene4 />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={wipe({ direction: "from-right" })} timing={T(24)} />
        <TransitionSeries.Sequence durationInFrames={140}>
          <Scene5 />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={T(22)} />
        <TransitionSeries.Sequence durationInFrames={120}>
          <Scene6 />
        </TransitionSeries.Sequence>
      </TransitionSeries>
      <PersistentAccents />
    </AbsoluteFill>
  );
};
