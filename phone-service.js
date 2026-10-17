// ===== Simulated phone service =====
// Pretends to be the phone network, so the interface can be built and tested
// without Asterisk. NO REAL CALLS ARE PLACED.
//
// It follows the steps of a real SIP call and logs them to the DevTools
// Console (F12), so you can watch what a real call will look like:
//   → INVITE        "please call this number"            (we send)
//   ← 180 Ringing   "the other phone is ringing"         (they send)
//   ← 200 OK        "they answered"                      (they send)
//   → CANCEL        "never mind" (hang up before answer) (we send)
//   → BYE / ← BYE   "hanging up" (either side can send it)
//
// A real version (using SIP.js) will provide exactly the same functions and
// callbacks below, so script.js won't need to know which one it's talking to.
//
// The interface (script.js) TELLS the service what to do:
//   PhoneService.dial(number)    place a call                    (SIP: INVITE)
//   PhoneService.hangUp()        cancel or end the call          (SIP: CANCEL or BYE)
//   PhoneService.setMuted(on)    mute or unmute the microphone
//   PhoneService.sendDigit(key)  send a keypad tone down the line (DTMF)
//
// The service TELLS the interface what happened, by calling the functions
// that script.js stores in these properties:
//   PhoneService.onRinging()       the other phone is ringing     (SIP: 180 Ringing)
//   PhoneService.onAnswered()      they answered                  (SIP: 200 OK)
//   PhoneService.onEnded(reason)   the call is over: reason is
//                                  "you-hung-up" or "they-hung-up"
//   PhoneService.onFailed(reason)  the call couldn't be made (not used yet)
//
// onEnded fires for BOTH kinds of ending, including when you hang up. That's
// how SIP.js behaves too, and it means the interface resets the screen in
// exactly one place, however the call ended.

// How long after dialing the simulated phone rings, then answers (milliseconds).
const SIMULATED_RING_DELAY = 300;
const SIMULATED_ANSWER_DELAY = 2500;

const PhoneService = {
    // Where the call is, from the phone network's point of view:
    //   "idle"     - no call
    //   "calling"  - INVITE sent, not answered yet (this includes ringing)
    //   "answered" - the call is connected
    callState: "idle",

    // Timer IDs for the pretend network, kept so hanging up can cancel them.
    ringTimeoutId: null,
    answerTimeoutId: null,

    // Callbacks. script.js replaces these with its own functions. They start
    // as empty functions, so calling one that hasn't been set is harmless.
    onRinging: function () {},
    onAnswered: function () {},
    onEnded: function (reason) {},
    onFailed: function (reason) {},

    dial: function (number) {
        if (PhoneService.callState !== "idle") {
            logSip("dial() ignored: a call is already in progress");
            return;
        }
        PhoneService.callState = "calling";
        logSip(`→ INVITE ${number}`);

        // setTimeout makes these happen later, like real network replies
        // would. That also means the interface can't accidentally depend on
        // them happening instantly.
        PhoneService.ringTimeoutId = setTimeout(function () {
            logSip("← 180 Ringing");
            PhoneService.onRinging();
        }, SIMULATED_RING_DELAY);

        PhoneService.answerTimeoutId = setTimeout(function () {
            PhoneService.callState = "answered";
            logSip("← 200 OK (answered)");
            PhoneService.onAnswered();
        }, SIMULATED_ANSWER_DELAY);
    },

    hangUp: function () {
        if (PhoneService.callState === "calling") {
            // Not answered yet: SIP calls this cancelling, not hanging up.
            logSip("→ CANCEL");
            logSip("← 487 Request Terminated (call cancelled)");
        } else if (PhoneService.callState === "answered") {
            logSip("→ BYE");
            logSip("← 200 OK (call ended)");
        } else {
            return; // no call, nothing to hang up
        }
        finishCall("you-hung-up");
    },

    setMuted: function (isMuted) {
        // A real version will switch the microphone's audio track off and on.
        logSip(isMuted ? "microphone muted (simulated)" : "microphone unmuted (simulated)");
    },

    sendDigit: function (digit) {
        if (PhoneService.callState !== "answered") {
            return; // tones only mean something during a connected call
        }
        // A real version will send the tone down the line for phone menus.
        logSip(`→ DTMF ${digit}`);
    },
};

// Shared clean-up for every way a call can end: stop the pretend network's
// timers, go back to idle, then tell the interface.
function finishCall(reason) {
    clearTimeout(PhoneService.ringTimeoutId);
    clearTimeout(PhoneService.answerTimeoutId);
    PhoneService.callState = "idle";
    PhoneService.onEnded(reason);
}

// Every simulated SIP step goes through here, so the Console shows the call
// flow as one readable sequence.
function logSip(message) {
    console.log(`[simulated SIP] ${message}`);
}

// ----- Test helper -----
// Acts out the OTHER person hanging up. During a connected call, type this
// into the DevTools Console:   simulateRemoteHangup()
function simulateRemoteHangup() {
    if (PhoneService.callState !== "answered") {
        console.warn("simulateRemoteHangup(): there's no connected call to hang up.");
        return;
    }
    logSip("← BYE (the other person hung up)");
    logSip("→ 200 OK");
    finishCall("they-hung-up");
}
