import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Vibration,
  Platform,
  StatusBar,
  useWindowDimensions,
} from "react-native";

/** Durations (ms) */
const TEN_MINUTES = 10 * 60 * 1000;
const TWO_MINUTES = 2 * 60 * 1000;
const FIFTEEN_SECONDS = 15 * 1000;
const TEN_SECONDS = 10 * 1000;
const TICK_MS = 100;

/** Root app renders two independent clocks side-by-side */
export default function App() {
  const { width, height } = useWindowDimensions();
  const landscape = width >= height;

  return (
    <View style={styles.root}>
      <StatusBar hidden />

      <View style={[styles.row, !landscape && { flexDirection: "column" }]}>
        <ClockPanel title="CLOCK A" />
        <ClockPanel title="CLOCK B" />
      </View>
    </View>
  );
}

/** A reusable panel: one game clock + one shot clock */
function ClockPanel({ title }) {
  const [isRunning, setIsRunning] = useState(false);
  const [mainRemaining, setMainRemaining] = useState(TEN_MINUTES);
  const [shotRemaining, setShotRemaining] = useState(FIFTEEN_SECONDS);

  // We derive current reset duration based on the main clock,
  // BUT we do NOT clamp an in-progress shot when crossing 2:00.
  const currentShotResetDuration =
    mainRemaining <= TWO_MINUTES ? TEN_SECONDS : FIFTEEN_SECONDS;

  const lastTickRef = useRef(null);

  const toggleRun = () => setIsRunning((r) => !r);

  const resetAll = () => {
    setIsRunning(false);
    setMainRemaining(TEN_MINUTES);
    setShotRemaining(FIFTEEN_SECONDS);
    lastTickRef.current = null;
  };

  const resetShot = () => setShotRemaining(currentShotResetDuration);

  const addShot = (ms) =>
    setShotRemaining((t) => Math.max(0, Math.min(60_000, t + ms)));

  const fmtMain = useMemo(() => formatMMSS(mainRemaining), [mainRemaining]);
  const fmtShot = useMemo(() => formatSS(shotRemaining), [shotRemaining]);

  /** Timer loop with drift correction */
  useEffect(() => {
    if (!isRunning) {
      lastTickRef.current = null;
      return;
    }

    let cancelled = false;
    let timerId = null;

    const tick = () => {
      if (cancelled) return;
      const now = Date.now();
      if (lastTickRef.current == null) lastTickRef.current = now;

      const elapsed = now - lastTickRef.current;
      if (elapsed >= TICK_MS) {
        setMainRemaining((prev) => Math.max(0, prev - elapsed));
        setShotRemaining((prev) => Math.max(0, prev - elapsed));
        lastTickRef.current = now;
      }
      timerId = setTimeout(tick, TICK_MS / 2);
    };

    timerId = setTimeout(tick, TICK_MS / 2);
    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
    };
  }, [isRunning]);

  /** Main clock end */
  useEffect(() => {
    if (mainRemaining === 0 && isRunning) {
      setIsRunning(false);
      vibe(800);
    }
  }, [mainRemaining, isRunning]);

  /** Shot clock end → auto reset to the *current* rule-based duration.
   * IMPORTANT: We do NOT clamp when crossing 2:00 — this only affects future resets.
   */
  useEffect(() => {
    if (shotRemaining === 0 && isRunning && mainRemaining > 0) {
      vibe(200);
      const id = setTimeout(() => {
        setShotRemaining(currentShotResetDuration);
      }, 150);
      return () => clearTimeout(id);
    }
  }, [shotRemaining, isRunning, mainRemaining, currentShotResetDuration]);

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>{title}</Text>

      {/* Game clock */}
      <View style={styles.card}>
        <Text style={styles.label}>GAME CLOCK</Text>
        <Text
          style={[
            styles.mainTime,
            mainRemaining <= 10_000 ? styles.urgent : null,
          ]}
        >
          {fmtMain}
        </Text>
        <View style={styles.controlsRow}>
          <Button onPress={toggleRun} text={isRunning ? "Pause" : "Start"} wide />
          <Button onPress={resetAll} text="Reset All" />
        </View>
      </View>

      {/* Shot clock */}
      <View style={styles.card}>
        <Text style={styles.label}>
          SHOT CLOCK{" "}
          <Text style={styles.modeTag}>
            ({currentShotResetDuration === TEN_SECONDS ? "10s mode" : "15s mode"})
          </Text>
        </Text>
        <Pressable onPress={resetShot}>
          <Text
            style={[
              styles.shotTime,
              shotRemaining <= 5_000 ? styles.urgent : null,
              shotRemaining === 0 ? styles.blink : null,
            ]}
          >
            {fmtShot}
          </Text>
        </Pressable>
        <View style={styles.controlsRow}>
          <Button onPress={resetShot} text={`Reset ${currentShotResetDuration / 1000}s`} />
          <Button onPress={() => addShot(5_000)} text="+5s" />
          <Button onPress={() => addShot(-5_000)} text="-5s" />
        </View>
      </View>
    </View>
  );
}

/** Helpers */
function formatMMSS(ms) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${pad(m)}:${pad(s)}`;
}
function formatSS(ms) {
  const total = Math.ceil(ms / 1000);
  return `${pad(total)}`;
}
function pad(n) {
  return n < 10 ? `0${n}` : `${n}`;
}
function vibe(ms) {
  if (Platform.OS !== "web") Vibration.vibrate(ms);
}

/** Small button component */
function Button({ text, onPress, wide }) {
  return (
    <Pressable onPress={onPress} style={[styles.btn, wide && styles.btnWide]}>
      <Text style={styles.btnTxt}>{text}</Text>
    </Pressable>
  );
}

/** Styles */
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    padding: 16,
  },
  row: {
    flex: 1,
    flexDirection: "row",
    gap: 16,
  },
  panel: {
    flex: 1,
    backgroundColor: "#101010",
    borderRadius: 24,
    padding: 16,
    justifyContent: "center",
  },
  title: {
    color: "#e6e6e6",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 8,
    textAlign: "center",
  },
  card: {
    alignItems: "center",
    borderRadius: 20,
    paddingVertical: 18,
    backgroundColor: "#171717",
    marginBottom: 14,
  },
  label: {
    color: "#bdbdbd",
    fontSize: 18,
    marginBottom: 6,
    letterSpacing: 1.5,
  },
  modeTag: {
    color: "#8a8a8a",
    fontSize: 16,
  },
  mainTime: {
    color: "white",
    fontSize: 110,
    fontWeight: "900",
    letterSpacing: 2,
  },
  shotTime: {
    color: "white",
    fontSize: 96,
    fontWeight: "900",
    letterSpacing: 3,
    marginVertical: 4,
  },
  controlsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
  },
  btn: {
    backgroundColor: "#222",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2f2f2f",
  },
  btnWide: {
    minWidth: 150,
    alignItems: "center",
  },
  btnTxt: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  urgent: {
    color: "#ff5252",
  },
  blink: {
    textShadowColor: "#ff5252",
    textShadowRadius: 12,
  },
});
