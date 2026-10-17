// ----- State -----
// The typed number lives in this variable. The page only *shows* it;
// this variable is the single source of truth.
let phoneNumber = "";

// Where the (simulated) call is right now. Always one of:
//   "idle"      - no call; ready to dial
//   "calling"   - dialing, waiting for the other side to answer
//   "connected" - the call is in progress
//   "ended"     - the call just ended (shown briefly, then back to "idle")
//   "not-approved" - the number isn't a contact (shown briefly, then back to "idle")
let callStatus = "idle";

let isMuted = false;
let isContactsOpen = false;

// When the current call connected (a timestamp in milliseconds).
let callStartTime = 0;

// IDs returned by setTimeout/setInterval, kept so they can be cancelled.
let connectTimeoutId = null;
let callTimerIntervalId = null;
let resetStatusTimeoutId = null;

// E.164, the international phone-number standard, allows at most 15 digits.
const MAX_LENGTH = 15;

// How long the simulated call "rings" before connecting, and how long
// "Call ended" stays on screen. Both in milliseconds.
const SIMULATED_CONNECT_DELAY = 2500;
const CALL_ENDED_DISPLAY_TIME = 2000;
const NON_APPROVED_DISPLAY_TIME = 5000;

const STATUS_LABELS = {
    idle: "Ready",
    calling: "Calling…",
    connected: "Connected",
    ended: "Call ended",
    "not-approved": "Non Approved Number",
};

// Fictional numbers: 555-0100 to 555-0199 are reserved for fiction.
// Only these numbers can be dialed (see isApprovedNumber). That check runs
// in the browser, so it is cosmetic: anyone can bypass it. Real enforcement
// belongs in Asterisk (see Security in CLAUDE.md).
const CONTACTS = [
    { name: "Mum", number: "2025550101" },
    { name: "Dad", number: "2025550102" },
    { name: "Nana", number: "2025550103" },
    { name: "Grandad", number: "2025550104" },
];

// ----- Page elements -----
// Look each element up once and keep a reference to it.
const numberDisplay = document.getElementById("number-display");
const backspaceButton = document.getElementById("backspace-button");
const clearButton = document.getElementById("clear-button");
const contactsButton = document.getElementById("contacts-button");
const contactsPanel = document.getElementById("contacts-panel");
const contactsList = document.getElementById("contacts-list");
const keypadButtons = document.querySelectorAll(".key");
const callButton = document.getElementById("call-button");
const muteButton = document.getElementById("mute-button");
const callStatusText = document.getElementById("call-status");
const callTimer = document.getElementById("call-timer");

// ----- Formatting -----
// Turn the raw keys pressed (e.g. "5551234567") into international
// format for display (e.g. "+1 555 123 4567"). phoneNumber itself is
// never changed; this only decides how it looks.
function formatForDisplay(digits) {
    // Service codes like *67 aren't phone numbers, so show them as typed.
    if (digits.includes("*") || digits.includes("#")) {
        return digits;
    }

    // 10 digits: no country code entered, so assume +1.
    // (US/Canada area codes never start with 1, so "1..." with 10 digits
    // means an 11-digit number is still being typed.)
    if (digits.length === 10 && !digits.startsWith("1")) {
        return formatNorthAmerican(digits);
    }

    // 11 digits starting with 1: country code +1 was entered.
    if (digits.length === 11 && digits.startsWith("1")) {
        return formatNorthAmerican(digits.slice(1));
    }

    // 11+ digits with another country code: show "+" but don't group,
    // because every country groups its digits differently.
    if (digits.length >= 11) {
        return "+" + digits;
    }

    // Fewer than 10 digits: still dialing, show as typed.
    return digits;
}

// "5551234567" -> "+1 555 123 4567"
function formatNorthAmerican(tenDigits) {
    const areaCode = tenDigits.slice(0, 3);
    const exchange = tenDigits.slice(3, 6);
    const lineNumber = tenDigits.slice(6);
    return `+1 ${areaCode} ${exchange} ${lineNumber}`;
}

// 65000 milliseconds -> "1:05"
function formatDuration(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// ----- Display -----
// True while dialing or talking, the two states where the number is locked.
function isInCall() {
    return callStatus === "calling" || callStatus === "connected";
}

// Copy the current state onto the page. Every change to the state
// variables above is followed by a call to this function.
function updateDisplay() {
    const inCall = isInCall();
    const isConnected = callStatus === "connected";
    const isEmpty = phoneNumber.length === 0;

    numberDisplay.textContent = formatForDisplay(phoneNumber);

    // The number is locked during a call, so editing is disabled then.
    backspaceButton.disabled = isEmpty || inCall;
    clearButton.disabled = isEmpty || inCall;
    contactsButton.disabled = inCall;

    // Keys are off while dialing, but work during a connected call
    // (for menus like "press 1 for...").
    keypadButtons.forEach(function (button) {
        button.disabled = callStatus === "calling";
    });

    contactsPanel.hidden = !isContactsOpen;
    contactsButton.setAttribute("aria-expanded", String(isContactsOpen));

    // Status line and timer.
    callStatusText.textContent = STATUS_LABELS[callStatus];
    callStatusText.classList.toggle("is-warning", callStatus === "not-approved");
    callTimer.hidden = !isConnected;
    if (isConnected) {
        callTimer.textContent = formatDuration(Date.now() - callStartTime);
    }

    // Mute is only offered during a connected call.
    muteButton.hidden = !isConnected;
    muteButton.classList.toggle("is-muted", isMuted);
    muteButton.textContent = isMuted ? "Unmute" : "Mute";
    muteButton.setAttribute("aria-pressed", String(isMuted));

    // Red "End call" during a call; green "Call" otherwise.
    callButton.classList.toggle("in-call", inCall);
    callButton.textContent = inCall ? "End call" : "Call";
    // Nothing to dial yet, so Call is disabled (End call never is).
    callButton.disabled = isEmpty && !inCall;
}

// ----- Sounds -----
// The sound that is currently playing, if any, so a new sound can stop it.
let currentSound = null;

function playSound(fileName) {
    if (currentSound) {
        currentSound.pause();
    }
    currentSound = new Audio(`audio/${fileName}`);
    // play() returns a Promise; .catch() logs a problem (such as a missing
    // file) to the Console instead of failing silently.
    currentSound.play().catch(function (error) {
        console.error(`Could not play ${fileName}:`, error);
    });
}

// "*" and "#" can't go in file names nicely, so they get word names.
const KEY_SOUND_NAMES = {
    "*": "star",
    "#": "pound",
};

// "5" -> key-5.mp3, "*" -> key-star.mp3, "#" -> key-pound.mp3
function playKeySound(digit) {
    if (digit === "0") {
        return; // No recording for 0 yet.
    }
    const name = KEY_SOUND_NAMES[digit] || digit;
    playSound(`key-${name}.mp3`);
}

// ----- Actions -----
function appendDigit(digit) {
    if (phoneNumber.length >= MAX_LENGTH) {
        return;
    }
    phoneNumber = phoneNumber + digit;
    updateDisplay();
}

function removeLastDigit() {
    phoneNumber = phoneNumber.slice(0, -1);
    updateDisplay();
}

function clearNumber() {
    phoneNumber = "";
    updateDisplay();
}

// A keypad key was pressed (on screen or on the keyboard).
// During a call it only plays its tone; otherwise it also dials the digit.
function handleKeyPress(digit) {
    playKeySound(digit);
    if (!isInCall()) {
        appendDigit(digit);
    }
}

// ----- Contacts -----
function toggleContacts() {
    isContactsOpen = !isContactsOpen;
    if (isContactsOpen) {
        playSound("contacts.mp3");
    }
    updateDisplay();
}

function selectContact(contact) {
    phoneNumber = contact.number;
    isContactsOpen = false;
    updateDisplay();
}

// Build one list item per contact. textContent (not innerHTML) keeps any
// name exactly as text, even if it contains characters like < or >.
function buildContactsList() {
    CONTACTS.forEach(function (contact) {
        const nameText = document.createElement("span");
        nameText.className = "contact-name";
        nameText.textContent = contact.name;

        const numberText = document.createElement("span");
        numberText.className = "contact-number";
        numberText.textContent = formatForDisplay(contact.number);

        const button = document.createElement("button");
        button.type = "button";
        button.className = "contact";
        button.append(nameText, numberText);
        button.addEventListener("click", function () {
            selectContact(contact);
        });

        const listItem = document.createElement("li");
        listItem.append(button);
        contactsList.append(listItem);
    });
}

// ----- Approved numbers -----
// "12025550101" -> "2025550101". Drops a typed +1 country code so a number
// matches its contact whether or not the 1 was dialed.
function withoutCountryCode(digits) {
    if (digits.length === 11 && digits.startsWith("1")) {
        return digits.slice(1);
    }
    return digits;
}

// True if the number belongs to someone in CONTACTS.
// .some() returns true as soon as one contact matches.
function isApprovedNumber(number) {
    const dialed = withoutCountryCode(number);
    return CONTACTS.some(function (contact) {
        return withoutCountryCode(contact.number) === dialed;
    });
}

// ----- Calls (simulated) -----
// Show a temporary status (like "Call ended"), then go back to "idle".
function returnToIdleAfter(milliseconds) {
    resetStatusTimeoutId = setTimeout(function () {
        callStatus = "idle";
        updateDisplay();
    }, milliseconds);
}

// No real call is placed yet. When calling is added, startCall() will
// also ask the phone service to dial phoneNumber.
function startCall() {
    clearTimeout(resetStatusTimeoutId); // in case a temporary status is still showing
    isContactsOpen = false;

    if (!isApprovedNumber(phoneNumber)) {
        rejectNonApprovedNumber();
        return;
    }

    callStatus = "calling";
    updateDisplay();
    playSound("calling.mp3");

    // Pretend the other side answers after a short delay. Real calling
    // code will instead call connectCall() when the service says "answered".
    connectTimeoutId = setTimeout(connectCall, SIMULATED_CONNECT_DELAY);
}

function connectCall() {
    callStatus = "connected";
    callStartTime = Date.now();
    // Redraw once a second so the timer counts up.
    callTimerIntervalId = setInterval(updateDisplay, 1000);
    updateDisplay();
}

// Ends the call however it ended: the user pressed End call, or (later)
// the phone service reports that the other side disconnected. Both paths
// should call this one function so the page always resets the same way.
function endCall() {
    clearTimeout(connectTimeoutId);       // stop a call that hasn't connected yet
    clearInterval(callTimerIntervalId);   // stop the timer
    callStatus = "ended";
    isMuted = false;
    updateDisplay();
    playSound("call-ended.mp3");
    returnToIdleAfter(CALL_ENDED_DISPLAY_TIME);
}

// The number isn't a contact, so no call is started. The number stays on
// the display so the user can see what they dialed and fix it.
function rejectNonApprovedNumber() {
    callStatus = "not-approved";
    updateDisplay();
    playSound("non-approved-number.mp3");
    returnToIdleAfter(NON_APPROVED_DISPLAY_TIME);
}

function handleCallButtonClick() {
    if (isInCall()) {
        endCall();
    } else {
        startCall();
    }
}

// Only changes the button for now. With real calling, this will also
// turn the microphone's audio track off and on.
function toggleMute() {
    isMuted = !isMuted;
    updateDisplay();
}

// ----- Keyboard input -----
// The on-screen key for a digit, e.g. "5" -> the button with data-digit="5".
function findKeyButton(digit) {
    return Array.from(keypadButtons).find(function (button) {
        return button.dataset.digit === digit;
    });
}

// Briefly show a key as pressed, so keyboard typing animates the keypad.
function flashKey(button) {
    button.classList.add("is-pressed");
    setTimeout(function () {
        button.classList.remove("is-pressed");
    }, 100);
}

function handleKeyDown(event) {
    // Ignore held-down repeats and shortcuts like Ctrl+R.
    if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) {
        return;
    }

    const keyButton = findKeyButton(event.key);
    if (keyButton) {
        event.preventDefault();
        if (!keyButton.disabled) {
            handleKeyPress(event.key);
            flashKey(keyButton);
        }
        return;
    }

    if (event.key === "Backspace") {
        event.preventDefault();
        if (!backspaceButton.disabled) {
            removeLastDigit();
        }
    } else if (event.key === "Enter") {
        // Let Enter work normally on a focused contact.
        if (contactsPanel.contains(document.activeElement)) {
            return;
        }
        // preventDefault stops Enter from also "clicking" a focused button.
        event.preventDefault();
        if (!callButton.disabled) {
            handleCallButtonClick();
        }
    } else if (event.key === "Escape") {
        if (isInCall()) {
            endCall();
        } else if (isContactsOpen) {
            toggleContacts();
        }
    }
}

// ----- Wiring buttons to actions -----
keypadButtons.forEach(function (button) {
    button.addEventListener("click", function () {
        handleKeyPress(button.dataset.digit);
    });
});

backspaceButton.addEventListener("click", removeLastDigit);
clearButton.addEventListener("click", clearNumber);
contactsButton.addEventListener("click", toggleContacts);
callButton.addEventListener("click", handleCallButtonClick);
muteButton.addEventListener("click", toggleMute);
document.addEventListener("keydown", handleKeyDown);

// Set up the page when it loads.
buildContactsList();
updateDisplay();
