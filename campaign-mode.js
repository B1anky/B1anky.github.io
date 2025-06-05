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

    // Add click listener to the deck for drawing cards
    const deckElement = document.getElementById('deck');
    if (deckElement) {
        deckElement.onclick = () => {
            // Check if deck is effectively enabled before drawing
            const canDraw = campaignPlayer.lastBet > 0 && 
                            campaignPlayer.currentChoice !== undefined && 
                            campaignPlayer.chips >= campaignPlayer.lastBet && 
                            campaignGamePhase === PHASE_BETTING && 
                            campaignRunActive && 
                            campaignGameInProgress;
            if (canDraw) {
                campaignDrawCard();
            } else {
                console.log("[CMP] Deck clicked, but conditions to draw not met.");
                // Optionally, provide feedback if deck is clicked when disabled, e.g., a shake animation or a brief message
                // For now, it just won't do anything if conditions aren't met by campaignDrawCard()
                // campaignDrawCard() itself has checks, but this prevents even calling it.
            }
        };
    } else {
        console.error("[CMP] Deck element not found for adding click listener.");
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
    // showGameNotification(`New Campaign Run! Quota: ${currentQuota}. Attempts: ${runAttemptsLeftForQuota}. Starting Capital: ${baseStartingCapital}`, 'info', 5000);
    
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
    // Set lastBet: Use previous ride's bet if affordable, else 1 (if chips > 0), else 0.
    campaignPlayer.lastBet = campaignPreviousRideBet > 0 && campaignPreviousRideBet <= campaignPlayer.chips ? campaignPreviousRideBet : (campaignPlayer.chips > 0 ? 1 : 0);
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
    campaignPlayer.lastBet = campaignPreviousRideBet > 0 && campaignPreviousRideBet <= campaignPlayer.chips ? campaignPreviousRideBet : (campaignPlayer.chips > 0 ? 1 : 0); 
    campaignPlayer.currentChoice = undefined;
    updateCampaignUI(); // This will call updateDeckClickableState()
}

// --- UI UPDATES (Campaign Specific) ---
function updateCampaignUI() {
    console.log("Updating Campaign UI...");
    const campaignStatusDisp = document.getElementById('campaignStatusDisplay');
    if (campaignStatusDisp) {
        campaignStatusDisp.style.display = 'none';
        if (!campaignRunActive) {
            // Potentially use for a run over message
        }
    }
    updateCampaignPlayerDisplay();
    updateCampaignRoundInfo();
    updateCampaignGameButtons();
    updateCampaignDeckDisplay();
    updateCampaignDrawnCardsDisplay();
    updateCampaignDebugDisplay(); 
    updateDeckClickableState(); // ADDED
}

function updateCampaignPlayerDisplay() {
    console.log("[CMP] updateCampaignPlayerDisplay: CALLED");

    const playerInfoPanel = document.getElementById('campaignPlayersPanel');
    if (!playerInfoPanel) {
        console.error("[CMP] updateCampaignPlayerDisplay: ERROR - campaignPlayersPanel element NOT FOUND!");
    } else {
        playerInfoPanel.innerHTML = ''; 
        playerInfoPanel.style.display = 'flex'; 
        playerInfoPanel.style.flexDirection = 'column';
        playerInfoPanel.className = 'panel players-panel campaign-mode-left-panel';

        if (campaignRunActive) {
            const balatroStatsWrapper = document.createElement('div');
            balatroStatsWrapper.className = 'balatro-stats-wrapper';

            const chipsBlock = document.createElement('div');
            chipsBlock.className = 'stat-block chips-block';
            chipsBlock.innerHTML = `
                <div class="stat-block-label">CHIPS</div>
                <div class="stat-block-value">${campaignPlayer.chips}</div>
            `;
            balatroStatsWrapper.appendChild(chipsBlock);

            const quotaBlock = document.createElement('div');
            quotaBlock.className = 'stat-block quota-block';
            quotaBlock.innerHTML = `
                <div class="stat-block-label">TARGET QUOTA</div>
                <div class="stat-block-value">${currentQuota}</div>
            `;
            // Create and append Complete Quota button here
            const completeQuotaButton = document.createElement('button');
            completeQuotaButton.id = 'completeQuotaButton';
            completeQuotaButton.className = 'button-in-stat-block'; // New class for styling
            completeQuotaButton.textContent = 'Complete Quota'; // Simplified text
            completeQuotaButton.onclick = () => playerCompletesQuota(); // Ensure onclick is set
            quotaBlock.appendChild(completeQuotaButton);
            balatroStatsWrapper.appendChild(quotaBlock);

            const attemptsBlock = document.createElement('div');
            attemptsBlock.className = 'stat-block attempts-block';
            attemptsBlock.innerHTML = `
                <div class="stat-block-label">ATTEMPTS LEFT</div>
                <div class="stat-block-value">${runAttemptsLeftForQuota} / ${ATTEMPTS_PER_QUOTA_LEVEL}</div>
            `;
            balatroStatsWrapper.appendChild(attemptsBlock);
            
            const runInfoBlock = document.createElement('div');
            runInfoBlock.className = 'stat-block run-info-block';
            runInfoBlock.innerHTML = `
                <div class="stat-block-label">RUN PROGRESS</div>
                <div class="run-info-item"><span class="run-info-label">Profit:</span> <span class="run-info-value profit-value">${currentRunProfit}</span></div>
                <div class="run-info-item"><span class="run-info-label">Quotas Cleared:</span> <span class="run-info-value">${gamesPlayedInRun}</span></div>
            `;
            balatroStatsWrapper.appendChild(runInfoBlock);

            playerInfoPanel.appendChild(balatroStatsWrapper);

        } else { // Run is not active, display summary
            const runOverSummary = document.createElement('div');
            runOverSummary.className = 'balatro-stats-wrapper run-over-summary'; // Reuse wrapper for consistency
            runOverSummary.innerHTML = `
                <div class="stat-block final-summary-block">
                    <div class="stat-block-label">CAMPAIGN OVER</div>
                    <div class="run-info-item"><span class="run-info-label">Final Profit:</span> <span class="run-info-value profit-value">${currentRunProfit}</span></div>
                    <div class="run-info-item"><span class="run-info-label">Quotas Cleared:</span> <span class="run-info-value">${gamesPlayedInRun}</span></div>
                    <div class="stat-block-message">Return to Main Menu to start a new run.</div>
                </div>
            `;
            playerInfoPanel.appendChild(runOverSummary);
        }
    }

    const interactiveControlsContainer = document.getElementById('campaignChoiceAndBettingArea');
    if (!interactiveControlsContainer) {
        console.error("[CMP] updateCampaignPlayerDisplay: ERROR - campaignChoiceAndBettingArea element NOT FOUND!");
        return;
    }
    interactiveControlsContainer.innerHTML = ''; // Clear for fresh render

    if (!campaignRunActive || !campaignGameInProgress) {
        console.log("[CMP] updateCampaignPlayerDisplay: Run not active or game not in progress. No interactive controls to show in campaignChoiceAndBettingArea.");
        return;
    }

    // The rest of the function will now build controls (bet input, choices, cash out)
    // and append them to 'interactiveControlsContainer' instead of 'playerArea' or 'playerDiv' that was part of 'playerArea'.

    const controlsDiv = document.createElement('div'); // This will hold bet, choices, etc.
    controlsDiv.className = 'player-interactive-controls'; // New class for styling this group

    const betRow = document.createElement('div');
    betRow.className = 'player-bet-row'; // Keep class for styling
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
            betInput.value = newBet; 
            correctedBetValue = true;
            if (String(newBet) !== newBetTyped && newBetTyped !== "") { 
                 showGameNotification("Bet cannot exceed current capital. Bet adjusted.", 'warning', 2000);
            }
        }

        if (String(newBet) !== newBetTyped) {
            if (newBetTyped !== "") { 
                betInput.value = newBet; 
                correctedBetValue = true;
            }
        }

        if (campaignPlayer.lastBet !== newBet) {
            campaignPlayer.lastBet = newBet;
            console.log(`[CMP] Bet input changed (oninput). New campaignPlayer.lastBet: ${campaignPlayer.lastBet}`);
            
            updateCampaignGameButtons(); 
            updateDeckClickableState(); // ADDED: Update deck state when bet changes

            const cashOutRowEl = document.getElementById('campaignCashOutRow'); // Use existing ID if created by this function
            const cashOutButtonEl = document.getElementById('campaignCashOutButton'); // Use existing ID

            if (cashOutRowEl && cashOutButtonEl) {
                const 조건_canCashOut = campaignGamePhase === PHASE_BETTING && 
                                   campaignCurrentRound > 1 && 
                                   campaignCurrentRound <= 5 && 
                                   campaignPlayer.lastBet > 0;

                if (조건_canCashOut) {
                    const cashOutMultiplier = campaignRunRoundMultipliers[campaignCurrentRound - 1] || BASE_ROUND_MULTIPLIERS[campaignCurrentRound - 1];
                    const potentialCashOutValue = campaignPlayer.lastBet * cashOutMultiplier;
                    cashOutButtonEl.textContent = `Cash Out [+${potentialCashOutValue} chips] [-1 Attempt]`;
                    cashOutRowEl.style.display = 'flex'; 
                } else {
                    cashOutRowEl.style.display = 'none';
                }
            }
        } 
    };

    if (campaignPlayer.chips <= 0 && campaignGamePhase !== PHASE_PLAYING) {
        campaignPlayer.lastBet = 0;
        betInput.value = 0;
    }

    betRow.appendChild(betInput);

    // Create a span for the " chips" suffix
    const chipsSuffix = document.createElement('span');
    chipsSuffix.className = 'bet-input-suffix';
    chipsSuffix.textContent = ' chips';
    betRow.appendChild(chipsSuffix);

    interactiveControlsContainer.appendChild(betRow); // Append betRow to the new container

    const choiceButtonsContainer = document.createElement('div');
    choiceButtonsContainer.className = 'choice-buttons'; // Keep class for styling
    let choices = [];

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
                choices = []; 
                break;
            default: choices = []; break;
        }

        choices.forEach(choiceText => {
            const button = document.createElement('button');
            button.className = 'choice-button'; // This class will be styled for larger buttons
            button.textContent = choiceText.charAt(0).toUpperCase() + choiceText.slice(1);
            button.onclick = () => makeCampaignChoice(choiceText);
            if (campaignPlayer.currentChoice && choiceText.toLowerCase() === campaignPlayer.currentChoice.toLowerCase()) {
                button.classList.add('selected');
            }
            choiceButtonsContainer.appendChild(button);
        });
    }

    const canShowCashOutInitially = campaignGamePhase === PHASE_BETTING && campaignCurrentRound > 1 && campaignCurrentRound <= 5 && campaignPlayer.lastBet > 0;
    
    const cashOutRow = document.createElement('div');
    cashOutRow.id = 'campaignCashOutRow'; 
    cashOutRow.style.marginTop = '5px';
    cashOutRow.style.display = canShowCashOutInitially ? 'flex' : 'none'; 
    cashOutRow.style.justifyContent = 'center';

    const cashOutButton = document.createElement('button');
    cashOutButton.id = 'campaignCashOutButton'; 
    cashOutButton.className = 'draw-button cash-out-mid-ride'; // Use existing classes, can be restyled
    cashOutButton.onclick = () => handleCashOutMidRide();
    
    if (canShowCashOutInitially) {
        const cashOutMultiplier = campaignRunRoundMultipliers[campaignCurrentRound - 1] || BASE_ROUND_MULTIPLIERS[campaignCurrentRound - 1];
        const potentialCashOutValue = campaignPlayer.lastBet * cashOutMultiplier;
        cashOutButton.textContent = `Cash Out [+${potentialCashOutValue} chips] [-1 Attempt]`;
    } else {
        cashOutButton.textContent = "Cash Out"; 
    }

    cashOutRow.appendChild(cashOutButton);
    // Append cashOutRow and choiceButtonsContainer to the new interactiveControlsContainer
    if (choiceButtonsContainer.hasChildNodes()) {
        interactiveControlsContainer.appendChild(choiceButtonsContainer);
    }
    interactiveControlsContainer.appendChild(cashOutRow); 

    console.log("[CMP] updateCampaignPlayerDisplay: Interactive controls updated in campaignChoiceAndBettingArea.");
}

function makeCampaignChoice(choice) {
    if (!campaignRunActive || !campaignGameInProgress || !campaignPlayer || campaignPlayer.lastBet <= 0) {
        console.warn(`[CMP] makeCampaignChoice: Conditions not met. Choice: ${choice}, Bet: ${campaignPlayer ? campaignPlayer.lastBet : 'N/A'}`);
        showGameNotification("Place a bet before making a choice.", "warning");
        return;
    }
    campaignPlayer.currentChoice = choice;
    console.log(`[CMP] makeCampaignChoice: Choice made: "${choice}".`);
    updateCampaignUI(); // This will call updateDeckClickableState()
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
        roundInfoEl.textContent = `Sequence ended. Waiting for next action.`;
        multiplierInfoEl.textContent = `Attempts for Quota ${currentQuota}: ${runAttemptsLeftForQuota}. Chips: ${campaignPlayer.chips}`;
        return;
    }

    let roundText = `Round ${campaignCurrentRound}: `;
    let multText = `(Current Bet: ${campaignPlayer.lastBet}) `;

    if (campaignGamePhase === PHASE_BETTING) {
        // Determine round-specific question text first
        switch (campaignCurrentRound) {
            case 1: roundText += 'Will the next card be a red or black suit?'; break;
            case 2: roundText += 'Higher or Lower than the previous card?'; break; // Example, adjust as per your game rules
            case 3: roundText += 'Inside or Outside the first two cards?'; break; // Example
            case 4: roundText += 'Guess the Suit of the next card.'; break;       // Example
            case 5: roundText += 'Guess the Value of the next card.'; break;      // Example
            default: roundText += `Place Bet & Choose for R${campaignCurrentRound}.`; break;
        }

        // Determine multText based on game state
        if (campaignPlayer.lastBet <= 0) {
            multText = "Waiting for player choice and bet.";
        } else if (!campaignPlayer.currentChoice) {
            multText = "Waiting for player choice.";
        } else { // Bet is > 0 and choice is made
            multText = 'Ready to Draw!';
        }
         // This specific condition for no capital might override the above if chips are truly 0
         if (campaignPlayer.chips <= 0 && campaignPlayer.lastBet <=0) { 
            multText = `No capital to bet! This attempt is over.`;
        }

    } else if (campaignGamePhase === PHASE_PLAYING) { 
        roundText += `Playing Round ${campaignCurrentRound}...`;
        multText = `Bet was ${campaignPlayer.lastBet}.`;
        // Update roundInfoEl directly here for playing phase to show the R1 question correctly during play
        switch (campaignCurrentRound) {
            case 1: roundInfoEl.textContent = `Round ${campaignCurrentRound}: Will the next card be a red or black suit?`; break;
            // Add other cases if their text during PHASE_PLAYING needs to be specific
            default: roundInfoEl.textContent = roundText; break;
        }
    }
    
    // Set roundInfoEl text, except if already set in PHASE_PLAYING block
    if (campaignGamePhase !== PHASE_PLAYING) {
        roundInfoEl.textContent = roundText;
    }
    multiplierInfoEl.textContent = multText;
}

function updateCampaignGameButtons() {
    console.log("updateCampaignGameButtons called");
    const newGameButton = document.getElementById('newGameButton'); 
    const drawCardButton = document.getElementById('drawCardButton');
    const completeQuotaButtonEl = document.getElementById('completeQuotaButton'); // Renamed for clarity

    // Hide newGameButton in campaign mode (already default behavior, but good to be explicit)
    if (newGameButton) newGameButton.style.display = 'none';

    if (!campaignRunActive) {
        if(drawCardButton) drawCardButton.style.display = 'none';
        if(completeQuotaButtonEl) completeQuotaButtonEl.style.display = 'none'; // Hide if run not active
        return;
    }

    if (campaignGameInProgress) {
        // Permanently hide the original drawCardButton in Campaign mode
        if(drawCardButton) drawCardButton.style.display = 'none'; 
        
        // Manage Complete Quota button (which is now in the left panel)
        if (completeQuotaButtonEl) {
            completeQuotaButtonEl.style.display = ''; // Show it if game is in progress
            // Text is now set in updateCampaignPlayerDisplay, no need to set here
            completeQuotaButtonEl.disabled = !(campaignPlayer.chips >= currentQuota); 
        } else {
            console.error("[CMP] completeQuotaButton element not found in updateCampaignGameButtons!");
        }

    } else { // Campaign game not in progress (e.g., between rides, or before first attempt)
        if(drawCardButton) drawCardButton.style.display = 'none'; 
        if(completeQuotaButtonEl) completeQuotaButtonEl.style.display = 'none'; 
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

// NEW FUNCTION to manage deck's clickable state and appearance
function updateDeckClickableState() {
    const deckElement = document.getElementById('deck');
    if (!deckElement) return;

    const canDraw = campaignPlayer.lastBet > 0 && 
                    campaignPlayer.currentChoice !== undefined && 
                    campaignPlayer.chips >= campaignPlayer.lastBet && 
                    campaignGamePhase === PHASE_BETTING && 
                    campaignRunActive && 
                    campaignGameInProgress;

    if (canDraw) {
        deckElement.classList.add('deck-active');
        deckElement.classList.remove('deck-inactive');
        deckElement.style.cursor = 'pointer';
    } else {
        deckElement.classList.add('deck-inactive');
        deckElement.classList.remove('deck-active');
        deckElement.style.cursor = 'not-allowed';
    }
}

// --- GAME LOGIC (Campaign Specific) ---
async function campaignDrawCard() {
    if (!campaignRunActive || !campaignGameInProgress) {
        // showGameNotification("No active campaign game to draw card for.", "warning"); // Potentially keep for debugging, or remove
        return;
    }
    if (campaignPlayer.lastBet <= 0 || !campaignPlayer.currentChoice) {
        // showGameNotification('Place a valid bet and make a choice before drawing.', 'warning'); // Potentially keep
        return;
    }
    if (campaignPlayer.chips < campaignPlayer.lastBet) {
        // showGameNotification(`Not enough chips (${campaignPlayer.chips}) for bet (${campaignPlayer.lastBet}). Lower your bet.`, 'warning'); // Potentially keep
        return;
    }

    if (campaignCurrentRound === 1 && campaignGamePhase === PHASE_BETTING) {
        if (campaignPlayer.lastBet > 0 && campaignPlayer.chips >= campaignPlayer.lastBet) {
            campaignBetLockedForRide = true;
            console.log(`[CMP] campaignDrawCard: Bet of ${campaignPlayer.lastBet} for R1 locked. campaignBetLockedForRide = true`);
        } else {
            showGameNotification('Cannot lock bet. Invalid bet amount or insufficient chips for R1.', 'error'); // Keep critical error
            return; 
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
    let rideEndingBet = campaignPlayer.lastBet;

    if (playerWinsThisRound) {
        // showGameNotification(`Won Round ${campaignCurrentRound}!`, 'success', 2000);
        if (campaignCurrentRound === 5) { 
            const multiplier = campaignRunRoundMultipliers[5] || BASE_ROUND_MULTIPLIERS[5];
            const winnings = campaignPlayer.lastBet * multiplier; 
            campaignPlayer.chips += winnings; 
            console.log(`[CMP] R5 WIN! Initial Bet: ${campaignPlayer.lastBet}, Multiplier: ${multiplier}, Total Added: ${winnings}. Final Chips: ${campaignPlayer.chips}`);
            // showGameNotification(`SUCCESS! Rode the Bus! Chips: ${campaignPlayer.chips}.`, 'success', 4000); // R5 win summary
            if (rideEndingBet > 0) campaignPreviousRideBet = rideEndingBet;
            runAttemptsLeftForQuota--;
            console.log(`[CMP] R5 Win sequence ended. Attempt consumed. Attempts left: ${runAttemptsLeftForQuota}`);
            if (runAttemptsLeftForQuota > 0) {
                // showGameNotification("Ride complete! Starting new Ride sequence...", "info", 1800);
                setTimeout(() => { startNewRideSequence(); }, 2000); 
            } else {
                if (campaignPlayer.chips >= currentQuota) {
                    showGameNotification(`R5 Win on last attempt and MET QUOTA! Chips: ${campaignPlayer.chips}.`, 'success', 6000); // Keep major event
                    processSuccessfulQuotaCompletion("R5 Win - Last Attempt");
                } else {
                    showGameNotification(`Run Over. R5 Win on last attempt but FAILED QUOTA of ${currentQuota}. Chips: ${campaignPlayer.chips}.`, 'error', 8000); // Keep major event
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
        // showGameNotification(`Lost Round ${campaignCurrentRound}. Bet of ${campaignPlayer.lastBet} lost. Chips: ${campaignPlayer.chips}`, 'warning', 3000); 
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
            // showGameNotification(`Incorrect guess. Attempt lost. Starting new Ride sequence in 2s... Chips: ${campaignPlayer.chips}`, 'warning', 2000); 
            setTimeout(() => { 
                startNewRideSequence(); 
            }, 2000); 
        } else {
            if (campaignPlayer.chips >= currentQuota) {
                //showGameNotification(`Lost round on last attempt but MET QUOTA! Chips: ${campaignPlayer.chips}.`, 'success', 6000); // Keep major event
                processSuccessfulQuotaCompletion("Lost Round - Last Attempt");
            } else {
                //showGameNotification(`Run Over. Lost round on last attempt and FAILED QUOTA of ${currentQuota}. Chips: ${campaignPlayer.chips}.`, 'error', 8000); // Keep major event
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
    showGameNotification(`BUSTED! Chips at or below 0. Campaign Run Over!`, 'error', 7000); // Keep - CRITICAL
    console.log("[CMP] handleBust: Player busted. Campaign Run IMMEDIATELY Over.");
    campaignGameInProgress = false; 
    campaignRunActive = false; // Run ends immediately on bust
    // No decrementing runAttemptsLeftForQuota here, run is just over.
    updateCampaignUI(); // This will call updateDeckClickableState()
}

// New shared function for when a quota is successfully met
function processSuccessfulQuotaCompletion(fromAction) {
    console.log(`[CMP] processSuccessfulQuotaCompletion called from: ${fromAction}. Player Chips: ${campaignPlayer.chips}, Quota: ${currentQuota}`);
    const profitFromThisQuota = campaignPlayer.chips - baseStartingCapital;
    currentRunProfit += Math.max(0, profitFromThisQuota); 
    gamesPlayedInRun++; 
    
    showGameNotification(`SUCCESS! Quota of ${currentQuota} met with ${campaignPlayer.chips} chips! Profit banked: ${Math.max(0, profitFromThisQuota)}.`, 'success', 7000); // Keep - Major Event
    
    currentQuota = Math.floor(currentQuota * quotaIncreaseFactor);
    runAttemptsLeftForQuota = ATTEMPTS_PER_QUOTA_LEVEL; 
    
    console.log(`[CMP] Quota met. New Quota: ${currentQuota}. Run Profit: ${currentRunProfit}. Attempts for new quota level reset to: ${runAttemptsLeftForQuota}.`);
    // showGameNotification(`Next Quota Level: ${currentQuota}. Attempts for new level: ${runAttemptsLeftForQuota}. Starting Capital: ${baseStartingCapital}.`, 'info', 8000); // Optional, can be removed
    
    startNewAttemptForCurrentQuota(); // This calls updateCampaignUI(), which calls updateDeckClickableState()
}

function handleCashOutMidRide() {
    if (!campaignRunActive || !campaignGameInProgress || campaignCurrentRound <= 1) {
        // console.warn("[CMP] handleCashOutMidRide: Conditions not met."); // Already logs
        // showGameNotification("Cannot cash out at this point.", "warning"); // Optional warning
        return;
    }

    const cashOutMultiplier = campaignRunRoundMultipliers[campaignCurrentRound - 1] || BASE_ROUND_MULTIPLIERS[campaignCurrentRound - 1];
    const winningsFromCashOut = campaignPlayer.lastBet * cashOutMultiplier;
    campaignPlayer.chips += winningsFromCashOut; 
    
    console.log(`[CMP] Cashed out mid-ride at R${campaignCurrentRound-1}. Bet was ${campaignPlayer.lastBet}, Won: ${winningsFromCashOut}. New Chips: ${campaignPlayer.chips}`);
    // showGameNotification(`Cashed out at R${campaignCurrentRound-1} for ${winningsFromCashOut}. Total chips: ${campaignPlayer.chips}.`, 'info', 4000);

    if (campaignPlayer.lastBet > 0) campaignPreviousRideBet = campaignPlayer.lastBet; 
    runAttemptsLeftForQuota--;
    campaignPlayer.lastBet = 0; 
    campaignGameInProgress = false; 
    if (runAttemptsLeftForQuota > 0) {
        // showGameNotification(`Cashed out. Starting new Ride the Bus sequence. Chips: ${campaignPlayer.chips}. Attempts left: ${runAttemptsLeftForQuota}.`, 'info', 5000);
        startNewRideSequence(); 
    } else {
        console.log("[CMP] Cashed out on last attempt.");
        if (campaignPlayer.chips >= currentQuota) {
            showGameNotification(`Cashed out on last attempt and MET QUOTA! Chips: ${campaignPlayer.chips}.`, 'success', 6000); // Keep major event
            processSuccessfulQuotaCompletion("Cash Out - Last Attempt");
        } else {
            showGameNotification(`Run Over. Cashed out on last attempt but FAILED QUOTA of ${currentQuota}. Chips: ${campaignPlayer.chips}.`, 'error', 8000); // Keep major event
            campaignRunActive = false;
            updateCampaignUI();
        }
    }
    updateDeckClickableState(); // ADDED: Ensure deck state is updated after a new attempt starts
}

function playerCompletesQuota() { 
    if (!campaignRunActive || !campaignGameInProgress) {
        // showGameNotification("No active game sequence to complete quota with.", "warning"); // Optional
        return;
    }
    if (campaignPlayer.chips < currentQuota) {
        showGameNotification(`Cannot complete quota. Need ${currentQuota}, have ${campaignPlayer.chips}.`, "error"); // Keep critical error
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