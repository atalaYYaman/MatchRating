import { MatchPhase, PHASE_LABEL } from "@/lib/matchStatus";

// Her fazin kendine ait bir dolgu agirligi var, boylece listede goz atarken
// ayirt edilebiliyorlar. Amber bilerek kullanilmiyor: o renk yalnizca
// "senden bir sey bekleniyor" anlamina ayrildi (bkz. myAction).
//
// Mobildeki mobile/components/PhaseBadge.tsx ile ayni gorsel dil.
const PHASE_CLASS: Record<MatchPhase, string> = {
  poll: "pill-poll",
  scheduled: "pill-scheduled",
  playing: "pill-playing",
  rating: "pill-rating",
  completed: "",
  cancelled: "pill-danger",
};

export function PhaseBadge({ phase }: { phase: MatchPhase }) {
  return <span className={`pill ${PHASE_CLASS[phase]}`}>{PHASE_LABEL[phase]}</span>;
}
