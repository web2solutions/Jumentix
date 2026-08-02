# Requirement 114 - Agent Worktree Layout and Onboard Clone

- Status: Active
- Nature: NFR (governance, multi-agent operations)
- Source: Project owner decision, 2026-08-01 (JUM-595).
- Relates to: `078`, `080`, `081`, `089`, `099`.

## Requirement

1. **Before an agent onboards to collaborate on Jumentix, it MUST confirm the
   filesystem root with the human operator of that agent.** The root is not
   assumed from prior sessions, other agents, or machine defaults. Examples the
   operator may choose include `$HOME/XpertMinds` or `$HOME/apps/XpertMinds`.
   Work MUST NOT begin until the operator confirms the root path in-band.

2. **Under that confirmed root, the agent creates exactly this layout:**

   ```text
   <operator-confirmed-root>/
     XpertMinds/
       <agent-identifier>/
         Jumentix/          # git clone of XpertMinds/Jumentix (canonical)
   ```

   - `<agent-identifier>` is the stable agent id used in the Agent Registry
     (Requirement `080`), for example `cursor-grok-001` or `codex-primary-001`.
   - The clone target is always `XpertMinds/Jumentix` (canonical private repo).
   - The agent registry clone, when needed, lives as a sibling under the same
     agent folder (for example `XpertMinds/<agent-identifier>/jumentix-agent-registry`),
     never inside the Jumentix worktree.

3. **All Jumentix task work for that agent happens in the worktree**

   ```text
   <operator-confirmed-root>/XpertMinds/<agent-identifier>/Jumentix
   ```

   Task branches and additional git worktrees for concurrent tasks are created
   **inside or from** that clone (for example via `git worktree add` under the
   agent folder). Agents MUST NOT share another agent's `XpertMinds/<other-id>/`
   tree, and MUST NOT treat ad-hoc paths outside this layout as the SoT checkout.

4. **Onboard sequence (mandatory):**
   1. Confirm root with the human operator.
   2. Create `XpertMinds/<agent-identifier>/` if missing.
   3. Clone `XpertMinds/Jumentix` into `.../Jumentix` (or fetch/reset if already present).
   4. Fetch and read current `origin/dev` and `origin/main` (Requirements `084`, `099`, `116`).
   5. Register / refresh Agent Registry fields (Requirements `078`, `081`, `089`).
   6. Only then accept a Linear task.

5. **Fail closed.** If the operator has not confirmed the root, if the clone is
   missing, or if the agent is operating from a path that is not
   `.../XpertMinds/<agent-identifier>/Jumentix` (or a documented git worktree
   derived from it), the agent MUST stop and correct the layout before editing
   product code.

## Evidence

- This requirement file
- Agent Registry `workspace_path` / machine fields pointing at the layout
- Operator confirmation recorded in the Linear Issue or Project Update for onboard
