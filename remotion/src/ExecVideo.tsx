import { AbsoluteFill } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { wipe } from "@remotion/transitions/wipe";
import { fade } from "@remotion/transitions/fade";
import { loadFont } from "@remotion/google-fonts/Carlito";
import { PersistentAccents, PersistentBackground } from "./components/Layers";
import { SceneExecIntro } from "./scenes/SceneExecIntro";
import { Scene2 } from "./scenes/Scene2";
import { UiIntegrations } from "./scenes/UiIntegrations";
import { UiLog } from "./scenes/UiLog";
import { UiCoach } from "./scenes/UiCoach";
import { UiDashboard } from "./scenes/UiDashboard";
import { UiTicket } from "./scenes/UiTicket";
import { UiHandoff } from "./scenes/UiHandoff";
import { UiOversight } from "./scenes/UiOversight";
import { SceneImpact } from "./scenes/SceneImpact";
import { Scene6 } from "./scenes/Scene6";

const { fontFamily } = loadFont("normal", { weights: ["400", "700"], subsets: ["latin"] });

const T = (frames: number) => springTiming({ config: { damping: 200 }, durationInFrames: frames });

const D = [130, 90, 300, 230, 300, 190, 300, 190, 170, 160, 120];
export const EXEC_TOTAL = D.reduce((a, b) => a + b, 0) - 10 * 22;

export const ExecVideo: React.FC = () => (
  <AbsoluteFill style={{ ["--brand-font" as string]: fontFamily, fontFamily }}>
    <PersistentBackground />
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={D[0]}>
        <SceneExecIntro />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={wipe({ direction: "from-left" })} timing={T(22)} />
      <TransitionSeries.Sequence durationInFrames={D[1]}>
        <Scene2 />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={wipe({ direction: "from-bottom" })} timing={T(22)} />
      <TransitionSeries.Sequence durationInFrames={D[2]}>
        <UiIntegrations />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={T(22)} />
      <TransitionSeries.Sequence durationInFrames={D[3]}>
        <UiLog />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={wipe({ direction: "from-right" })} timing={T(22)} />
      <TransitionSeries.Sequence durationInFrames={D[4]}>
        <UiCoach />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={T(22)} />
      <TransitionSeries.Sequence durationInFrames={D[5]}>
        <UiDashboard />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={wipe({ direction: "from-right" })} timing={T(22)} />
      <TransitionSeries.Sequence durationInFrames={D[6]}>
        <UiTicket />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={T(22)} />
      <TransitionSeries.Sequence durationInFrames={D[7]}>
        <UiHandoff />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={wipe({ direction: "from-left" })} timing={T(22)} />
      <TransitionSeries.Sequence durationInFrames={D[8]}>
        <UiOversight />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={T(22)} />
      <TransitionSeries.Sequence durationInFrames={D[9]}>
        <SceneImpact />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={T(22)} />
      <TransitionSeries.Sequence durationInFrames={D[10]}>
        <Scene6 />
      </TransitionSeries.Sequence>
    </TransitionSeries>
    <PersistentAccents />
  </AbsoluteFill>
);
