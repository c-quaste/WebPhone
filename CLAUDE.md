# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Web Phone Project

## Project Goal

Build a customizable browser-based softphone that can eventually make and receive telephone calls through a compatible SIP/VoIP service.

The primary purpose of this project is to learn web development by building a real application. The first working version should be a browser-based softphone that runs on the developer's computer.

Start with a frontend prototype and local interactions. Add real calling only after the interface is understandable, working, and tested.

Longer term, this project may inform a broader customizable phone system. One possible future goal is a physical phone that behaves like a normal corded phone while restricting outgoing calls to approved numbers and incoming calls to approved callers. This is a future design goal, not part of the initial implementation.

## Developer Context

The developer is learning HTML, CSS, JavaScript, and Python and has some foundational experience with HTML, CSS, JavaScript, and Git.

The primary learning goal is to understand how the application works, not merely to obtain generated code. Use the project to explain relevant concepts in context.

- Explain unfamiliar concepts and important architectural decisions in plain language.
- Explain why a solution works, not just what code to paste.
- Prefer small, understandable steps over large unexplained code dumps.
- Do not assume a concept is understood just because code using it has been generated.
- When meaningful alternatives exist, briefly explain the tradeoffs and recommend a sensible default.

## Running and Testing

There is no build step, package manager, linter, or automated test suite. The app is plain static files.

- **Quick look:** open `index.html` directly in a browser (double-click, or drag into a browser window). Refresh after each change.
- **Local server (recommended once audio or calling is involved):** from the project root run `python -m http.server 8000` and visit `http://localhost:8000`. The VS Code "Live Server" extension is an alternative that auto-reloads. Browsers only allow microphone access and WebRTC on secure contexts, and `http://localhost` counts as one but `file://` does not reliably.
- **Testing is manual:** exercise the interface in the browser and check the DevTools Console (F12) for errors. Do not introduce a test framework without discussing it first (see Technology Direction).

## Current Files

- `index.html` — page structure. Loads `style.css` in `<head>` and `script.js` at the end of `<body>`, so the script runs after the page elements exist and can look them up directly.
- `style.css` — layout and appearance of the phone card, number display, and keypad grid.
- `script.js` — local keypad behavior: the typed number is held in a `phoneNumber` variable (the source of truth), and `updateDisplay()` copies it to the page after every change. Supports digit entry (max 15 characters), backspace, clear, a contacts list (`CONTACTS` array, fictional 555-01xx numbers), mute, a call timer, and keyboard input (digits/`*`/`#`, Backspace, Enter = call, Esc = end call / close contacts). Simulated call flow uses `callStatus` (`idle` → `calling` → `connected` → `ended` → `idle`): `startCall()` → `connectCall()` (after a timer for now; real calling should call it when the far end answers) → `endCall()`, which any future "remote side disconnected" handler should also call. During a connected call keypad keys only play their tone (future DTMF) and don't edit the number. The connection badge (`#connection-status`) is static "not connected" until real calling exists. `phoneNumber` always holds the raw keys pressed; `formatForDisplay()` derives the international display text (10 digits → assumes `+1`, e.g. `+1 555 123 4567`). Non-+1 numbers get a `+` but no digit grouping (that would need a library such as libphonenumber).
- `README.md` — currently an empty placeholder.
- `audio/` — MP3 voice prompts, named lowercase-with-hyphens so code can build paths from key values:
  - `key-1.mp3` … `key-9.mp3`, `key-star.mp3`, `key-pound.mp3` — played by `playKeySound()`. There is no `key-0.mp3` yet, so 0 is silent; once it is added, remove the `"0"` early return in `playKeySound()`.
  - `calling.mp3`, `call-ended.mp3` — played by `startCall()` / `endCall()`.
  - `contacts.mp3` — played when the contacts panel opens.
  - `call-failed.mp3`, `non-approved-number.mp3` — not used yet; wire each up only when its feature exists.
  - Only one sound plays at a time: `playSound()` stops the previous one.
  - `non-approved-number.mp3` relates to the future approved-number feature. Any restriction it announces in the browser is cosmetic only (see Security and Calling Restrictions).

## Initial Scope

The first version should be a frontend-only browser prototype. It should include:

- A telephone-number display.
- A numeric keypad.
- Call and hang-up controls.
- A contacts area or basic contact list.
- A visible phone/calling status area.

The initial prototype does not need to connect to a real phone provider. Implement and test local interactions before adding network or telephony features. Clearly label simulated call behavior so it cannot be mistaken for real calling.

## Technology Direction

Preferred starting technologies:

- HTML for structure.
- CSS for layout and appearance.
- JavaScript for interface behavior.

### Planned Calling Stack

The developer plans to connect this interface to their **Callcentric** phone plan using **Asterisk** and **Python**. Design calling work around this stack:

- **Callcentric:** the SIP/VoIP provider that carries real calls to and from the phone network.
- **Asterisk:** the phone server between the browser interface and Callcentric. It handles call routing, and it is where approved-number and approved-caller restrictions should be enforced (see Security and Calling Restrictions).
- **Python:** backend functions alongside Asterisk. Its exact role is still to be decided.
- **SIP.js and WebRTC:** likely options for carrying browser audio to Asterisk, subject to browser and Asterisk compatibility.

Still open, to decide in Phase 5: how the browser talks to Asterisk (for example, SIP over WebSocket directly, or through a Python service) and exactly what Python is responsible for. Callcentric account credentials belong in Asterisk or server-side configuration kept out of Git, never in browser JavaScript.

Even within this stack, do not introduce a framework, backend, database, or additional dependency without explaining why it is needed and getting approval before a major architectural change.

## Architecture Principles

- Keep HTML, CSS, and JavaScript in separate files unless there is a clear reason not to.
- Keep the initial implementation simple and easy to inspect.
- Separate interface behavior from telephony logic as the application grows.
- Avoid building future features before the current milestone is working.
- Document important architectural decisions when they are made.

## Development Rules

### Planning and Approval

- Before starting a substantial task, describe the intended approach and identify which files are expected to change.
- Plan first. Explain important decisions and wait for approval before making major architectural changes or implementing a large feature.
- For small, clearly scoped changes within an approved plan, proceed without asking for approval at every step.
- If requirements are unclear, ask a focused question rather than making a major assumption.
- Do not expand the task's scope without discussing it first.

### Teaching and Explanations

- Explain unfamiliar syntax, APIs, and design choices relevant to the current task.
- Keep explanations proportional to the change; do not explain every basic line repeatedly.
- When debugging, identify the likely cause and explain how the evidence supports it.
- Prefer teaching through the actual project rather than unrelated tutorials.
- After completing a task, summarize what changed, why it changed, and what the developer should learn from it.

### Code Changes

- Work in small, testable increments.
- Avoid rewriting working code unnecessarily.
- Preserve existing behavior unless a change is intentional.
- Keep code readable and use names that make sense to a learner.
- Explain the purpose of a new dependency before adding it.

### Testing and Reporting

- After changes, explain how to run or test them.
- Test affected behavior when tools and the environment allow it.
- Distinguish between tests actually performed and tests the developer still needs to perform.
- Never claim a feature works or a test passed without evidence.
- Report errors, limitations, and unresolved issues clearly.

### Documentation

- Keep the README and this file reasonably current as the project evolves.
- Update the Current Status section when the project reaches a meaningful milestone.
- Put detailed technical explanations in separate documentation files if this file becomes too long.

## Security and Calling Restrictions

- Never commit passwords, SIP credentials, API keys, tokens, or other secrets to Git.
- Do not place provider secrets in browser-side JavaScript. Anything shipped to the browser should be treated as visible to the user.
- If the project later needs strict outgoing-number or incoming-caller restrictions, do not rely solely on a browser interface or client-side JavaScript to enforce them. Evaluate enforcement on a trusted server or telephony system.
- Do not connect to a paid provider, place real calls, or change account settings without explicit approval.
- Clearly distinguish simulated call behavior from real telephony functionality.

## Planned Development Phases

1. **Project foundation:** Establish the files, Git repository, and basic page structure.
2. **Static interface:** Build the phone layout and style it for desktop use.
3. **Local interactions:** Implement keypad entry, backspace/clear, contact selection, and interface status locally.
4. **Testing and cleanup:** Test the interface, fix issues, and document how to run it.
5. **Calling research and design:** Confirm the requirements for Callcentric, Asterisk, Python, the browser, SIP.js, and WebRTC before implementation. This includes how the browser connects to Asterisk.
6. **Calling prototype:** Add SIP registration and call controls only after the requirements and connection setup are understood.
7. **Future features:** Consider call history, configurable number filtering, and a backend only when the core calling prototype is stable.
8. **Long-term system evaluation:** If pursuing a physical phone with approved-number restrictions, design and test those controls at the telephony-system level.

Do not attempt all phases at once. Complete and verify each phase before moving forward.

## Current Status

- Phase 1 (project foundation) is done, except that `README.md` is still empty.
- Phases 2–3 started: a numeric keypad (0–9, `*`, `#`) appends to a number display, with working backspace and clear buttons. Simulated calling UI is in place: a call status line and timer, a green "Call" / red "End call" button, mute, in-call keypad tones, contacts, keyboard input, and a connection badge. None of it places real calls or touches the microphone. Not built: an incoming-call screen, a call-failed state, and call history.
- Keypad and call-button voice prompts play from `audio/`. Theme: page background `images/BlueyBackground.png`, phone `#4BA9DF`, buttons `#E98B32` with `#34558B` text (CSS variables in `:root`). Physical plastic look: `.phone` is the housing, `.faceplate` (a purely visual wrapper) is the recessed panel, and all buttons share one raised-key rule in `style.css`. Each button type sets only `--face` / `--face-light` / `--edge` colors, and `--key-depth` controls key height and press travel. The number display uses the Fredoka font, loaded from Google Fonts via `<link>` tags in `index.html` (approved external resource; no package or build step). It falls back to Comic Sans MS when offline. `audio/` and `images/` are not yet committed.
- The first target is a frontend-only browser softphone prototype.
- Real calling, provider integration, backend functionality, and physical-phone integration have not yet been implemented or verified. (The first commit message mentions WebRTC calling, but no calling code exists.)

Update this section as the project progresses. Do not assume a feature exists just because it appears in the plan.
