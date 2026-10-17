// ----- State -----
// The typed number lives in this variable. The page only *shows* it;
// this variable is the single source of truth.
let phoneNumber = "";

// true while a (simulated) call is active, false otherwise.
let isInCall = false;

// E.164, the international phone-number standard, allows at most 15 digits.
const MAX_LENGTH = 15;

// ----- Page elements -----
// Look each element up once and keep a reference to it.
const numberDisplay = document.getElementById("number-display");
const backspaceButton = document.getElementById("backspace-button");
const clearButton = document.getElementById("clear-button");
const keypadButtons = document.querySelectorAll(".key");
const callButton = document.getElementById("call-button");

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

// ----- Display -----
// Copy the current state onto the page. Every change to phoneNumber
// is followed by a call to this function.
function updateDisplay() {
    numberDisplay.textContent = formatForDisplay(phoneNumber);

    // The number is locked during a call, so editing is disabled then.
    const isEmpty = phoneNumber.length === 0;
    backspaceButton.disabled = isEmpty || isInCall;
    clearButton.disabled = isEmpty || isInCall;
    keypadButtons.forEach(function (button) {
        button.disabled = isInCall;
    });

    // Red "End call" during a call; green "Call" otherwise.
    callButton.classList.toggle("in-call", isInCall);
    callButton.textContent = isInCall ? "End call" : "Call";
    // Nothing to dial yet, so Call is disabled (End call never is).
    callButton.disabled = isEmpty && !isInCall;
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

// ----- Calls (simulated) -----
// No real call is placed yet. When calling is added, startCall() will
// also ask the phone service to dial phoneNumber.
function startCall() {
    isInCall = true;
    updateDisplay();
    playSound("calling.mp3");
}

// Ends the call however it ended: the user pressed End call, or (later)
// the phone service reports that the other side disconnected. Both paths
// should call this one function so the page always resets the same way.
function endCall() {
    isInCall = false;
    updateDisplay();
    playSound("call-ended.mp3");
}

function handleCallButtonClick() {
    if (isInCall) {
        endCall();
    } else {
        startCall();
    }
}

// ----- Wiring buttons to actions -----
keypadButtons.forEach(function (button) {
    button.addEventListener("click", function () {
        playKeySound(button.dataset.digit);
        appendDigit(button.dataset.digit);
    });
});

backspaceButton.addEventListener("click", removeLastDigit);
clearButton.addEventListener("click", clearNumber);
callButton.addEventListener("click", handleCallButtonClick);

// Show the initial (empty) state when the page loads.
updateDisplay();
