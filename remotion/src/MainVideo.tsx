import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { wipe } from "@remotion/transitions/wipe";
import { loadFont as loadHeading } from "@remotion/google-fonts/Oswald";
import { loadFont as loadBody } from "@remotion/google-fonts/Inter";
import { C } from "./theme";
import { Intro } from "./scenes/Intro";
import { Home } from "./scenes/Home";
import { Jobs } from "./scenes/Jobs";
import { Dispatch } from "./scenes/Dispatch";
import { Apparel } from "./scenes/Apparel";
import { TimeOff } from "./scenes/TimeOff";
import { Referrals } from "./scenes/Referrals";
import { Outro } from "./scenes/Outro";

loadHeading();
loadBody();

const Grain = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const drift = interpolate(frame, [0, 870], [0, 60]);
  return (
    <svg width={width} height={height} style={{ position: "absolute", inset: 0, opacity: 0.06, mixBlendMode: "overlay", pointerEvents: "none" }}>
      <defs>
        <pattern id="dot" x={drift} y={0} width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.6" fill="#fff" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#dot)" />
    </svg>
  );
};

const HazardStripe = () => {
  const frame = useCurrentFrame();
  const offset = (frame * 1.2) % 60;
  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 36,
        backgroundImage: `repeating-linear-gradient(135deg, ${C.yellow} 0 30px, ${C.black} 30px 60px)`,
        backgroundPosition: `${offset}px 0`,
      }}
    />
  );
};

export const MainVideo = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.ink, fontFamily: "Inter, sans-serif" }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={75}><Intro /></TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={springTiming({ config: { damping: 200 }, durationInFrames: 12 })} />

        <TransitionSeries.Sequence durationInFrames={120}><Home /></TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={wipe({ direction: "from-right" })} timing={springTiming({ config: { damping: 200 }, durationInFrames: 18 })} />

        <TransitionSeries.Sequence durationInFrames={130}><Jobs /></TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={wipe({ direction: "from-right" })} timing={springTiming({ config: { damping: 200 }, durationInFrames: 18 })} />

        <TransitionSeries.Sequence durationInFrames={120}><Dispatch /></TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={wipe({ direction: "from-right" })} timing={springTiming({ config: { damping: 200 }, durationInFrames: 18 })} />

        <TransitionSeries.Sequence durationInFrames={110}><Apparel /></TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={wipe({ direction: "from-right" })} timing={springTiming({ config: { damping: 200 }, durationInFrames: 18 })} />

        <TransitionSeries.Sequence durationInFrames={120}><TimeOff /></TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={wipe({ direction: "from-right" })} timing={springTiming({ config: { damping: 200 }, durationInFrames: 18 })} />

        <TransitionSeries.Sequence durationInFrames={110}><Referrals /></TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={springTiming({ config: { damping: 200 }, durationInFrames: 18 })} />

        <TransitionSeries.Sequence durationInFrames={90}><Outro /></TransitionSeries.Sequence>
      </TransitionSeries>
      <Grain />
      <HazardStripe />
    </AbsoluteFill>
  );
};
