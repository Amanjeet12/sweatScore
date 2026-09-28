# AI Coach — client decisions for development acceptance

**For client review only. Not sent externally.** Please record the chosen rule and one accepted example for each item. The supplied daily-plan and meal prompts and their examples have not been edited. Decisions about legacy categories and in-flight uploads are required before any scheduler migration.

| Decision | Concrete case to resolve | Client answer needed |
| --- | --- | --- |
| Step recovery threshold | Three days exceed a known step average; one day has incomplete sensor coverage. | Numeric meaning of “well above average,” coverage rule, and whether all three days must qualify. |
| Readiness priority | Member chooses a full session but reports poor sleep/energy or recovery; another chooses something light with upper- or lower-body soreness. | Order of precedence for the conflicting signals, while preserving pain/rest exclusions and compatible soreness splits. |
| Jollof and plantain | A stacked-carb plate dominated by jollof and plantain is “Nearly there” in a supplied example, while the general rule suggests “Room to improve.” | Which verdict and portion advice governs this case? |
| Pounded yam | The supplied large-pounded-yam training-day example allows more than the general “only a little high” rule. | Training-day allowance and resulting verdict/portion wording. |
| Layered bowls | A bowl has visible starch in several layers and protein/vegetables partly obscured. | How to estimate visible carb share, when to say “unable to assess,” and which verdict applies without inventing hidden ingredients. |
| Scan/retake quota | A provider call fails, a photo is unclear or non-meal, a member retakes it, or abandons the draft after dispatch. | Which dispatched attempts consume one of three scans? May a draft be resumed or shared after member-local midnight? Can any meal be shared without valid feedback? |
| Public meal feedback | A analysed meal is shared to the feed. | Keep AI feedback private with only photo/caption public, or explicitly include feedback? |
| Expired access | Premium expires after the member has plans, photos and activity; Restore finds no active entitlement. | Which historical content remains visible, where renewal begins, and approved copy. Confirm real trial and reminder configuration before promising either. |
| Changed-day checkout | A member answers five questions, leaves the paywall, then completes checkout after the member-local midnight or a timezone/DST change. | Exact message and day-boundary policy; yesterday's plan must remain history and new-day answers must be fresh. |
| Rest-day workout | A rest/pain plan has no mandatory Workout check-in, but the member voluntarily exercises. | Whether the Workout reward slot is available and what proof would qualify. |
| Delayed proof and reversals | A live proof capture starts before midnight and uploads after; a post is later deleted or a completion reversed. | Which day owns the proof, whether a consumed slot can ever reopen, and the audit/points treatment. |
| Legacy category mapping | Historical check-ins use **Jump Rope, Core, Strength, Dance, Daily Streak**; 31 old completions include 12 removed. | Approve exact category IDs, proof/points conditions and target stable slots; specify how removed records count. Do not infer Workout from a generic check-in or hydration. |
| In-flight legacy uploads | A device has an unfinished upload with no trustworthy capture day or plan context. | Eligibility and preservation path for each provenance class. No invented plan revision or duplicate reward. |

The current safe behavior and source conflicts are detailed in `COACH_STAGE10_DECISIONS.md`. An unanswered row remains a release or migration acceptance gap, not permission to invent a rule.
