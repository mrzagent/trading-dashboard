import { formatDistanceToNow, formatAbsoluteTime } from "../utils/time";
import "./AgentCard.css";

import danny from "../assets/danny.jpg";
import frank from "../assets/frank.jpg";
import linus from "../assets/linus.jpg";
import livingston from "../assets/livingston.png";
import reuben from "../assets/rueben.png";
import rusty from "../assets/rusty.jpg";
import saul from "../assets/saul.png";
import turk from "../assets/turk.jpg";
import virgil from "../assets/virgil.png";
import basher from "../assets/basher.png";
import yen from "../assets/yen.png";

const AGENT_IMAGES = {
  Danny: danny,
  Frank: frank,
  Linus: linus,
  Livingston: livingston,
  Reuben: reuben,
  Rusty: rusty,
  Saul: saul,
  Turk: turk,
  Virgil: virgil,
  Basher: basher,
  Yen: yen,
  default: danny,
};

export default function AgentCard({ agent }) {
  const {
    agent_name,
    role,
    model,
    last_active,
    current_task,
    task_milestone,
    last_completed_task,
  } = agent;

  const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
  const isStale = last_active
    ? Date.now() - new Date(last_active).getTime() > STALE_THRESHOLD_MS
    : true;
  const isActive = !!current_task && !isStale;
  const cardClass = isActive ? "agent-card active" : "agent-card";
  const dotClass = isActive ? "status-dot active" : "status-dot";

  const avatarSrc = AGENT_IMAGES[agent_name] ?? AGENT_IMAGES.default;

  const lastActiveDisplay = formatDistanceToNow(last_active);
  const lastActiveTooltip = formatAbsoluteTime(last_active);

  const taskDisplay = current_task || "None";
  const showMilestone = isActive && !!task_milestone;
  const lastCompletedDisplay = last_completed_task || "—";

  return (
    <div className={cardClass}>
      <div className="card-header">
        <img className="agent-avatar" src={avatarSrc} alt={agent_name} />
        <div className="agent-name-block">
          <p className="agent-name">
            <span className={dotClass} title={isActive ? "Active" : "Idle"} />
            {agent_name}
          </p>
          <p className="agent-role">{role}</p>
          {model && model !== "unknown" && (
            <p className="agent-model">⚙ {model}</p>
          )}
        </div>
      </div>

      <div className="card-divider" />

      <div className="card-row">
        <span className="row-label">Last Active</span>
        <span
          className={last_active ? "row-value" : "row-value null"}
          title={lastActiveTooltip}
        >
          {lastActiveDisplay}
        </span>
      </div>

      <div className="card-row">
        <span className="row-label">Current Task</span>
        <span className={current_task ? "row-value" : "row-value null"}>
          {taskDisplay}
        </span>
      </div>

      {showMilestone && (
        <div className="card-row">
          <span className="row-label">Task Milestone</span>
          <span className="row-value">{task_milestone}</span>
        </div>
      )}

      <div className="card-row">
        <span className="row-label">Completed</span>
        <span className={last_completed_task ? "row-value" : "row-value null"}>
          {lastCompletedDisplay}
        </span>
      </div>
    </div>
  );
}
