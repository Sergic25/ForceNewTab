(() => {
  "use strict";
  const record = document.getElementById("record-click");
  const copy = document.getElementById("copy-report");
  const clear = document.getElementById("clear-report");
  const status = document.getElementById("report-status");
  const output = document.getElementById("click-report");
  const isolationStatus = document.getElementById("isolation-status");
  if (!record || !copy || !clear || !status || !output) return;
  const api = globalThis.browser;
  if (!api?.storage?.local || !api?.storage?.onChanged || !api?.runtime?.sendMessage) {
    record.disabled = copy.disabled = clear.disabled = true;
    status.textContent = "Load this build in Firefox, then open the add-on's Preferences to record a click.";
    return;
  }
  let current = {}, revision = 0, timer = null, busy = false;
  const say = message => { status.textContent = message; };
  function render() {
    if (timer !== null) { clearTimeout(timer); timer = null; }
    const report = current.fntLastClickReport;
    const armed = current.fntRecordNextClick;
    output.value = report ? JSON.stringify(current.fntLastIsolationResult ? {...report, isolationResultScope: "last-copy-operation-across-tabs", isolationResult: current.fntLastIsolationResult} : report, null, 2) : "";
    if (isolationStatus) {
      const labels = {rejected: "The copy request was rejected before preparation. The report includes the check.", declined: "Copy not started: this control could not be matched. The existing fallback may have been used.", preparing: "Loading a background copy…", activated: "A click was attempted in the copy. Check whether the expected page or popup appeared.", uncertain: "The copied click outcome is uncertain. Check the new tab before clicking again.", failed: "The copy could not be prepared; the existing fallback may have been used.", cancelled: "Copy preparation stopped."};
      isolationStatus.textContent = labels[current.fntLastIsolationResult?.state] || "Background copies are used automatically for unresolved controls while the toolbar is ON.";
    }
    record.disabled = clear.disabled = busy;
    copy.disabled = busy || !output.value;
    if (busy) return;
    if (report) {
      say(report.outcome?.content?.status === "observing"
        ? "Report captured. Watching this click for up to 10 seconds; then copy the updated report."
        : "Report captured. Review it below, then use Copy report.");
      return;
    }
    if (armed && Number.isFinite(armed.expires)) {
      const remaining = Math.ceil((armed.expires - Date.now()) / 1000);
      if (remaining > 0) {
        say("Ready — return to the page and middle-click once. Recording expires in " + remaining + " seconds.");
        timer = setTimeout(render, Math.min(1000, Math.max(1, armed.expires - Date.now())));
        return;
      }
      say("Recording expired. Choose Record next middle-click to try again.");
      return;
    }
    say("Recording is off. Nothing is recorded until you choose Record next middle-click.");
  }
  async function refresh() {
    const mine = ++revision;
    try {
      const values = await api.storage.local.get(["fntRecordNextClick", "fntLastClickReport", "fntLastIsolationResult"]);
      if (mine !== revision) return;
      current = values;
      render();
    } catch {
      if (mine !== revision) return;
      record.disabled = copy.disabled = clear.disabled = true;
      say("The report could not be loaded. Reopen the add-on's Preferences and try again.");
    }
  }
  async function update(command, payload, message) {
    if (busy) return;
    busy = true;
    render();
    say(message);
    try {
      const request = {type: "fnt-diagnostic-control", command};
      if (command === "record") request.token = payload;
      const result = await api.runtime.sendMessage(request);
      if (!result?.ok) throw new Error("Control request failed");
      busy = false;
      await refresh();
    } catch {
      busy = false;
      render();
      say("The setting could not be saved. Please try again.");
    }
  }
  record.addEventListener("click", () => {
    if (busy) return;
    let token;
    try { token = globalThis.crypto.randomUUID(); }
    catch { say("Recording could not start. Reopen the add-on's Preferences and try again."); return; }
    void update("record", token, "Starting recording…");
  });
  clear.addEventListener("click", () => {
    void update("clear", null, "Clearing report and stopping recording…");
  });
  copy.addEventListener("click", async () => {
    if (!output.value) return;
    try {
      await navigator.clipboard.writeText(output.value);
      say("Report copied. Review it, then attach it to your GitHub issue.");
    } catch {
      output.focus();
      output.select();
      say("The report is selected. Press Ctrl+C to copy, then attach it to your GitHub issue.");
    }
  });
  api.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && ("fntRecordNextClick" in changes || "fntLastClickReport" in changes || "fntLastIsolationResult" in changes)) void refresh();
  });
  window.addEventListener("pagehide", () => { if (timer !== null) clearTimeout(timer); });
  void refresh();
})();

