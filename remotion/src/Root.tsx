import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";
import { EXEC_TOTAL, ExecVideo } from "./ExecVideo";
import { TRAINING_TOTAL, TrainingVideo } from "./TrainingVideo";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="main" component={MainVideo} durationInFrames={1422} fps={30} width={1920} height={1080} />
    <Composition id="exec" component={ExecVideo} durationInFrames={EXEC_TOTAL} fps={30} width={1920} height={1080} />
    <Composition id="training" component={TrainingVideo} durationInFrames={TRAINING_TOTAL} fps={30} width={1920} height={1080} />
  </>
);
