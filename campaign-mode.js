// Campaign Mode Specific Logic will go here

console.log("campaign-mode.js loaded");

const ATTEMPTS_PER_QUOTA_LEVEL = 5; // User-defined number of attempts per quota level

// NEW: Centralized state for data that persists across an entire campaign run.
let campaignState = {
    profit: 0, // Cumulative profit from successful quotas, used for shop
    upgrades: {
        startingChipsBonus: 0,
        multiplierBonuses: [0, 0, 0, 0, 0] // Bonus for rounds 1-5
    }
};

// Global variable to indicate which mode is active (or manage this via a more robust state manager later)
// This will be set by main.js when a mode is selected.
// let currentCampaignData = {}; // Example structure for campaign-specific state

// Campaign Run State Variables
let campaignRunActive = false;
// currentRunCapital is removed, chips are managed by campaignPlayer.chips per attempt
let currentQuota = 0;
// let currentRunProfit = 0; // REPLACED by campaignState
let gamesPlayedInRun = 0; // Number of quotas successfully cleared
let runAttemptsLeftForQuota = ATTEMPTS_PER_QUOTA_LEVEL;
let campaignGameInProgress = false;
let campaignBetLockedForRide = false; // NEW: To lock bet after R1 draw of a ride sequence
let campaignPreviousBetPercentage = 0.5; // NEW: Store the last bet as a percentage of capital. Default to 50%.
let isChipAnimationInProgress = false;
let isStartingNextRound = false;

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

// NEW: Helper function to apply multiplier upgrades.
function updateRunMultipliers() {
    console.log("[CMP] Updating run multipliers with purchased bonuses.");
    campaignRunRoundMultipliers = { ...BASE_ROUND_MULTIPLIERS };
    for (let i = 0; i < 5; i++) {
        // Ensure bonus exists before adding it
        if (campaignState.upgrades.multiplierBonuses[i]) {
            campaignRunRoundMultipliers[i + 1] += campaignState.upgrades.multiplierBonuses[i];
        }
    }
    console.log("[CMP] Final multipliers for run:", campaignRunRoundMultipliers);
}

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
            // This check must mirror the logic in updateDeckClickableState to be consistent.
            const betIsCovered = campaignBetLockedForRide || (campaignPlayer.chips >= campaignPlayer.lastBet);

            const canDraw = campaignPlayer.lastBet > 0 && 
                            campaignPlayer.currentChoice !== undefined && 
                            betIsCovered &&
                            campaignGamePhase === PHASE_BETTING && 
                            campaignRunActive && 
                            campaignGameInProgress;
            if (canDraw) {
                campaignDrawCard();
            } else {
                console.log("[CMP] Deck clicked, but conditions to draw not met.");
                // This else block is a fallback. In general, the updateDeckClickableState function
                // should visually prevent the user from clicking when they cannot draw.
            }
        };
    } else {
        console.error("[CMP] Deck element not found for adding click listener.");
    }
}

function startNewCampaignRun() {
    console.log("Starting a new Campaign Run...");

    // Hide the run end message from the previous run.
    const runEndContainer = document.getElementById('runOverSummaryPanel');
    if (runEndContainer) {
        runEndContainer.remove();
    }

    // Remove fade-out classes from any previous run and add fade-in to re-animate.
    const elementsToReset = [
        document.getElementById('deck'),
        document.getElementById('drawnCards'),
        document.getElementById('campaignChoiceAndBettingArea'),
        document.getElementById('roundInfo'),
        document.getElementById('roundMultiplier'),
        document.getElementById('roundMultiplierDisplay')
    ];
    elementsToReset.forEach(el => {
        if (el) {
            el.classList.remove('fade-out-on-run-end');
            el.classList.add('fade-in-on-run-start');
        }
    });

    campaignRunActive = true;
    // currentRunProfit = 0; // REPLACED by campaignState
    campaignState.profit = 0;
    campaignState.upgrades.startingChipsBonus = 0;
    campaignState.upgrades.multiplierBonuses = [0, 0, 0, 0, 0];

    gamesPlayedInRun = 0;
    runAttemptsLeftForQuota = ATTEMPTS_PER_QUOTA_LEVEL; // Use constant here
    
    updateRunMultipliers(); // Apply base and upgraded multipliers

    campaignRunBuffs = [];

    currentQuota = baseInitialQuota;
    
    // Set starting capital here, including any permanent upgrades.
    campaignPlayer.chips = baseStartingCapital + campaignState.upgrades.startingChipsBonus;

    console.log(`New Run: Initial Quota: ${currentQuota}, Attempts for Quota: ${runAttemptsLeftForQuota}`);
    // showGameNotification(`New Campaign Run! Quota: ${currentQuota}. Attempts: ${runAttemptsLeftForQuota}. Starting Capital: ${baseStartingCapital}`, 'info', 5000);
    
    campaignBetLockedForRide = false; // Reset on new run
    startNewAttemptForCurrentQuota();
}

// Called when starting a new "life"/run attempt for the current quota level (e.g. new run, or new QUOTA LEVEL)
// This RESETS chips to baseStartingCapital.
function startNewAttemptForCurrentQuota() {
    console.log(`[CMP] Starting New Full Attempt for Quota: ${currentQuota}. Previous Bet Percentage was: ${campaignPreviousBetPercentage}`);
    campaignPlayer.chips = baseStartingCapital + campaignState.upgrades.startingChipsBonus;
    animateChipsDisplay(campaignPlayer.chips, 'win'); // Animate chips resetting
    campaignBetLockedForRide = false; 
    campaignCurrentRound = 1;
    campaignDeck = createInitialDeck();
    campaignDrawnCards = [];
    campaignGamePhase = PHASE_BETTING;
    campaignGameInProgress = true; 
    // NEW LOGIC: Calculate bet based on percentage
    const newBet = Math.round(campaignPlayer.chips * campaignPreviousBetPercentage);
    // Ensure bet is at least 1 if player has chips, and not more than they have.
    campaignPlayer.lastBet = Math.min(campaignPlayer.chips, Math.max(campaignPlayer.chips > 0 ? 1 : 0, newBet));
    campaignPlayer.currentChoice = undefined;
    console.log(`[CMP] Full Attempt Started. Chips: ${campaignPlayer.chips}. Initial Bet from %: ${campaignPlayer.lastBet}.`);
    updateCampaignUI(true); // Force a re-render of the left panel for the new quota
}

// Called to start a new "Ride the Bus" sequence WITHIN the current quota level and current chip stack.
// This does NOT reset chips to baseStartingCapital. It continues the current "attempt for quota".
function startNewRideSequence() {
    if (!campaignRunActive) {
        console.warn("[CMP] startNewRideSequence called but run is not active. Aborting.");
        return;
    }
    console.log(`[CMP] Starting New Ride Sequence. Chips: ${campaignPlayer.chips}. Attempts left: ${runAttemptsLeftForQuota}. Prev Bet %: ${campaignPreviousBetPercentage}`);
    campaignBetLockedForRide = false; 
    campaignCurrentRound = 1;
    campaignDeck = createInitialDeck();
    campaignDrawnCards = [];
    campaignGamePhase = PHASE_BETTING;
    campaignGameInProgress = true; 
    // NEW LOGIC: Calculate bet based on percentage
    const newBet = Math.round(campaignPlayer.chips * campaignPreviousBetPercentage);
    // Ensure bet is at least 1 if player has chips, and not more than they have.
    campaignPlayer.lastBet = Math.min(campaignPlayer.chips, Math.max(campaignPlayer.chips > 0 ? 1 : 0, newBet)); 
    campaignPlayer.currentChoice = undefined;
    updateCampaignUI(); // This will call updateDeckClickableState()
    isChipAnimationInProgress = false;
}

// --- UI UPDATES (Campaign Specific) ---
function updateCampaignUI() {
    console.log("Updating Campaign UI...");

    if (!campaignRunActive) {
        displayRunOverSummary();
        return;
    }

    // --- Active Run UI Logic ---
    // Reset vertical alignment for active game state
    const gameBoardPanel = document.getElementById('gameBoardPanel');
    if (gameBoardPanel) gameBoardPanel.style.justifyContent = 'flex-start';

    // Ensure correct elements are visible
    document.getElementById('campaignPlayersPanel').style.display = 'flex';
    document.getElementById('roundInfo').style.display = 'block';
    document.getElementById('roundMultiplier').style.display = 'block';
    document.getElementById('deck').style.display = 'flex';
    document.getElementById('campaignCentralStage').style.display = 'flex';
    
    // Clear any lingering summary panel
    const existingSummary = document.getElementById('runOverSummaryPanel');
    if (existingSummary) existingSummary.remove();

    // Proceed with normal updates
    updateCampaignPlayerDisplay();
    updateCampaignRoundInfo();
    updateCampaignGameButtons();
    updateCampaignDeckDisplay();
    updateCampaignDrawnCardsDisplay();
    updateCampaignDebugDisplay(); 
    updateDeckClickableState();
    updateCashOutButtonState();
}

// NEW Generic function to animate any numerical value change
function animateValueDisplay(selector, finalValue, options = {}) {
    const element = document.querySelector(selector);
    if (!element) {
        // This can happen if the run ends and the panel is removed before animation completes.
        // console.warn(`[animateValueDisplay] Element with selector "${selector}" not found.`);
        return;
    }

    // If an animation is already running, cancel it. This ensures the newest value is animated to.
    if (element.animationRequestId) {
        cancelAnimationFrame(element.animationRequestId);
    }
    // Clean up any lingering visual classes from a previously cancelled animation
    if (element.dataset.animationClass) {
        element.classList.remove(element.dataset.animationClass);
    }

    const {
        duration = 800,
        animationClass,
        prefix = '',
        suffix = ''
    } = options;

    const startValueText = element.textContent.trim().replace(prefix, '').replace(suffix, '');
    const startValue = parseInt(startValueText, 10);
    
    // If not a number, or if there's no change, just set the text and finish.
    if (isNaN(startValue)) {
        element.textContent = `${prefix}${finalValue}${suffix}`;
        return;
    }
    
    const change = finalValue - startValue;
    if (change === 0) {
        // Even if value is the same, if there's a visual class, apply it for feedback.
        if (animationClass) {
            element.classList.add(animationClass);
            element.dataset.animationClass = animationClass;
             setTimeout(() => {
                element.classList.remove(animationClass);
                delete element.dataset.animationClass;
            }, 500);
        }
        return;
    }
    
    if (animationClass) {
        element.classList.add(animationClass);
        element.dataset.animationClass = animationClass; // Remember which class we added
    }
    
    let startTime = null;

    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        const progress = timestamp - startTime;
        const percentage = Math.min(progress / duration, 1);
        
        const currentValue = Math.floor(startValue + (change * percentage));
        element.textContent = `${prefix}${currentValue}${suffix}`;
        
        if (progress < duration) {
            element.animationRequestId = requestAnimationFrame(step);
        } else {
            element.textContent = `${prefix}${finalValue}${suffix}`;
            if (animationClass) {
                setTimeout(() => {
                    element.classList.remove(animationClass);
                    delete element.dataset.animationClass;
                }, 500); // Keep color for a moment
            }
            delete element.animationRequestId;
        }
    }

    element.animationRequestId = requestAnimationFrame(step);
}

function animateChipsDisplay(finalValue, type) {
    const selector = '#campaignChipsValue';
    const animationClass = type === 'win' ? 'chips-win' : 'chips-loss';
    
    animateValueDisplay(selector, finalValue, {
        duration: 800,
        animationClass: animationClass
    });
}

function displayRunOverSummary() {
    // Hide the left panel's content and all standard game elements in the center
    const leftPanel = document.getElementById('campaignPlayersPanel');
    if (leftPanel) {
        leftPanel.innerHTML = ''; // Clear the panel's content but keep it in the layout
    }
    
    document.getElementById('roundInfo').style.display = 'none';
    document.getElementById('roundMultiplier').style.display = 'none';
    document.getElementById('deck').style.display = 'none';
    document.getElementById('campaignCentralStage').style.display = 'none';
    const multiplierDisplay = document.getElementById('roundMultiplierDisplay');
    if (multiplierDisplay) multiplierDisplay.style.display = 'none';

    // Check if a summary already exists to prevent duplicates
    if (document.getElementById('runOverSummaryPanel')) return;

    const gameBoardPanel = document.getElementById('gameBoardPanel');
    if (gameBoardPanel) {
        gameBoardPanel.style.justifyContent = 'center';
        const runOverSummary = document.createElement('div');
        runOverSummary.id = 'runOverSummaryPanel';
        // Use the same classes as the left-panel summary for consistent styling
        runOverSummary.className = 'balatro-stats-wrapper run-over-summary'; 
        runOverSummary.style.animation = 'fade-in-slow 0.8s ease-in forwards';
        runOverSummary.innerHTML = `
            <div class="stat-block final-summary-block">
                <div class="stat-block-label">CAMPAIGN OVER</div>
                <div class="run-info-item"><span class="run-info-label">Final Profit:</span> <span class="run-info-value profit-value">${campaignState.profit}</span></div>
                <div class="run-info-item"><span class="run-info-label">Quotas Cleared:</span> <span class="run-info-value">${gamesPlayedInRun}</span></div>
                <div class="stat-block-message">Busted!</div>
            </div>
        `;

        const summaryBlock = runOverSummary.querySelector('.final-summary-block');
        if (summaryBlock) {
            const newGameButton = document.createElement('button');
            newGameButton.textContent = 'New Run';
            newGameButton.className = 'button-in-stat-block'; // Re-use existing style
            newGameButton.style.marginTop = '20px'; // Add some space
            newGameButton.onclick = () => startNewCampaignRun();
            summaryBlock.appendChild(newGameButton);
        }

        gameBoardPanel.appendChild(runOverSummary);
    }
}

function updateCampaignPlayerDisplay() {
    // This function now ONLY handles the left panel during an active run.
    // The run-over summary is handled by displayRunOverSummary.
    const playerInfoPanel = document.getElementById('campaignPlayersPanel');
    if (!playerInfoPanel || !campaignRunActive) {
        return; // Do nothing if panel doesn't exist or run is over
    }

    // Check if the panel has been built. If not, build it.
    let balatroStatsWrapper = playerInfoPanel.querySelector('.balatro-stats-wrapper');
    if (!balatroStatsWrapper) {
        playerInfoPanel.innerHTML = ''; 
        playerInfoPanel.style.display = 'flex'; 
        playerInfoPanel.style.flexDirection = 'column';
        playerInfoPanel.className = 'panel players-panel campaign-mode-left-panel';

        balatroStatsWrapper = document.createElement('div');
        balatroStatsWrapper.className = 'balatro-stats-wrapper';

        const chipsBlock = document.createElement('div');
        chipsBlock.className = 'stat-block chips-block';
        chipsBlock.innerHTML = `
            <div class="stat-block-label">CHIPS</div>
            <div class="stat-block-value" id="campaignChipsValue">${campaignPlayer.chips}</div>
        `;
        balatroStatsWrapper.appendChild(chipsBlock);

        const quotaBlock = document.createElement('div');
        quotaBlock.className = 'stat-block quota-block';
        quotaBlock.innerHTML = `
            <div class="stat-block-label">TARGET QUOTA</div>
            <div class="stat-block-value" id="campaignQuotaValue">${currentQuota}</div>
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
            <div class="stat-block-value" id="campaignAttemptsValue">${runAttemptsLeftForQuota} / ${ATTEMPTS_PER_QUOTA_LEVEL}</div>
        `;
        // Create and append Cash Out button here
        const cashOutButton = document.createElement('button');
        cashOutButton.id = 'leftPanelCashOutButton';
        cashOutButton.className = 'button-in-stat-block';
        cashOutButton.textContent = 'Cash Out';
        cashOutButton.style.display = 'none'; // Initially hidden
        cashOutButton.style.marginTop = '10px'; // Give it some space
        cashOutButton.onclick = () => handleCashOutMidRide();
        attemptsBlock.appendChild(cashOutButton);
        balatroStatsWrapper.appendChild(attemptsBlock);
        
        const runInfoBlock = document.createElement('div');
        runInfoBlock.className = 'stat-block run-info-block';
        runInfoBlock.innerHTML = `
            <div class="stat-block-label">RUN PROGRESS</div>
            <div class="run-info-item"><span class="run-info-label">Profit:</span> <span class="run-info-value profit-value" id="campaignProfitValue">${campaignState.profit}</span></div>
            <div class="run-info-item"><span class="run-info-label">Quotas Cleared:</span> <span class="run-info-value" id="campaignQuotasClearedValue">${gamesPlayedInRun}</span></div>
        `;
        balatroStatsWrapper.appendChild(runInfoBlock);

        playerInfoPanel.appendChild(balatroStatsWrapper);
    }
    
    // --- Update state of controls that aren't animated values ---
    const completeQuotaButton = document.getElementById('completeQuotaButton');
    if (completeQuotaButton) {
        completeQuotaButton.disabled = !(campaignPlayer.chips >= currentQuota); 
    }

    // The rest of this function handles the INTERACTIVE CONTROLS in the CENTER panel
    // This part should still be cleared and re-rendered on each update, as its state is highly dynamic.
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

    // If a bet is locked, the controls are disabled for betting. 
    // If not, they are disabled if the player has no chips.
    const isBettingDisabled = campaignBetLockedForRide || (campaignPlayer.chips <= 0 && !campaignBetLockedForRide);
    const currentBetValue = campaignPlayer.lastBet;

    // The max value for the input/slider should be the player's chips when betting,
    // but clamped to the locked-in bet amount when a ride is in progress.
    const maxBetValue = campaignBetLockedForRide ? currentBetValue : campaignPlayer.chips;

    // --- Bet Input Row ---
    const betRow = document.createElement('div');
    betRow.className = 'player-bet-row';
    const betInput = document.createElement('input');
    betInput.type = 'number';
    betInput.id = `betInput_campaign`;
    betInput.value = currentBetValue > 0 ? currentBetValue : (maxBetValue > 0 ? 1 : 0);
    betInput.min = 0;
    betInput.max = maxBetValue > 0 ? maxBetValue : 0;
    betInput.readOnly = isBettingDisabled;

    const chipsSuffix = document.createElement('span');
    chipsSuffix.className = 'bet-input-suffix';
    chipsSuffix.textContent = ' chips';
    
    betRow.appendChild(betInput);
    betRow.appendChild(chipsSuffix);
    interactiveControlsContainer.appendChild(betRow);

    // --- Slider Row ---
    const sliderRow = document.createElement('div');
    sliderRow.className = 'player-slider-row';
    const sliderWrapper = document.createElement('div');
    sliderWrapper.className = 'player-slider-wrapper';
    const betSlider = document.createElement('input');
    betSlider.type = 'range';
    betSlider.id = 'betSlider_campaign';
    betSlider.min = maxBetValue > 0 ? 1 : 0;
    betSlider.max = maxBetValue > 0 ? maxBetValue : 0;
    betSlider.step = 1; 
    betSlider.value = betInput.value;
    betSlider.disabled = isBettingDisabled;
    
    sliderWrapper.appendChild(betSlider);
    sliderRow.appendChild(sliderWrapper);
    interactiveControlsContainer.appendChild(sliderRow);
    
    // --- Notches & Labels (Calculated with a delay for accurate measurement) ---
    setTimeout(() => {
        const sliderNotchesContainer = document.createElement('div');
        sliderNotchesContainer.className = 'slider-notches-container';

        if (campaignPlayer.chips > 20 && !isBettingDisabled) {
            // The parent wrapper is now padded, so we calculate position as a percentage of its width.
            const snapPercentages = [0.25, 0.50, 0.75];
            snapPercentages.forEach(pct => {
                const notchValue = Math.round(campaignPlayer.chips * pct);
                // The parent element is padded by the thumb radius on both sides.
                // So, we can now calculate the position as a simple percentage of the width.
                const positionPercent = pct * 100;
                
                const notch = document.createElement('div');
                notch.className = 'slider-notch';
                notch.style.left = `${positionPercent}%`;
                
                const label = document.createElement('span');
                label.className = 'slider-notch-label';
                label.style.left = `${positionPercent}%`;
                label.textContent = notchValue;
                
                sliderNotchesContainer.appendChild(notch);
                sliderNotchesContainer.appendChild(label);
            });
        }
        
        sliderWrapper.prepend(sliderNotchesContainer);

        const showLabels = () => sliderNotchesContainer.classList.add('visible');
        const hideLabels = () => sliderNotchesContainer.classList.remove('visible');
        betSlider.addEventListener('mousedown', showLabels);
        betSlider.addEventListener('mouseup', hideLabels);
        betSlider.addEventListener('touchstart', showLabels, { passive: true });
        betSlider.addEventListener('touchend', hideLabels);
        betSlider.addEventListener('blur', hideLabels);
    }, 0); // setTimeout with 0ms delay defers execution until after browser repaint.

    // --- Event Handlers ---
    betInput.oninput = () => {
        let newBetTyped = betInput.value;
        let newBet = parseInt(newBetTyped) || 0;

        if (newBet < 0) newBet = 0;

        let correctedBetValue = false;
        // This clamping check should ONLY apply when the bet is NOT locked for a ride.
        if (!campaignBetLockedForRide && newBet > campaignPlayer.chips) {
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

        // SYNC SLIDER
        if (betSlider) {
            betSlider.value = newBet;
        }

        if (campaignPlayer.lastBet !== newBet) {
            campaignPlayer.lastBet = newBet;
            
            // NEW: Update the percentage
            if (campaignPlayer.chips > 0) {
                campaignPreviousBetPercentage = newBet / campaignPlayer.chips;
            } else {
                campaignPreviousBetPercentage = 0;
            }

            console.log(`[CMP] Bet input changed (oninput). New campaignPlayer.lastBet: ${campaignPlayer.lastBet}. New Percentage: ${campaignPreviousBetPercentage}`);
            
            updateCampaignGameButtons(); 
            updateDeckClickableState(); // ADDED: Update deck state when bet changes
            updateCashOutButtonState();
        } 
    };

    betSlider.oninput = () => {
        let sliderValue = parseInt(betSlider.value, 10);
        // Use maxBetValue for consistency, which correctly reflects the locked bet or player chips.
        const maxSliderValue = maxBetValue;

        // --- Snapping Logic ---
        // Only apply snapping if the slider range is large enough for it to be useful
        if (maxSliderValue > 20) {
            const snapPoints = [
                Math.round(maxSliderValue * 0.25),
                Math.round(maxSliderValue * 0.50),
                Math.round(maxSliderValue * 0.75)
            ];
            // The "magnetism" of the snap points. 5% of the total range.
            const snapThreshold = Math.round(maxSliderValue * 0.05); 

            for (const point of snapPoints) {
                if (Math.abs(sliderValue - point) <= snapThreshold) {
                    // If we are close to a snap point, use that value instead
                    sliderValue = point;
                    // Visually move the slider to the snap point. This creates the "magnetic" feel.
                    betSlider.value = sliderValue;
                    break;
                }
            }
        }
        // --- End Snapping Logic ---

        // Sync input field and trigger its oninput to run all the update logic
        if (parseInt(betInput.value, 10) !== sliderValue) {
            betInput.value = sliderValue;
            betInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
    };

    if (campaignPlayer.chips <= 0 && campaignGamePhase !== PHASE_PLAYING && !campaignBetLockedForRide) {
        campaignPlayer.lastBet = 0;
        betInput.value = 0;
        if (betSlider) betSlider.value = 0;
    }
    
    const choiceButtonsContainer = document.createElement('div');
    choiceButtonsContainer.className = 'choice-buttons'; // Keep class for styling
    let choices = [];

    // To allow continuing a ride with 0 chips, we change the condition.
    // A choice can be made if a ride is already in progress (bet is locked),
    // OR if it's the start of a ride (R1) and the player has chips and has placed a bet.
    const rideInProgress = campaignBetLockedForRide;
    const canPlaceNewBet = campaignPlayer.chips > 0 && campaignPlayer.lastBet > 0;
    const canMakeChoice = campaignGamePhase === PHASE_BETTING && (rideInProgress || canPlaceNewBet);

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

    // Append choiceButtonsContainer to the new interactiveControlsContainer
    if (choiceButtonsContainer.hasChildNodes()) {
        interactiveControlsContainer.appendChild(choiceButtonsContainer);
    }

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
    const multiplierDisplayEl = document.getElementById('roundMultiplierDisplay');
    if (!roundInfoEl || !multiplierInfoEl || !multiplierDisplayEl) return;

    if (!campaignRunActive) {
        roundInfoEl.textContent = `Run Over! Final Profit: ${campaignState.profit}. Games Cleared: ${gamesPlayedInRun}.`;
        multiplierInfoEl.textContent = 'Start a new campaign from the main menu.';
        multiplierDisplayEl.style.display = 'none';
        return;
    }
    if (!campaignGameInProgress && campaignRunActive) {
        roundInfoEl.textContent = `Sequence ended. Waiting for next action.`;
        multiplierInfoEl.textContent = `Attempts for Quota ${currentQuota}: ${runAttemptsLeftForQuota}. Chips: ${campaignPlayer.chips}`;
        multiplierDisplayEl.style.display = 'none';
        return;
    }

    // If we are in an active game, show the multiplier display
    multiplierDisplayEl.style.display = 'block';

    let roundText = `Round ${campaignCurrentRound}: `;
    let multText = `(Current Bet: ${campaignPlayer.lastBet}) `;

    // Update the visual multiplier
    const currentMultiplier = campaignRunRoundMultipliers[campaignCurrentRound];
    const baseMultiplier = BASE_ROUND_MULTIPLIERS[campaignCurrentRound];
    multiplierDisplayEl.textContent = `x${currentMultiplier.toFixed(1)}`;
    if (currentMultiplier > baseMultiplier) {
        multiplierDisplayEl.classList.add('upgraded');
    } else {
        multiplierDisplayEl.classList.remove('upgraded');
    }

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

    // A player can draw if their bet is already locked for the ride, OR if they can cover the bet for a new ride.
    const betIsCovered = campaignBetLockedForRide || (campaignPlayer.chips >= campaignPlayer.lastBet);

    const canDraw = campaignPlayer.lastBet > 0 && 
                    campaignPlayer.currentChoice !== undefined && 
                    betIsCovered && 
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

function updateCashOutButtonState() {
    const cashOutButton = document.getElementById('leftPanelCashOutButton');
    if (!cashOutButton) return;

    const canCashOut = campaignRunActive &&
                         campaignGameInProgress &&
                         campaignGamePhase === PHASE_BETTING &&
                         campaignCurrentRound > 1 &&
                         campaignCurrentRound <= 5 &&
                         campaignPlayer.lastBet > 0;
    
    if (canCashOut) {
        const cashOutMultiplier = campaignRunRoundMultipliers[campaignCurrentRound - 1] || BASE_ROUND_MULTIPLIERS[campaignCurrentRound - 1];
        const potentialCashOutValue = Math.ceil(campaignPlayer.lastBet * cashOutMultiplier);
        cashOutButton.textContent = `Cash Out (+${potentialCashOutValue} chips)`;
        cashOutButton.style.display = 'block';
        cashOutButton.disabled = false;
    } else {
        cashOutButton.style.display = 'none';
        cashOutButton.disabled = true;
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

    // A player can't draw if a bet isn't locked AND they don't have enough chips.
    // If a bet is locked, this check is bypassed.
    if (!campaignBetLockedForRide && campaignPlayer.chips < campaignPlayer.lastBet) {
        showGameNotification(`Not enough chips (${campaignPlayer.chips}) for bet (${campaignPlayer.lastBet}). Lower your bet.`, 'warning'); // Potentially keep
        return;
    }

    // If this is the first draw of a ride sequence, deduct the bet from chips.
    // This is the single bet for the entire ride.
    if (campaignCurrentRound === 1) {
        if (campaignPlayer.lastBet > 0 && campaignPlayer.chips >= campaignPlayer.lastBet) {
            campaignBetLockedForRide = true;
            campaignPlayer.chips -= campaignPlayer.lastBet;
            animateChipsDisplay(campaignPlayer.chips, 'loss');
            console.log(`[CMP] campaignDrawCard: Bet of ${campaignPlayer.lastBet} for ride sequence placed and locked. New chips: ${campaignPlayer.chips}`);
        } else {
             // This case should ideally be caught by the button disabling logic, but as a fallback:
            showGameNotification('Cannot start ride. Invalid bet amount or insufficient chips.', 'error');
            return;
        }
    } else {
         // For subsequent rounds in the same ride, the bet is already placed.
         console.log(`[CMP] campaignDrawCard: Drawing for R${campaignCurrentRound}. Bet was already placed.`);
    }

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

    // --- Animation Trigger ---
    const gameBoard = document.getElementById('gameBoardPanel');
    if (gameBoard) {
        const winClass = 'round-win-animation';
        const loseClass = 'round-lose-animation';
        
        // Remove any existing animation classes first to allow re-triggering
        gameBoard.classList.remove(winClass, loseClass);

        // We need a slight delay to allow the browser to remove the class before re-adding it.
        // requestAnimationFrame is a good way to wait for the next repaint.
        requestAnimationFrame(() => {
            const animationClass = playerWinsThisRound ? winClass : loseClass;
            gameBoard.classList.add(animationClass);
            
            // Clean up the class after the animation finishes to be neat
            gameBoard.addEventListener('animationend', () => {
                gameBoard.classList.remove(animationClass);
            }, { once: true });
        });
    }
    // --- End Animation Trigger ---

    campaignGameInProgress = false; 
    let rideEndingBet = campaignPlayer.lastBet;

    if (playerWinsThisRound) {
        // showGameNotification(`Won Round ${campaignCurrentRound}!`, 'success', 2000);
        if (campaignCurrentRound === 5) { 
            const multiplier = campaignRunRoundMultipliers[5] || BASE_ROUND_MULTIPLIERS[5];
            const winnings = Math.ceil(campaignPlayer.lastBet * multiplier); 
            campaignPlayer.chips += winnings; 
            animateChipsDisplay(campaignPlayer.chips, 'win');
            console.log(`[CMP] R5 WIN! Initial Bet: ${campaignPlayer.lastBet}, Multiplier: ${multiplier}, Total Added: ${winnings}. Final Chips: ${campaignPlayer.chips}`);
            // showGameNotification(`SUCCESS! Rode the Bus! Chips: ${campaignPlayer.chips}.`, 'success', 4000); // R5 win summary
            runAttemptsLeftForQuota--;
            animateValueDisplay('#campaignAttemptsValue', runAttemptsLeftForQuota, { animationClass: 'chips-loss', suffix: ` / ${ATTEMPTS_PER_QUOTA_LEVEL}` });
            console.log(`[CMP] R5 Win sequence ended. Attempt consumed. Attempts left: ${runAttemptsLeftForQuota}`);
            if (runAttemptsLeftForQuota > 0) {
                // showGameNotification("Ride complete! Starting new Ride sequence...", "info", 1800);
                setTimeout(() => { startNewRideSequence(); }, 2000); 
            } else {
                if (campaignPlayer.chips >= currentQuota) {
                    showGameNotification(`R5 Win on last attempt and MET QUOTA! Chips: ${campaignPlayer.chips}.`, 'success', 6000); // Keep major event
                    processSuccessfulQuotaCompletion("R5 Win - Last Attempt");
                } else {
                    const message = `Run Over. R5 Win on last attempt but FAILED QUOTA of ${currentQuota}. Chips: ${campaignPlayer.chips}.`;
                    triggerRunEndSequence(message, 'error');
                }
            }
        } else { 
            // Win on rounds 1-4: Advance to the next round. The bet remains on the table.
            console.log(`[CMP] Won R${campaignCurrentRound}. Advancing. Bet of ${campaignPlayer.lastBet} remains on the table.`);

            campaignCurrentRound++;
            campaignGamePhase = PHASE_BETTING; 
            campaignGameInProgress = true; 
            console.log(`[CMP] Advanced to R${campaignCurrentRound}. Chips: ${campaignPlayer.chips}.`);
            updateCampaignUI(); 
        }
    } else { // Player Lost Round (Incorrect Guess)
        console.log(`[CMP] Lost R${campaignCurrentRound}. Bet: ${campaignPlayer.lastBet}. Chips remain: ${campaignPlayer.chips}.`);

        // A player busts if they run out of chips. This ends the run immediately.
        if (campaignPlayer.chips <= 0) {
            console.log("[CMP] Player busted after round loss (0 chips).");
            handleBust();
            return;
        }

        // If they have chips, but lost the ride, it consumes an attempt.
        runAttemptsLeftForQuota--;
        animateValueDisplay('#campaignAttemptsValue', runAttemptsLeftForQuota, { animationClass: 'chips-loss', suffix: ` / ${ATTEMPTS_PER_QUOTA_LEVEL}` });
        console.log(`[CMP] Incorrect guess. Attempt consumed. Attempts left: ${runAttemptsLeftForQuota}`);
        
        if (runAttemptsLeftForQuota > 0) {
            //showGameNotification(`Incorrect guess. Attempt lost. Starting new ride...`, 'warning', 2000); 
            setTimeout(() => { 
                // Start a new RIDE, not a whole new ATTEMPT. This carries over remaining chips.
                startNewRideSequence(); 
            }, 2000); 
        } else {
            // Last attempt has been used. Check if they met the quota with remaining chips.
            if (campaignPlayer.chips >= currentQuota) {
                //showGameNotification(`Lost round on last attempt but MET QUOTA! Chips: ${campaignPlayer.chips}.`, 'success', 6000);
                processSuccessfulQuotaCompletion("Lost Round - Last Attempt");
            } else {
                const message = `Run Over. No attempts left and FAILED QUOTA of ${currentQuota}. Chips: ${campaignPlayer.chips}.`;
                triggerRunEndSequence(message, 'error');
            }
        }
    }
    if (campaignGameInProgress) { 
        campaignPlayer.currentChoice = undefined;
        updateCampaignUI();
    }
}

function handleBust() {
    if (!campaignRunActive) return; 
    console.log("[CMP] handleBust: Player busted. Campaign Run ending gracefully.");
    const message = `BUSTED! Chips at or below 0. Campaign Run Over!`;
    triggerRunEndSequence(message, 'error');
    runAttemptsLeftForQuota--;
    animateValueDisplay('#campaignAttemptsValue', runAttemptsLeftForQuota, { animationClass: 'chips-loss', suffix: ` / ${ATTEMPTS_PER_QUOTA_LEVEL}` });
    console.log(`[CMP] Player busted. Attempts left for this quota: ${runAttemptsLeftForQuota}`);

    if (runAttemptsLeftForQuota <= 0) {
        console.log("[CMP] No attempts left. Run over.");
        // ... existing code ...
    }
}

// New shared function for when a quota is successfully met
function processSuccessfulQuotaCompletion(fromAction = "ride") {
    campaignGameInProgress = false; // The "ride" is over
    
    const profitMade = campaignPlayer.chips - currentQuota;
    campaignState.profit += profitMade; // Add to cumulative run profit
    animateValueDisplay('#campaignProfitValue', campaignState.profit, { animationClass: 'chips-win' });
    
    console.log(`[CMP] QUOTA MET! Quota: ${currentQuota}, Chips: ${campaignPlayer.chips}, Profit: ${profitMade}`);

    if (fromAction === 'cashout') {
        // If they cashed out exactly at quota, just proceed.
        // If they cashed out over quota, they get profit.
    } else {
        animateValueDisplay('#campaignQuotasClearedValue', gamesPlayedInRun, { animationClass: 'chips-win' });
        
        // Instead of starting the next round, show the shop.
        // The shop will then call startNextCampaignRound()
        showShop();
    }
}

// This function is called after the player closes the shop modal.
function startNextCampaignRound() {
    if (isStartingNextRound) {
        console.warn("[CMP] startNextCampaignRound called again while already in progress. Ignoring.");
        return;
    }
    isStartingNextRound = true;

    console.log("[CMP] Proceeding to next quota.");

    // Update the profit display to reflect any spending in the shop.
    animateValueDisplay('#campaignProfitValue', campaignState.profit, {});

    // Recalculate multipliers to include any newly purchased upgrades.
    updateRunMultipliers();

    // Increase the quota for the next level.
    currentQuota = Math.floor(currentQuota * quotaIncreaseFactor);
    animateValueDisplay('#campaignQuotaValue', currentQuota, { animationClass: 'chips-win' });
    gamesPlayedInRun++; // Increment the number of successful quotas cleared.
    animateValueDisplay('#campaignQuotasClearedValue', gamesPlayedInRun, { animationClass: 'chips-win' });

    // Reset attempts for the new, harder quota.
    runAttemptsLeftForQuota = ATTEMPTS_PER_QUOTA_LEVEL;
    animateValueDisplay('#campaignAttemptsValue', runAttemptsLeftForQuota, { animationClass: 'chips-win', suffix: ` / ${ATTEMPTS_PER_QUOTA_LEVEL}` });

    // The player starts the new quota attempt with their base capital + permanent upgrades.
    // Unspent profit in the shop is retained separately for the next shop instance.
    startNewAttemptForCurrentQuota();

    showGameNotification(`Quota Cleared! Next Quota: ${currentQuota}. Attempts: ${runAttemptsLeftForQuota}`, 'success', 4000);

    // Reset the flag after a short delay to allow UI to settle.
    setTimeout(() => {
        isStartingNextRound = false;
    }, 500);
}

function handleCashOutMidRide() {
    if (!campaignRunActive || !campaignGameInProgress || campaignCurrentRound <= 1) {
        // console.warn("[CMP] handleCashOutMidRide: Conditions not met."); // Already logs
        // showGameNotification("Cannot cash out at this point.", "warning"); // Optional warning
        return;
    }

    const cashOutMultiplier = campaignRunRoundMultipliers[campaignCurrentRound - 1] || BASE_ROUND_MULTIPLIERS[campaignCurrentRound - 1];
    const winningsFromCashOut = Math.ceil(campaignPlayer.lastBet * cashOutMultiplier);
    campaignPlayer.chips += winningsFromCashOut; 
    animateChipsDisplay(campaignPlayer.chips, 'win');
    
    console.log(`[CMP] Cashed out mid-ride at R${campaignCurrentRound-1}. Bet was ${campaignPlayer.lastBet}, Won: ${winningsFromCashOut}. New Chips: ${campaignPlayer.chips}`);
    // showGameNotification(`Cashed out at R${campaignCurrentRound-1} for ${winningsFromCashOut}. Total chips: ${campaignPlayer.chips}.`, 'info', 4000);

    runAttemptsLeftForQuota--;
    animateValueDisplay('#campaignAttemptsValue', runAttemptsLeftForQuota, { animationClass: 'chips-loss', suffix: ` / ${ATTEMPTS_PER_QUOTA_LEVEL}` });
    campaignPlayer.lastBet = 0; 
    campaignGameInProgress = false; 
    if (runAttemptsLeftForQuota > 0) {
        // showGameNotification(`Cashed out. Starting new Ride the Bus sequence. Chips: ${campaignPlayer.chips}. Attempts left: ${runAttemptsLeftForQuota}.`, 'info', 5000);
        startNewRideSequence(); 
    } else {
        console.log("[CMP] Cashed out on last attempt.");
        if (campaignPlayer.chips >= currentQuota) {
            //showGameNotification(`Cashed out on last attempt and MET QUOTA! Chips: ${campaignPlayer.chips}.`, 'success', 6000); // Keep major event
            processSuccessfulQuotaCompletion("Cash Out - Last Attempt");
        } else {
            const message = `Run Over. Cashed out on last attempt but FAILED QUOTA of ${currentQuota}. Chips: ${campaignPlayer.chips}.`;
            triggerRunEndSequence(message, 'error');
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
    
    // An attempt is NOT consumed for choosing to complete the quota. This action ends the current quota level successfully.
    // The attempts are for the "Ride the Bus" sequences used to earn the chips.
    // runAttemptsLeftForQuota--; 
    
    campaignGameInProgress = false; 
    campaignGamePhase = PHASE_GAME_OVER; 

    // Since button is only enabled if chips >= quota, this condition is effectively met.
    // The player's last bet from the previous sequence should NOT carry over to a new quota level.
    processSuccessfulQuotaCompletion("playerCompletesQuota");
}

function prepareCampaignModeForExit() {
    console.log("Preparing Campaign Mode for exit. Resetting run state.");
    campaignRunActive = false;
    campaignState.profit = 0;
    campaignState.upgrades.startingChipsBonus = 0;
    campaignState.upgrades.multiplierBonuses = [0, 0, 0, 0, 0];
    gamesPlayedInRun = 0;
    runAttemptsLeftForQuota = ATTEMPTS_PER_QUOTA_LEVEL;
    currentQuota = baseInitialQuota;

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
    campaignBetLockedForRide = false;
    campaignPreviousBetPercentage = 0.5;
    
    // campaignRunRoundMultipliers = { ...BASE_ROUND_MULTIPLIERS }; // Reset when new run starts
    // campaignRunBuffs = []; // Reset when new run starts
}

function triggerRunEndSequence(message, messageType) {
    // 1. Animate out the game elements.
    const elementsToFade = [
        document.getElementById('deck'),
        document.getElementById('drawnCards'),
        document.getElementById('campaignChoiceAndBettingArea'),
        document.getElementById('roundInfo'),
        document.getElementById('roundMultiplier')
    ];
    elementsToFade.forEach(el => {
        if (el) el.classList.add('fade-out-on-run-end');
    });

    // 2. Wait for animations to play out a bit.
    setTimeout(() => {
        // 3. Update state and UI to show summary.
        campaignGameInProgress = false;
        campaignRunActive = false;
        updateCampaignUI(); // This will call displayRunOverSummary()
    }, 1000);
}

// --- SHOP LOGIC (Placeholder) ---
// ... existing code ... 