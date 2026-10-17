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

- `index.html` — page structure. Loads `style.css` in `<head>`, and `phone-service.js` then `script.js` at the end of `<body>` (so the scripts run after the page elements exist, and `PhoneService` exists before `script.js` uses it).
- `phone-service.js` — the **phone service boundary**: everything telephony-side lives here, and `script.js` only talks to it through `PhoneService`. Currently a **simulation** that follows real SIP call steps and logs them to the Console as `[simulated SIP] → INVITE …`, `← 180 Ringing`, `← 200 OK`, `→ CANCEL`, `→ BYE`, `→ DTMF 5`. Interface → service: `dial(number)`, `hangUp()` (CANCEL if unanswered, BYE if connected), `setMuted(on)`, `sendDigit(key)`. Service → interface callbacks: `onRinging()`, `onAnswered()`, `onEnded(reason)` (`"you-hung-up"` or `"they-hung-up"`; fires for both, like SIP.js), `onFailed(reason)` (not used yet). Test helper: type `simulateRemoteHangup()` in the Console during a connected call. **A future SIP.js version must keep this same interface** so `script.js` doesn't change; keeping the simulation lets the interface be tested without Asterisk.
- `style.css` — layout and appearance of the phone card, number display, and keypad grid. The housing (`.phone`) background is `images/BlueyPhoneCase.png` (`--housing-image`), with a cream fallback color; the faceplate is plain `--faceplate-color`. The housing labels (`.connection-status`, `.simulated-note`) have a white "sticker" backing so they stay readable over the pattern. The phone shrinks to fit short windows and small screens; see Design Decisions → Fitting the phone into small windows.
- `script.js` — local keypad behavior: the typed number is held in a `phoneNumber` variable (the source of truth), and `updateDisplay()` copies it to the page after every change. Supports digit entry (max 15 characters), backspace, clear, a contacts list (`CONTACTS` array of `{ name, number, picture }`; see `contact_list.txt` and `images/contact_pictures/` below), each shown as picture | name | number, mute, a call timer, and keyboard input (digits/`*`/`#`, Backspace, Enter = call, Esc = end call / close contacts). Simulated call flow uses `callStatus` (`idle` → `calling` → `connected` → `ended` → `idle`, or `idle` → `not-approved` → `idle`). **Approved numbers (cosmetic, browser-side only):** `startCall()` first checks `isApprovedNumber()`. A number not in `CONTACTS` (compared after dropping a leading `1` on 11-digit numbers) shows "Non Approved Number" in red for 5 seconds, plays `non-approved-number.mp3`, and starts no call. The final rule may change, and real enforcement belongs in Asterisk (see Security and Calling Restrictions). Call flow: `startCall()` checks the number, shows "Calling…", and calls `PhoneService.dial()`. The service's `onAnswered` runs `showCallConnected()` and `onEnded` runs `showCallEnded(reason)`, the **only** place the screen resets after a call. End call / Esc run `hangUp()`, which only *asks* the service; the screen resets when the service confirms through `onEnded`. During a connected call, keypad keys play their tone and call `PhoneService.sendDigit()` (future DTMF) instead of editing the number. Mute calls `PhoneService.setMuted()`. The connection badge (`#connection-status`) is static "not connected" until real calling exists. `phoneNumber` always holds the raw keys pressed; `formatForDisplay()` derives the international display text (10 digits → assumes `+1`, e.g. `+1 555 123 4567`). Non-+1 numbers get a `+` but no digit grouping (that would need a library such as libphonenumber).
- `README.md` — currently an empty placeholder.
- `audio/` — MP3 voice prompts, named lowercase-with-hyphens so code can build paths from key values:
  - `key-0.mp3` … `key-9.mp3`, `key-star.mp3`, `key-pound.mp3` — played by `playKeySound()`.
  - `calling.mp3`, `call-ended.mp3` — played by `startCall()` / `endCall()`.
  - `contacts.mp3` — played when the contacts panel opens.
  - `non-approved-number.mp3` — played by `rejectNonApprovedNumber()`. The restriction it announces is cosmetic only (see Security and Calling Restrictions).
  - `call-failed.mp3` — not used yet; wire it up only when a call-failed state exists.
  - Only one sound plays at a time: `playSound()` stops the previous one. Stopping a sound before it has started makes `play()` fail with `AbortError`; `playSound()` deliberately ignores that error and reports all others (such as a missing file).
- `images/` — `BlueyBackground.png` (page background) and `BlueyPhoneCase.png` (phone housing background).
  - `images/contact_pictures/` — one square photo per contact, used by `CONTACTS[].picture` via `CONTACT_PICTURE_FOLDER`. File names are case-sensitive on most web servers (`Lala.png`, `Didi.jpg`, `Dian_Bender.jpg`), so the `picture` value must match exactly. `unknown_caller.png` is not used yet; it is meant for future contacts that have no picture.
- `contact_list.txt` — the developer's full personal contact list (about 350 entries: `First Name`, `Last Name`, optional `Nickname`, `Phone Number`). **Real people's numbers: it is listed in `.gitignore` and must never be committed.** It is reference material only; the app does not read it.
  - **Which contacts are in the app:** only people who have a photo in `images/contact_pictures/`. Each photo is matched to a list entry by comparing the file name with the entry's `Nickname` (for example `aunt_cammy.jpg` ↔ `Nickname: Aunt Cammy`); in future, first and last names may also be used (for example `Dian_Bender.jpg` ↔ Dian Bender). Everyone else in the list is for later, if the developer chooses to add them.
  - **The on-screen name** is the nickname. Numbers are stored as 10 digits (punctuation and the leading `+1` removed).
  - **Matches confirmed by the developer that the file names alone don't show:** `aunt_mimi.png` → *Aunt Missy* (Durr), shown as "Aunt Missy". `og_pop_pop.png` → the *Dad Quaste* entry, shown as "OG Pop Pop" (`pop_pop.jpg` is Rich Thomas, whose nickname is Pop Pop; a separate "Pop Pop Quaste" entry, +1 215-852-6108, is not used). `dad.jpg` → Corey Quaste (`Nickname: Dad`), not the separate "Dad Quaste" entry.
  - **Unresolved:** the developer gave OG Pop Pop's number as 215-527-5025, but the list has Dad Quaste as (215) 527-5024, and 5025 belongs to Didi (Mom Quaste). The app uses 2155275024 from the list; confirm with the developer.

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

## Design Decisions

### Fitting the phone into small windows

**Problem:** at its full size the phone is about 348 × 749px. On a smaller monitor (or with Windows display scaling), Chrome's window was shorter than that, so the Call button was off-screen and the top was clipped.

**How it works now (`style.css`):**
- **Keys get shorter, not narrower.** `.key { height: clamp(40px, (100dvh - var(--non-keypad-height)) / 4, 80px) }`: window height minus everything that isn't a key, split across the 4 rows, kept between 40px (still pressable) and 80px (square, the original look).
- **Width only shrinks on narrow screens:** `.phone { width: min(300px, 100vw - 86px) }`.
- **Short windows get tighter spacing:** a `@media (max-height: 720px)` block at the end of `style.css` reduces padding, gaps, and the display, and lowers `--non-keypad-height` to match.
- **Centering:** `.phone { margin: auto }` instead of `align-items: center` on `body`, so an oversized phone starts at the top of the page instead of being clipped above it.

**Trade-off: `--non-keypad-height` is a measured, hand-tuned number** (483px normally, 364px in the short-window media query; last re-tuned when the housing border went to 9px and `.keypad-area` gained bottom padding for the key shadows), not something the browser works out. It stands for "the height of everything except the four rows of keys." **If anything outside the keypad is added or resized** (a taller display, a new button row, an incoming-call banner, longer label text that wraps), the phone can overflow the window slightly again. When that happens, raise the matching value until it fits.
- **How to re-check:** DevTools device toolbar (F12, then Ctrl+Shift+M). Try window heights around 900, 750, 600, and 520, plus phone sizes 360×640 and 320×568. The Call button and the "Simulated" note should be visible without scrolling.
- **Known limit, by design:** windows shorter than about 520px still scroll a little, because keys stop shrinking at 40px.

**Alternatives considered:**
- *Shrink the phone's width so the square keys shrink.* Rejected: narrower housing makes the labels wrap onto more lines, which adds height and undoes the fix.
- *Scale the whole phone like an image (CSS `zoom` or JavaScript measuring the window).* An exact fit with no magic number, but text and buttons get tiny on small screens, and JavaScript would be doing layout. This is the fallback if the measured value becomes a maintenance burden.
- *A flexbox layout where the keypad fills whatever height is left.* Removes the magic number, but is harder to follow at the current learning stage. Worth revisiting if the layout grows.

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
  - The current `isApprovedNumber()` check in `script.js` is a user-friendly message only. Anyone can bypass it (DevTools, or sending SIP to Asterisk directly). Real enforcement should live in the Asterisk dialplan: the call is checked against an allow-list before Asterisk forwards it to Callcentric. The browser and Asterisk should share one source for the approved list (to decide in Phase 5, possibly served by the Python backend).
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
- **Milestone (2026-10-17): basic phone interface complete.** The developer declared Phases 2–3 (static interface, local interactions) done, committed as "Basic Phone Interface Complete". Since then the interface has 14 real contacts with round photos (picture | name | number rows, styled scrollbar), a 0-key voice prompt, solid desaturated disabled buttons, a 9px housing border, and fits short windows and phone screens (see Design Decisions). Next up: Phase 4 (testing and cleanup, including writing `README.md`), then Phase 5 (calling research and design).
- Interface details: a numeric keypad (0–9, `*`, `#`) appends to a number display, with working backspace and clear buttons. Simulated calling UI is in place: a call status line and timer, a green "Call" / red "End call" button, mute, in-call keypad tones, contacts, keyboard input, and a connection badge. None of it places real calls or touches the microphone. Not built: an incoming-call screen, a call-failed state, and call history.
- Keypad and call-button voice prompts play from `audio/`. Theme: page background `images/BlueyBackground.png`, phone housing `images/BlueyPhoneCase.png`, faceplate `#D6EEFB`, buttons `#E98B32` with `#34558B` text (CSS variables in `:root`). Physical plastic look: `.phone` is the housing, `.faceplate` (a purely visual wrapper) is the recessed panel, and all buttons share one raised-key rule in `style.css`. Each button type sets only `--face` / `--face-light` / `--edge` colors, and `--key-depth` controls key height and press travel. The number display uses the Fredoka font, loaded from Google Fonts via `<link>` tags in `index.html` (approved external resource; no package or build step). It falls back to Comic Sans MS when offline. `audio/` and `images/` are committed.
- Simulated approved-number check: dialing a number not in `CONTACTS` shows "Non Approved Number" for 5 seconds and plays its prompt. This is cosmetic only and not real enforcement.
- **Asterisk learning path (Phase 5), Milestone 1 done (2026-10-17):** the simulated telephony moved out of `script.js` into `phone-service.js` behind a SIP-shaped interface (see Current Files), with no change in visible behavior. Planned next milestones, each needing approval first: **2** failure outcomes (busy `486`, refused `403`, not found `404`, no answer), finally using `call-failed.mp3` via `onFailed`; **3** decide where Asterisk runs (it doesn't run natively on Windows: WSL, Docker, or a Raspberry Pi); **4** SIP.js calls between two test extensions on the developer's own Asterisk (no Callcentric, no cost); **5** connect Asterisk to Callcentric, with approved-number rules enforced in the dialplan.
- The first target is a frontend-only browser softphone prototype.
- Real calling, provider integration, backend functionality, and physical-phone integration have not yet been implemented or verified. (The first commit message mentions WebRTC calling, but no calling code exists.)

Update this section as the project progresses. Do not assume a feature exists just because it appears in the plan.
