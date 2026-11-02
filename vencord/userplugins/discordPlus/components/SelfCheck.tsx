/*
 * Discord+ Refined Dark — the self-check panel in Discord+ settings.
 * SPDX-License-Identifier: CC-BY-NC-4.0
 */
import { copyWithToast } from "@utils/discord";
import { useState } from "@webpack/common";

import { runSelfCheck, selfCheckReport } from "../selfcheck";
import { Icon } from "./Icons";

const MARK = { ok: "✓", fail: "✕", na: "–" };

export function SelfCheck() {
    const [checks, setChecks] = useState(runSelfCheck);
    const failed = checks.filter(c => c.state === "fail");
    const passed = checks.filter(c => c.state === "ok").length;
    const groups = [...new Set(checks.map(c => c.group))];

    return (
        <section className="dp-selfcheck" aria-label="Discord+ self-check">
            <div className="dp-selfcheck-head">
                <div>
                    <strong>Self-check</strong>
                    <span className={failed.length ? "dp-selfcheck-bad" : "dp-selfcheck-good"}>
                        {failed.length
                            ? `${failed.length} part${failed.length > 1 ? "s" : ""} of Discord changed: ${failed.map(f => f.feature).join(", ")} may not work.`
                            : `Everything Discord+ needs is working (${passed} checks; – means it can't be checked right now).`}
                    </span>
                </div>
                <div className="dp-selfcheck-buttons">
                    <button type="button" onClick={() => setChecks(runSelfCheck())}>
                        <Icon name="refresh" size={14} /> Run again
                    </button>
                    <button type="button" onClick={() => copyWithToast(selfCheckReport(checks), "Self-check report copied")}>
                        Copy report
                    </button>
                </div>
            </div>
            {groups.map(g => (
                <div key={g} className="dp-selfcheck-group">
                    <h4>{g}</h4>
                    {checks.filter(c => c.group === g).map(c => (
                        <div key={c.name} className={`dp-selfcheck-row dp-${c.state}`} title={`Used for: ${c.feature}`}>
                            <span className="dp-selfcheck-mark" aria-label={c.state}>{MARK[c.state]}</span>
                            <span className="dp-selfcheck-name">{c.name}</span>
                            <span className="dp-selfcheck-detail">{c.detail ?? c.feature}</span>
                        </div>
                    ))}
                </div>
            ))}
            <p className="dp-selfcheck-foot">
                The copied report has only these results and version numbers, no names or messages. Paste it into an
                issue on GitHub if something shows ✕.
            </p>
        </section>
    );
}
