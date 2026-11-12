import { BadgeCheck, BookOpen, Compass, KeyRound, ListChecks, ShieldCheck, Workflow } from 'lucide-react';
import { getAgent } from '../config/agents.js';

export const AGENT_ICON = {
  orchestrator: Compass, knowledge: BookOpen, onboarding: Workflow, access: KeyRound,
  tracker: ListChecks, ownership: ShieldCheck, validation: BadgeCheck,
};

export function AgentAvatar({ id, size = 32 }) {
  const a = getAgent(id);
  const Icon = AGENT_ICON[id];
  if (!a || !Icon) return null;
  return (
    <span className="agent-avatar" style={{ '--c': a.color, width: size, height: size }} aria-hidden="true">
      <Icon size={Math.round(size * 0.5)} strokeWidth={2} />
    </span>
  );
}

/** Avatar + name, optionally with the version line underneath. */
export default function AgentMark({ id, size = 32, detail = false }) {
  const a = getAgent(id);
  if (!a) return null;
  return (
    <span className="mark">
      <AgentAvatar id={id} size={size} />
      <span><b>{a.name}</b>{detail && <small>{a.version}</small>}</span>
    </span>
  );
}
