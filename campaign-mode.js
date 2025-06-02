// Campaign Mode Specific Logic will go here

console.log("campaign-mode.js loaded");

const ATTEMPTS_PER_QUOTA_LEVEL = 5; // User-defined number of attempts per quota level

// Global variable to indicate which mode is active (or manage this via a more robust state manager later)
// This will be set by main.js when a mode is selected.
// let currentCampaignData = {}; // Example structure for campaign-specific state

// Campaign Run State Variables
let campaignRunActive = false;
// currentRunCapital is removed, chips are managed by campaignPlayer.chips per attempt
let currentQuota = 0;
let currentRunProfit = 0; // Cumulative profit from successful quota levels
let gamesPlayedInRun = 0; // Number of quotas successfully cleared
let runAttemptsLeftForQuota = ATTEMPTS_PER_QUOTA_LEVEL;
let campaignGameInProgress = false;
let campaignBetLockedForRide = false; // NEW: To lock bet after R1 draw of a ride sequence
let campaignPreviousRideBet = 0; // QoL: Store the bet from the previous completed ride sequence

const baseStartingCapital = 1000; // Capital for each new game attempt for a quota
const baseInitialQuota = 1500;    
const quotaIncreaseFactor = 1.2;  

let campaignPlayer = { 
    name: "Campaigner",
    chips: 0, // Current chips within an attempt for a quota
    lastBet: 0,
    // historicalBet: 0, // Less relevant in this model
    currentChoice: undefined,
    eliminated: false, // Not used, busting is chip-based
    debt: 0 
};

let campaignDeck = [];
let campaignDrawnCards = [];
let campaignCurrentRound = 1;
let campaignGamePhase = PHASE_BETTING; 

// These multipliers can be upgraded in the shop during a run
let campaignRunRoundMultipliers = {}; 
let campaignRunBuffs = []; // For other passive or active buffs

// --- CAMPAIGN LIFECYCLE ---
function initializeCampaignMode() {
    console.log("Campaign Mode Initializing...");
    if (!campaignRunActive) {
        startNewCampaignRun(); 
    } else {
        // If resuming an active run, UI should reflect current state.
        // For now, complex save/load is not implemented. If run was active, it means browser wasn't closed.
        // A refresh might lead to inconsistent state if not handled with localStorage persistence for the whole run.
        // Simplest for now: if campaignRunActive is true but page reloaded, it might be best to restart the run.
        // Or, assume if campaignRunActive is true, the existing variables are fine (for session persistence).
        console.log("Resuming existing campaign session (state assumed persistent). Current Quota: ", currentQuota);
        updateCampaignUI(); 
    }
}

function startNewCampaignRun() {
    console.log("Starting a new Campaign Run...");
    campaignRunActive = true;
    currentRunProfit = 0;
    gamesPlayedInRun = 0;
    runAttemptsLeftForQuota = ATTEMPTS_PER_QUOTA_LEVEL; // Use constant here
    
    campaignRunRoundMultipliers = { ...BASE_ROUND_MULTIPLIERS }; 
    campaignRunBuffs = [];

    currentQuota = baseInitialQuota;
    
    console.log(`New Run: Initial Quota: ${currentQuota}, Attempts for Quota: ${runAttemptsLeftForQuota}`);
    showGameNotification(`New Campaign Run! Quota: ${currentQuota}. Attempts: ${runAttemptsLeftForQuota}. Starting Capital: ${baseStartingCapital}`, 'info', 5000);
    
    campaignBetLockedForRide = false; // Reset on new run
    startNewAttemptForCurrentQuota();
}

// Called when starting a new "life"/run attempt for the current quota level (e.g. new run, or new QUOTA LEVEL)
// This RESETS chips to baseStartingCapital.
function startNewAttemptForCurrentQuota() {
    console.log(`[CMP] Starting New Full Attempt for Quota: ${currentQuota}. Previous Ride Bet was: ${campaignPreviousRideBet}`);
    campaignPlayer.chips = baseStartingCapital;
    campaignBetLockedForRide = false; 
    campaignCurrentRound = 1;
    campaignDeck = createInitialDeck();
    campaignDrawnCards = [];
    campaignGamePhase = PHASE_BETTING;
    campaignGameInProgress = true; 
    campaignPlayer.lastBet = campaignPlayer.chips > 0 ? 1 : 0;
    campaignPlayer.currentChoice = undefined;
    console.log(`[CMP] Full Attempt Started. Chips: ${campaignPlayer.chips}. Initial Bet: ${campaignPlayer.lastBet}.`);
    updateCampaignUI();
}

// Called to start a new "Ride the Bus" sequence WITHIN the current quota level and current chip stack.
// This does NOT reset chips to baseStartingCapital. It continues the current "attempt for quota".
function startNewRideSequence() {
    if (!campaignRunActive) {
        console.warn("[CMP] startNewRideSequence called but run is not active. Aborting.");
        return;
    }
    console.log(`[CMP] Starting New Ride Sequence. Chips: ${campaignPlayer.chips}. Attempts left: ${runAttemptsLeftForQuota}. Prev Ride Bet: ${campaignPreviousRideBet}`);
    campaignBetLockedForRide = false; 
    campaignCurrentRound = 1;
    campaignDeck = createInitialDeck();
    campaignDrawnCards = [];
    campaignGamePhase = PHASE_BETTING;
    campaignGameInProgress = true; 
    campaignPlayer.lastBet = campaignPlayer.chips > 0 ? 1 : 0; 
    campaignPlayer.currentChoice = undefined;
    showGameNotification(`Starting new Ride the Bus sequence. Chips: ${campaignPlayer.chips}. Attempts left: ${runAttemptsLeftForQuota}.`, 'info', 3500);
    updateCampaignUI();
}

// --- UI UPDATES (Campaign Specific) ---
function updateCampaignUI() {
    console.log("Updating Campaign UI...");
    const campaignStatusDisp = document.getElementById('campaignStatusDisplay');
    if (campaignStatusDisp) {
        campaignStatusDisp.style.display = 'block';
        let statusText = `Run Profit: ${currentRunProfit} | Quota: ${currentQuota} | Chips: ${campaignPlayer.chips} | Attempts for Quota: ${runAttemptsLeftForQuota}`;
        if (!campaignRunActive) {
             statusText = `Run Over! Final Profit: ${currentRunProfit}. Games Cleared: ${gamesPlayedInRun}.`;
        } else if (campaignGamePhase === PHASE_GAME_OVER && campaignGameInProgress === false) {
            // This state occurs after a bust or player chooses to check quota, before next attempt/level or run end.
            statusText += ` | Sequence Ended.`; 
        }
        campaignStatusDisp.textContent = statusText;
    }
    updateCampaignPlayerDisplay();
    updateCampaignRoundInfo();
    updateCampaignGameButtons();
    updateCampaignDeckDisplay();
    updateCampaignDrawnCardsDisplay();
    updateCampaignDebugDisplay(); 
}

function updateCampaignPlayerDisplay() {
    console.log("[CMP] updateCampaignPlayerDisplay: CALLED");
    const playerArea = document.getElementById('campaignPlayersPanel');
    if (!playerArea) {
        console.error("[CMP] updateCampaignPlayerDisplay: ERROR - campaignPlayersPanel element NOT FOUND!");
        return;
    }
    playerArea.innerHTML = ''; // Clear for fresh render
    // Basic styling to ensure visibility
    playerArea.style.display = 'flex'; 
    playerArea.style.flexDirection = 'column'; 

    if (!campaignRunActive || !campaignGameInProgress) {
        console.log("[CMP] updateCampaignPlayerDisplay: Run not active or game not in progress. No player controls to show.");
        // Optionally display a message in playerArea if desired
        // playerArea.textContent = "Campaign game sequence not active.";
        return;
    }

    const playerDiv = document.createElement('div');
    playerDiv.className = 'player-controls';

    const headerRow = document.createElement('div');
    headerRow.className = 'player-header-row';
    const nameDiv = document.createElement('div');
    nameDiv.className = 'player-name';
    nameDiv.textContent = campaignPlayer.name;
    const chipsDiv = document.createElement('div');
    chipsDiv.className = 'player-chips';
    chipsDiv.textContent = `Chips: ${campaignPlayer.chips}`;
    headerRow.appendChild(nameDiv);
    headerRow.appendChild(chipsDiv);
    playerDiv.appendChild(headerRow);

    const betRow = document.createElement('div');
    betRow.className = 'player-bet-row';
    const betInput = document.createElement('input');
    betInput.type = 'number';
    betInput.id = `betInput_campaign`;
    betInput.value = campaignPlayer.lastBet > 0 ? campaignPlayer.lastBet : (campaignPlayer.chips > 0 ? 1 : 0);
    betInput.min = 0;
    betInput.max = campaignPlayer.chips > 0 ? campaignPlayer.chips : 0;
    betInput.readOnly = campaignBetLockedForRide || campaignGamePhase === PHASE_PLAYING || campaignPlayer.chips <= 0;

    betInput.oninput = () => {
        let newBetTyped = betInput.value;
        let newBet = parseInt(newBetTyped) || 0;

        if (newBet < 0) newBet = 0;

        let correctedBetValue = false;
        if (newBet > campaignPlayer.chips) {
            newBet = campaignPlayer.chips;
            betInput.value = newBet; // Correct visual input immediately
            correctedBetValue = true;
            // Avoid spamming notifications if user is just holding down backspace or typing beyond limit
            // This simple check might still notify frequently, could be improved with a debounce if still an issue.
            if (String(newBet) !== newBetTyped && newBetTyped !== "") { 
                 showGameNotification("Bet cannot exceed current capital. Bet adjusted.", 'warning', 2000);
            }
        }

        // If the string value in the input is not a clean number (e.g., "100a" or empty after backspace)
        // ensure newBet reflects the parsed number and input field visually matches newBet.
        if (String(newBet) !== newBetTyped) {
            // Exception: if newBetTyped is empty, newBet is 0. Don't force "0" into the field if user is clearing it.
            if (newBetTyped !== "") { 
                betInput.value = newBet; // Corrects "100a" to "100"
                correctedBetValue = true;
            }
        }

        if (campaignPlayer.lastBet !== newBet) {
            campaignPlayer.lastBet = newBet;
            console.log(`[CMP] Bet input changed (oninput). New campaignPlayer.lastBet: ${campaignPlayer.lastBet}`);
            
            updateCampaignGameButtons(); // Update draw button state, etc.

            // Dynamically update the Cash Out Mid-Ride button text and visibility
            const cashOutRow = document.getElementById('campaignCashOutRow');
            const cashOutButton = document.getElementById('campaignCashOutButton');

            if (cashOutRow && cashOutButton) {
                const 조건_canCashOut = campaignGamePhase === PHASE_BETTING && 
                                   campaignCurrentRound > 1 && 
                                   campaignCurrentRound <= 5 && 
                                   campaignPlayer.lastBet > 0;

                if (조건_canCashOut) {
                    const cashOutMultiplier = campaignRunRoundMultipliers[campaignCurrentRound - 1] || BASE_ROUND_MULTIPLIERS[campaignCurrentRound - 1];
                    const potentialCashOutValue = campaignPlayer.lastBet * cashOutMultiplier;
                    cashOutButton.textContent = `Cash Out (R${campaignCurrentRound - 1} Win: ${potentialCashOutValue} chips)`;
                    cashOutRow.style.display = 'flex'; 
                } else {
                    cashOutRow.style.display = 'none';
                }
            }
        } 
        // No full updateCampaignUI() or updateCampaignPlayerDisplay() here to preserve focus
    };

    if (campaignPlayer.chips <= 0 && campaignGamePhase !== PHASE_PLAYING) {
        campaignPlayer.lastBet = 0;
        betInput.value = 0;
    }

    betRow.appendChild(betInput); // Add input first

    // Add "Use Last Bet" button to the right of the input
    if (!campaignBetLockedForRide && campaignPreviousRideBet > 0 && campaignPlayer.chips >= campaignPreviousRideBet) {
        const useLastBetButton = document.createElement('button');
        useLastBetButton.textContent = `Use Last Bet (${campaignPreviousRideBet})`;
        useLastBetButton.className = 'use-last-bet-button'; 
        useLastBetButton.style.marginLeft = '5px'; // Keep some margin
        useLastBetButton.onclick = () => {
            if (!campaignBetLockedForRide && campaignPlayer.chips >= campaignPreviousRideBet) {
                campaignPlayer.lastBet = campaignPreviousRideBet;
                betInput.value = campaignPlayer.lastBet; 
                updateCampaignPlayerDisplay(); 
            }
        };
        betRow.appendChild(useLastBetButton); // Append after input
    }
    playerDiv.appendChild(betRow);

    const choiceButtonsContainer = document.createElement('div');
    choiceButtonsContainer.className = 'choice-buttons';
    let choices = [];

    // Choices are relevant only if in betting phase and player has >0 chips and has placed a bet
    // Or if in PHASE_PLAYING and it's a round that requires a subsequent choice (not really in this model anymore)
    const canMakeChoice = campaignGamePhase === PHASE_BETTING && campaignPlayer.chips > 0 && campaignPlayer.lastBet > 0;

    if (canMakeChoice) {
        switch (campaignCurrentRound) {
            case 1: choices = [CHOICE_RED, CHOICE_BLACK]; break;
            case 2: choices = [CHOICE_HIGHER, CHOICE_LOWER]; break;
            case 3: choices = [CHOICE_INSIDE, CHOICE_OUTSIDE]; break;
            case 4: choices = [SUIT_SPADES, SUIT_HEARTS, SUIT_DIAMONDS, SUIT_CLUBS]; break;
            case 5: 
                const valueSelect = document.createElement('select');
                valueSelect.id = `r5_value_select_campaign`;
                valueSelect.className = 'choice-button'; // Style as button
                const placeholderOption = document.createElement('option');
                placeholderOption.value = "";
                placeholderOption.textContent = "Guess Value...";
                placeholderOption.selected = true; placeholderOption.disabled = true;
                valueSelect.appendChild(placeholderOption);
                CARD_VALUES_WITH_ACE_HIGH.forEach(val => {
                    const option = document.createElement('option');
                    option.value = val; option.textContent = val;
                    valueSelect.appendChild(option);
                });
                if (campaignPlayer.currentChoice) valueSelect.value = campaignPlayer.currentChoice;
                valueSelect.onchange = function() { if (this.value) makeCampaignChoice(this.value); };
                choiceButtonsContainer.appendChild(valueSelect);
                choices = []; // Prevent standard button generation for R5
                break;
            default: choices = []; break;
        }

        choices.forEach(choiceText => {
            const button = document.createElement('button');
            button.className = 'choice-button';
            button.textContent = choiceText.charAt(0).toUpperCase() + choiceText.slice(1);
            button.onclick = () => makeCampaignChoice(choiceText);
            if (campaignPlayer.currentChoice && choiceText.toLowerCase() === campaignPlayer.currentChoice.toLowerCase()) {
                button.classList.add('selected');
            }
            choiceButtonsContainer.appendChild(button);
        });
    }

    // Add Cash Out Mid-Ride button if applicable
    // This section now primarily handles the INITIAL creation and visibility.
    // The oninput handler above will manage dynamic updates to text/visibility based on bet changes.
    const canShowCashOutInitially = campaignGamePhase === PHASE_BETTING && campaignCurrentRound > 1 && campaignCurrentRound <= 5 && campaignPlayer.lastBet > 0;
    
    const cashOutRow = document.createElement('div');
    cashOutRow.id = 'campaignCashOutRow'; // Assign ID
    cashOutRow.style.marginTop = '10px';
    cashOutRow.style.display = canShowCashOutInitially ? 'flex' : 'none'; // Initial visibility
    cashOutRow.style.justifyContent = 'center';

    const cashOutButton = document.createElement('button');
    cashOutButton.id = 'campaignCashOutButton'; // Assign ID
    cashOutButton.className = 'draw-button cash-out-mid-ride'; 
    cashOutButton.style.padding = '0.5rem 1rem'; 
    cashOutButton.style.fontSize = '1rem'; 
    cashOutButton.onclick = () => handleCashOutMidRide();
    
    if (canShowCashOutInitially) {
        const cashOutMultiplier = campaignRunRoundMultipliers[campaignCurrentRound - 1] || BASE_ROUND_MULTIPLIERS[campaignCurrentRound - 1];
        const potentialCashOutValue = campaignPlayer.lastBet * cashOutMultiplier;
        cashOutButton.textContent = `Cash Out (R${campaignCurrentRound - 1} Win: ${potentialCashOutValue} chips)`;
    } else {
        cashOutButton.textContent = "Cash Out"; // Default or placeholder text when hidden
    }

    cashOutRow.appendChild(cashOutButton);
    playerDiv.appendChild(cashOutRow); 

    if (choiceButtonsContainer.hasChildNodes()) {
        playerDiv.appendChild(choiceButtonsContainer);
    }

    playerArea.appendChild(playerDiv);
    console.log("[CMP] updateCampaignPlayerDisplay: Player controls updated.");
}

function makeCampaignChoice(choice) {
    if (!campaignRunActive || !campaignGameInProgress || !campaignPlayer || campaignPlayer.lastBet <= 0) {
        console.warn(`[CMP] makeCampaignChoice: Conditions not met. Choice: ${choice}, Bet: ${campaignPlayer ? campaignPlayer.lastBet : 'N/A'}`);
        showGameNotification("Place a bet before making a choice.", "warning");
        return;
    }
    campaignPlayer.currentChoice = choice;
    console.log(`[CMP] makeCampaignChoice: Choice made: "${choice}".`);
    updateCampaignUI(); // Update UI to reflect choice (e.g., button selection, enable draw button)
}

function updateCampaignRoundInfo() {
    console.log("updateCampaignRoundInfo called");
    const roundInfoEl = document.getElementById('roundInfo');
    const multiplierInfoEl = document.getElementById('roundMultiplier');
    if (!roundInfoEl || !multiplierInfoEl) return;

    if (!campaignRunActive) {
        roundInfoEl.textContent = `Run Over! Final Profit: ${currentRunProfit}. Games Cleared: ${gamesPlayedInRun}.`;
        multiplierInfoEl.textContent = 'Start a new campaign from the main menu.';
        return;
    }
    if (!campaignGameInProgress && campaignRunActive) {
        // This state is after a bust/quota attempt, before next attempt or if run ended by failing last attempt
        roundInfoEl.textContent = `Sequence ended. Waiting for next action.`;
        multiplierInfoEl.textContent = `Attempts for Quota ${currentQuota}: ${runAttemptsLeftForQuota}. Chips: ${campaignPlayer.chips}`; 
        return;
    }

    // If campaignGameInProgress is true:
    let roundText = `Round ${campaignCurrentRound}: `;
    let multText = `(Current Bet: ${campaignPlayer.lastBet}) `;

    if (campaignGamePhase === PHASE_BETTING) {
        roundText += `Place Bet & Choose for R${campaignCurrentRound}.`;
         if (campaignPlayer.chips <= 0) {
             multText = `No capital to bet! This attempt is over.`; // This case should be handled by bust logic primarily
        } else if (campaignPlayer.lastBet > 0 && !campaignPlayer.currentChoice) {
            multText = `Waiting for choice for R${campaignCurrentRound}.`;
        } else if (campaignPlayer.lastBet > 0 && campaignPlayer.currentChoice) {
            multText = 'Ready to Draw!';
        } else {
            multText = `Chips: ${campaignPlayer.chips}. Min Bet: 1.`;
        }
    } else if (campaignGamePhase === PHASE_PLAYING) { // Technically, after drawing, it goes back to BETTING for next choice/round
        // This phase is very brief, mainly during card draw animation.
        // The important info is current round being played.
        roundText += `Playing Round ${campaignCurrentRound}...`;
        multText = `Bet was ${campaignPlayer.lastBet}.`;
    }
    
    // Round-specific instructions are clearer with choices in player display
    switch (campaignCurrentRound) {
        case 1: roundInfoEl.textContent = roundText + (campaignGamePhase === PHASE_BETTING ? 'Red or Black?' : ''); break;
        case 2: roundInfoEl.textContent = roundText + (campaignGamePhase === PHASE_BETTING ? 'Higher or Lower?' : ''); break;
        case 3: roundInfoEl.textContent = roundText + (campaignGamePhase === PHASE_BETTING ? 'Inside or Outside?' : ''); break;
        case 4: roundInfoEl.textContent = roundText + (campaignGamePhase === PHASE_BETTING ? 'Guess the Suit' : ''); break;
        case 5: roundInfoEl.textContent = roundText + (campaignGamePhase === PHASE_BETTING ? 'Guess Value' : ''); break;
        default: roundInfoEl.textContent = roundText; break;
    }
    multiplierInfoEl.textContent = multText;
}

function updateCampaignGameButtons() {
    console.log("updateCampaignGameButtons called");
    const newGameButton = document.getElementById('newGameButton'); 
    const drawCardButton = document.getElementById('drawCardButton');
    const completeQuotaButton = document.getElementById('completeQuotaButton'); // Changed ID

    if (!drawCardButton || !completeQuotaButton) {
        console.error("[CMP] Game buttons (drawCardButton or completeQuotaButton) not found!");
        if(newGameButton) newGameButton.style.display = 'none';
        return;
    }

    if (newGameButton) newGameButton.style.display = 'none';

    if (!campaignRunActive) {
        drawCardButton.style.display = 'none';
        completeQuotaButton.style.display = 'none';
        return;
    }

    if (campaignGameInProgress) {
        drawCardButton.style.display = '';
        completeQuotaButton.style.display = '';

        drawCardButton.textContent = `Draw for Round ${campaignCurrentRound}`;
        drawCardButton.disabled = !(campaignPlayer.lastBet > 0 && campaignPlayer.currentChoice !== undefined && campaignPlayer.chips >= campaignPlayer.lastBet && campaignGamePhase === PHASE_BETTING);
        
        completeQuotaButton.textContent = `Complete Quota (${currentQuota})`;
        completeQuotaButton.disabled = !(campaignPlayer.chips >= currentQuota); // Enabled only if chips meet/exceed quota
        
        // Apply similar styling to drawCardButton if desired (assuming they share a common class or need specific styles)
        // For example, if they both use a class like 'game-action-button' that could be styled in CSS.
        // If not, ensure 'completeQuotaButton' has appropriate styles applied in CSS or here.

    } else {
        drawCardButton.style.display = 'none'; 
        completeQuotaButton.style.display = 'none'; 
    }
}

function updateCampaignDeckDisplay() {
    console.log("updateCampaignDeckDisplay called");
    const deckDiv = document.getElementById('deck');
    if (deckDiv) {
        deckDiv.setAttribute('data-count', campaignDeck.length > 0 ? campaignDeck.length : 'Empty');
    }
}

function updateCampaignDrawnCardsDisplay(animateLastCard = false) {
    console.log("updateCampaignDrawnCardsDisplay called");
    const container = document.getElementById('drawnCards');
    if (!container) return;
    container.innerHTML = '';
    campaignDrawnCards.forEach((card, index) => {
        const cardElement = document.createElement('div');
        cardElement.className = 'card';
        cardElement.style.color = [SUIT_HEARTS, SUIT_DIAMONDS].includes(card.suit) ? 'red' : 'black';
        cardElement.textContent = `${card.value}${card.suit}`;
        if (animateLastCard && index === campaignDrawnCards.length - 1) {
            cardElement.classList.add('drawn-card-target');
        }
        container.appendChild(cardElement);
    });
}

function updateCampaignDebugDisplay() {
    console.log("updateCampaignDebugDisplay called (placeholder)");
    // Similar to classic updateDebugNextCardDisplay but uses campaignDeck
    const debugNextCardDiv = document.getElementById('debugNextCard');
    const toggleCheckbox = document.getElementById('toggleDebugNextCard');
    if (!debugNextCardDiv || !toggleCheckbox) return;
    
    const isChecked = toggleCheckbox.checked;
    // Basic theme check for default color - can be enhanced
    const defaultTextColor = getComputedStyle(document.body).getPropertyValue('--ncc-text').trim();

    if (!isChecked) {
        debugNextCardDiv.textContent = 'Next Card: (Hidden)';
        debugNextCardDiv.style.color = defaultTextColor;
        return;
    }

    if (campaignDeck && campaignDeck.length > 0) {
        const nextCard = campaignDeck[campaignDeck.length - 1];
        debugNextCardDiv.textContent = `Next Card: ${nextCard.value}${nextCard.suit}`;
        debugNextCardDiv.style.color = [SUIT_HEARTS, SUIT_DIAMONDS].includes(nextCard.suit) ? 'red' : defaultTextColor;
    } else {
        debugNextCardDiv.textContent = 'Next Card: (Deck Empty)';
        debugNextCardDiv.style.color = defaultTextColor;
    }
}

// --- GAME LOGIC (Campaign Specific) ---
async function campaignDrawCard() {
    if (!campaignRunActive || !campaignGameInProgress) {
        showGameNotification("No active campaign game to draw card for.", "warning");
        return;
    }
    if (campaignPlayer.lastBet <= 0 || !campaignPlayer.currentChoice) {
        showGameNotification('Place a valid bet and make a choice before drawing.', 'warning');
        return;
    }
    if (campaignPlayer.chips < campaignPlayer.lastBet) {
        showGameNotification(`Not enough chips (${campaignPlayer.chips}) for bet (${campaignPlayer.lastBet}). Lower your bet.`, 'warning');
        return;
    }

    // Lock the bet if this is the first card of a new ride sequence (R1, betting phase)
    if (campaignCurrentRound === 1 && campaignGamePhase === PHASE_BETTING) {
        if (campaignPlayer.lastBet > 0 && campaignPlayer.chips >= campaignPlayer.lastBet) {
            campaignBetLockedForRide = true;
            console.log(`[CMP] campaignDrawCard: Bet of ${campaignPlayer.lastBet} for R1 locked. campaignBetLockedForRide = true`);
        } else {
            showGameNotification('Cannot lock bet. Invalid bet amount or insufficient chips for R1.', 'error');
            return; // Don't proceed if bet can't be locked
        }
    }

    campaignPlayer.chips -= campaignPlayer.lastBet;
    console.log(`[CMP] campaignDrawCard: Bet ${campaignPlayer.lastBet} placed. Chips remaining: ${campaignPlayer.chips}.`);

    if (campaignGamePhase === PHASE_BETTING) { 
        campaignGamePhase = PHASE_PLAYING;
    }

    if (campaignDeck.length === 0) {
        showGameNotification("Deck is empty! This shouldn't happen mid-attempt. Attempt will restart.", 'error');
        handleBust(); // Treat as a bust for this attempt if deck runs out unexpectedly
        return;
    }
    const card = campaignDeck.pop();
    if (!card) { 
        showGameNotification("Failed to draw card. Attempt will restart.", 'error');
        handleBust();
        return; 
    }

    // Animation logic (ensure it's correct and uses 'drawnCards')
    const deckElement = document.getElementById('deck');
    const gameBoardPanel = document.getElementById('gameBoardPanel');
    const actualDrawnCardsContainer = document.getElementById('drawnCards');
    if (deckElement && gameBoardPanel && actualDrawnCardsContainer) {
        const ghostCard = document.createElement('div');
        ghostCard.style.position = 'absolute';
        ghostCard.style.width = deckElement.offsetWidth + 'px';
        ghostCard.style.height = deckElement.offsetHeight + 'px';
        ghostCard.style.background = getComputedStyle(deckElement).background;
        ghostCard.style.borderRadius = getComputedStyle(deckElement).borderRadius;
        ghostCard.style.border = getComputedStyle(deckElement).border;
        ghostCard.style.boxShadow = getComputedStyle(deckElement).boxShadow;
        ghostCard.style.display = 'flex';
        ghostCard.style.alignItems = 'center';
        ghostCard.style.justifyContent = 'center';
        ghostCard.style.zIndex = '1000';
        ghostCard.style.transition = 'transform 0.5s ease-in-out, opacity 0.4s ease-in-out, width 0.5s ease-in-out, height 0.5s ease-in-out';
        const deckRect = deckElement.getBoundingClientRect();
        const boardRect = gameBoardPanel.getBoundingClientRect();
        ghostCard.style.left = (deckRect.left - boardRect.left) + 'px';
        ghostCard.style.top = (deckRect.top - boardRect.top) + 'px';
        gameBoardPanel.appendChild(ghostCard);
        campaignDrawnCards.push(card);
        updateCampaignDrawnCardsDisplay(true);
        const actualCardElement = actualDrawnCardsContainer.lastElementChild;
        if (actualCardElement) {
            const targetRect = actualCardElement.getBoundingClientRect();
            requestAnimationFrame(() => {
                ghostCard.style.transform = `translate(${(targetRect.left - deckRect.left)}px, ${(targetRect.top - deckRect.top)}px) scale(1)`;
                ghostCard.style.width = targetRect.width + 'px';
                ghostCard.style.height = targetRect.height + 'px';
                ghostCard.addEventListener('transitionend', () => {
                    if (ghostCard.parentNode) ghostCard.parentNode.removeChild(ghostCard);
                    if(actualCardElement) actualCardElement.classList.remove('drawn-card-target');
                }, { once: true });
            });
        } else {
            if (ghostCard.parentNode) ghostCard.parentNode.removeChild(ghostCard);
        }
    } else {
      campaignDrawnCards.push(card); // Non-animated version if elements missing
      updateCampaignDrawnCardsDisplay();
    }

    campaignProcessRoundResults(card);
}

function campaignProcessRoundResults(drawnCard) {
    console.log(`[CMP] Processing R${campaignCurrentRound}. Card: ${drawnCard.value}${drawnCard.suit}. Chips before result: ${campaignPlayer.chips}. Bet: ${campaignPlayer.lastBet}. Attempts left: ${runAttemptsLeftForQuota}`);
    let playerWinsThisRound = false;
    const numericalDrawnCardValue = getCardValue(drawnCard.value);
    switch (campaignCurrentRound) {
        case 1: playerWinsThisRound = evaluateRound1Win(campaignPlayer.currentChoice, drawnCard.suit); break;
        case 2: playerWinsThisRound = evaluateRound2Win(campaignPlayer.currentChoice, numericalDrawnCardValue, getCardValue(campaignDrawnCards[campaignDrawnCards.length - 2].value)); break;
        case 3: playerWinsThisRound = evaluateRound3Win(campaignPlayer.currentChoice, numericalDrawnCardValue, getCardValue(campaignDrawnCards[0].value), getCardValue(campaignDrawnCards[1].value)); break;
        case 4: playerWinsThisRound = evaluateRound4Win(campaignPlayer.currentChoice, drawnCard.suit); break;
        case 5: playerWinsThisRound = evaluateRound5Win(campaignPlayer.currentChoice, drawnCard.value); break;
    }

    campaignGameInProgress = false; 
    let rideEndingBet = campaignPlayer.lastBet; // Capture the bet of the ride that's ending

    if (playerWinsThisRound) {
        showGameNotification(`Won Round ${campaignCurrentRound}!`, 'success', 2000);
        if (campaignCurrentRound === 5) { 
            const multiplier = campaignRunRoundMultipliers[5] || BASE_ROUND_MULTIPLIERS[5];
            const winnings = campaignPlayer.lastBet * multiplier; 
            campaignPlayer.chips += winnings; 
            console.log(`[CMP] R5 WIN! Initial Bet: ${campaignPlayer.lastBet}, Multiplier: ${multiplier}, Total Added: ${winnings}. Final Chips: ${campaignPlayer.chips}`);
            showGameNotification(`SUCCESS! Rode the Bus! Chips: ${campaignPlayer.chips}.`, 'success', 4000);
            if (rideEndingBet > 0) campaignPreviousRideBet = rideEndingBet;
            runAttemptsLeftForQuota--;
            console.log(`[CMP] R5 Win sequence ended. Attempt consumed. Attempts left: ${runAttemptsLeftForQuota}`);
            if (runAttemptsLeftForQuota > 0) {
                showGameNotification("Ride complete! Starting new Ride sequence...", "info", 1800);
                setTimeout(() => { startNewRideSequence(); }, 2000); 
            } else {
                if (campaignPlayer.chips >= currentQuota) {
                    showGameNotification(`R5 Win on last attempt and MET QUOTA! Chips: ${campaignPlayer.chips}.`, 'success', 6000);
                    processSuccessfulQuotaCompletion("R5 Win - Last Attempt");
                } else {
                    showGameNotification(`Run Over. R5 Win on last attempt but FAILED QUOTA of ${currentQuota}. Chips: ${campaignPlayer.chips}.`, 'error', 8000);
                    campaignRunActive = false;
                    updateCampaignUI();
                }
            }
        } else { 
            campaignPlayer.chips += campaignPlayer.lastBet; 
            console.log(`[CMP] Won R${campaignCurrentRound}. Bet of ${campaignPlayer.lastBet} won back. Chips now: ${campaignPlayer.chips}. This bet carries to next round.`);

            campaignCurrentRound++;
            campaignGamePhase = PHASE_BETTING; 
            campaignGameInProgress = true; 
            console.log(`[CMP] Advanced to R${campaignCurrentRound}. Chips: ${campaignPlayer.chips}.`);
            updateCampaignUI(); 
        }
    } else { // Player Lost Round (Incorrect Guess)
        showGameNotification(`Lost Round ${campaignCurrentRound}. Bet of ${campaignPlayer.lastBet} lost. Chips: ${campaignPlayer.chips}`, 'warning', 3000); 
        console.log(`[CMP] Lost R${campaignCurrentRound}. Bet: ${campaignPlayer.lastBet}. Chips after loss: ${campaignPlayer.chips}.`);

        if (campaignPlayer.chips <= 0) {
            console.log("[CMP] Player busted after round loss.");
            handleBust(); 
            return; 
        }
        
        if (rideEndingBet > 0) campaignPreviousRideBet = rideEndingBet;
        runAttemptsLeftForQuota--;
        console.log(`[CMP] Incorrect guess. Attempt consumed. Attempts left: ${runAttemptsLeftForQuota}`);
        
        if (runAttemptsLeftForQuota > 0) {
            showGameNotification(`Incorrect guess. Attempt lost. Starting new Ride sequence in 2s... Chips: ${campaignPlayer.chips}`, 'warning', 2000); 
            setTimeout(() => { 
                startNewRideSequence(); 
            }, 2000); 
        } else {
            if (campaignPlayer.chips >= currentQuota) {
                showGameNotification(`Lost round on last attempt but MET QUOTA! Chips: ${campaignPlayer.chips}.`, 'success', 6000);
                processSuccessfulQuotaCompletion("Lost Round - Last Attempt");
            } else {
                showGameNotification(`Run Over. Lost round on last attempt and FAILED QUOTA of ${currentQuota}. Chips: ${campaignPlayer.chips}.`, 'error', 8000);
                campaignRunActive = false;
                updateCampaignUI();
            }
        }
        return; 
    }
    if (campaignGameInProgress) { 
        campaignPlayer.currentChoice = undefined;
        updateCampaignUI();
    }
}

function handleBust() {
    if (!campaignRunActive) return; 
    showGameNotification(`BUSTED! Chips at or below 0. Campaign Run Over!`, 'error', 7000);
    console.log("[CMP] handleBust: Player busted. Campaign Run IMMEDIATELY Over.");
    campaignGameInProgress = false; 
    campaignRunActive = false; // Run ends immediately on bust
    // No decrementing runAttemptsLeftForQuota here, run is just over.
    updateCampaignUI(); 
}

// New shared function for when a quota is successfully met
function processSuccessfulQuotaCompletion(fromAction) {
    console.log(`[CMP] processSuccessfulQuotaCompletion called from: ${fromAction}. Player Chips: ${campaignPlayer.chips}, Quota: ${currentQuota}`);
    const profitFromThisQuota = campaignPlayer.chips - baseStartingCapital; // Profit is based on chips accumulated *during the attempts for this specific quota* vs the initial capital for an attempt.
    currentRunProfit += Math.max(0, profitFromThisQuota); 
    gamesPlayedInRun++; 
    
    showGameNotification(`SUCCESS! Quota of ${currentQuota} met with ${campaignPlayer.chips} chips! Profit banked: ${Math.max(0, profitFromThisQuota)}.`, 'success', 7000);
    
    currentQuota = Math.floor(currentQuota * quotaIncreaseFactor);
    runAttemptsLeftForQuota = ATTEMPTS_PER_QUOTA_LEVEL; // Reset attempts for the new quota level
    
    console.log(`[CMP] Quota met. New Quota: ${currentQuota}. Run Profit: ${currentRunProfit}. Attempts for new quota level reset to: ${runAttemptsLeftForQuota}.`);
    showGameNotification(`Next Quota Level: ${currentQuota}. Attempts for new level: ${runAttemptsLeftForQuota}. Starting Capital: ${baseStartingCapital}.`, 'info', 8000);
    
    startNewAttemptForCurrentQuota(); // Starts the first attempt for the NEW quota level
}

function handleCashOutMidRide() {
    if (!campaignRunActive || !campaignGameInProgress || campaignCurrentRound <= 1) {
        console.warn("[CMP] handleCashOutMidRide: Conditions not met.");
        showGameNotification("Cannot cash out at this point.", "warning");
        return;
    }

    const cashOutMultiplier = campaignRunRoundMultipliers[campaignCurrentRound - 1] || BASE_ROUND_MULTIPLIERS[campaignCurrentRound - 1];
    const winningsFromCashOut = campaignPlayer.lastBet * cashOutMultiplier;
    campaignPlayer.chips += winningsFromCashOut; 
    
    console.log(`[CMP] Cashed out mid-ride at R${campaignCurrentRound-1}. Bet was ${campaignPlayer.lastBet}, Won: ${winningsFromCashOut}. New Chips: ${campaignPlayer.chips}`);
    showGameNotification(`Cashed out at R${campaignCurrentRound-1} for ${winningsFromCashOut}. Total chips: ${campaignPlayer.chips}.`, 'info', 4000);

    if (campaignPlayer.lastBet > 0) campaignPreviousRideBet = campaignPlayer.lastBet; // Capture before reset
    runAttemptsLeftForQuota--;
    campaignPlayer.lastBet = 0; 
    campaignGameInProgress = false; 
    if (runAttemptsLeftForQuota > 0) {
        showGameNotification(`Cashed out. Starting new Ride the Bus sequence. Chips: ${campaignPlayer.chips}. Attempts left: ${runAttemptsLeftForQuota}.`, 'info', 5000);
        startNewRideSequence(); // Chips persist, new ride for same quota
    } else {
        // Last attempt was used up by this cash out
        console.log("[CMP] Cashed out on last attempt.");
        if (campaignPlayer.chips >= currentQuota) {
            showGameNotification(`Cashed out on last attempt and MET QUOTA! Chips: ${campaignPlayer.chips}.`, 'success', 6000);
            processSuccessfulQuotaCompletion("Cash Out - Last Attempt");
        } else {
            showGameNotification(`Run Over. Cashed out on last attempt but FAILED QUOTA of ${currentQuota}. Chips: ${campaignPlayer.chips}.`, 'error', 8000);
            campaignRunActive = false;
            updateCampaignUI(); // Update to show run over state
        }
    }
    // updateCampaignUI(); // Called by startNewRideSequence or if run ends
}

function playerCompletesQuota() { 
    if (!campaignRunActive || !campaignGameInProgress) {
        showGameNotification("No active game sequence to complete quota with.", "warning");
        return;
    }
    if (campaignPlayer.chips < currentQuota) {
        showGameNotification(`Cannot complete quota. Need ${currentQuota}, have ${campaignPlayer.chips}.`, "error");
        return;
    }
    console.log(`[CMP] Player chose to Complete Quota. Chips: ${campaignPlayer.chips}, Current Quota: ${currentQuota}.`);
    
    runAttemptsLeftForQuota--; 
    console.log(`[CMP] Attempt consumed for choosing to complete quota. Attempts for current level were ${runAttemptsLeftForQuota + 1}, now ${runAttemptsLeftForQuota}.`);
    campaignGameInProgress = false; 
    campaignGamePhase = PHASE_GAME_OVER; 

    // Since button is only enabled if chips >= quota, this condition is effectively met.
    if (campaignPlayer.lastBet > 0) campaignPreviousRideBet = campaignPlayer.lastBet; 
    processSuccessfulQuotaCompletion("playerCompletesQuota");
    updateCampaignUI(); // processSuccessfulQuotaCompletion calls startNewAttempt, which calls updateUI.
}

function prepareCampaignModeForExit() {
    console.log("Preparing Campaign Mode for exit. Resetting run state.");
    campaignRunActive = false;
    currentRunProfit = 0;
    gamesPlayedInRun = 0;

    // Reset current game variables as well
    campaignPlayer.chips = 0;
    campaignPlayer.lastBet = 0;
    campaignPlayer.currentChoice = undefined;
    campaignPlayer.eliminated = false;
    
    campaignDeck = [];
    campaignDrawnCards = [];
    campaignCurrentRound = 1;
    campaignGamePhase = PHASE_BETTING;
    campaignGameInProgress = false;
    
    // campaignRunRoundMultipliers = { ...BASE_ROUND_MULTIPLIERS }; // Reset when new run starts
    // campaignRunBuffs = []; // Reset when new run starts
}

// --- SHOP LOGIC (Placeholder) ---
// ... existing code ... 