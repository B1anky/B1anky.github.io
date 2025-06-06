let activeGameMode = null; // Can be 'classic' or 'campaign'

document.addEventListener('DOMContentLoaded', function() {
    const mainMenuContainer = document.getElementById('mainMenuContainer');
    const gameViewContainer = document.getElementById('gameViewContainer');
    //const playClassicButton = document.getElementById('playClassicButton');
    const playCampaignButton = document.getElementById('playCampaignButton');
    const backToMenuButton = document.getElementById('backToMenuButton');
    const resetPlayersButton = document.getElementById('resetPlayersButton');
    
    const drawCardButton = document.getElementById('drawCardButton');
    const addPlayerCard = document.getElementById('addPlayerCard');
    //const campaignStatusDisplay = document.getElementById('campaignStatusDisplay');
    const classicPlayersPanel = document.getElementById('classicPlayersPanel');
    const campaignPlayersPanel = document.getElementById('campaignPlayersPanel');
    const drawnCardsContainer = document.getElementById('drawnCards'); // To clear
    const newGameButton = document.getElementById('newGameButton');
    const completeQuotaButton = document.getElementById('completeQuotaButton');

    // Load saved theme on initial page load for the main menu
    if (typeof loadTheme === 'function') {
        loadTheme();
    } else {
        console.warn("loadTheme function not found. Theme will not be loaded on main menu.");
    }

    function setupClassicMode() {
        activeGameMode = 'classic';
        console.log("Switched to Classic Mode");
        document.body.classList.remove('campaign-mode-active'); // Ensure campaign class is removed

        if (addPlayerCard) addPlayerCard.style.display = 'flex';
        //if (campaignStatusDisplay) campaignStatusDisplay.style.display = 'none';
        
        if (classicPlayersPanel) classicPlayersPanel.style.display = 'flex'; // Or 'block' if it suits CSS
        if (campaignPlayersPanel) campaignPlayersPanel.style.display = 'none';
        if (classicPlayersPanel) classicPlayersPanel.innerHTML = ''; 

        if (drawnCardsContainer) drawnCardsContainer.innerHTML = '';

        // Call startNewGame() from classic-mode.js to reset and initialize.
        // This replaces the previous individual loadGameState and UI update calls.
        if (typeof startNewGame === 'function') {
            startNewGame(); 
        } else {
            console.error("CRITICAL: startNewGame function not found in classic-mode.js. Classic mode will not initialize correctly.");
            // Attempting a minimal, potentially incomplete, setup as a last resort:
            if (typeof loadGameState === 'function') loadGameState(); // Might load old state
            if (typeof updatePlayerArea === 'function') updatePlayerArea();
            if (typeof updateRoundInfo === 'function') updateRoundInfo();
            if (typeof updateGameButtons === 'function') updateGameButtons();
            if (typeof updateDeckDisplay === 'function') updateDeckDisplay();
            // updateDebugNextCardDisplay and updateDatalist are typically called by the above or startNewGame.
        }
        
        const debugArea = document.getElementById('debugArea');
        if (debugArea) debugArea.style.display = 'block';

        if (typeof initializeClassicModeView === 'function') initializeClassicModeView();
        if (typeof loadTheme === 'function') loadTheme();
    }

    function setupCampaignMode() {
        activeGameMode = 'campaign';
        console.log("Switched to Campaign Mode");
        resetPlayersButton.style.display = 'none';
        document.body.classList.add('campaign-mode-active'); // Add campaign class to body

        if (addPlayerCard) addPlayerCard.style.display = 'none';
        //if (campaignStatusDisplay) campaignStatusDisplay.style.display = 'block';

        if (campaignPlayersPanel) campaignPlayersPanel.style.display = 'flex'; // Or 'block'
        if (classicPlayersPanel) classicPlayersPanel.style.display = 'none';
        if (campaignPlayersPanel) campaignPlayersPanel.innerHTML = '';

        if (drawnCardsContainer) drawnCardsContainer.innerHTML = '';

        if (typeof initializeCampaignMode === 'function') initializeCampaignMode(); // This will call updateCampaignUI
        if (typeof loadTheme === 'function') loadTheme();
    }

    function showMainMenu() {
        if (gameViewContainer.style.display !== 'none') {
            // If we are in campaign mode, we need to clean up its state before exiting.
            if (document.body.classList.contains('campaign-mode-active')) {
                prepareCampaignModeForExit();
            }
            mainMenuContainer.style.display = 'flex';
            gameViewContainer.style.display = 'none';
            document.body.classList.remove('classic-mode-active', 'campaign-mode-active');
        }
    }

    function showGameView(mode) {
        mainMenuContainer.style.display = 'none';
        gameViewContainer.style.display = 'flex';
        
        // Add a class to the body to signify which mode is active.
        // This can be used for mode-specific CSS.
        if (mode === 'classic') {
            document.body.classList.remove('campaign-mode-active');
            document.body.classList.add('classic-mode-active');
            document.getElementById('classicPlayersPanel').style.display = 'flex';
            document.getElementById('campaignPlayersPanel').style.display = 'none';
        } else if (mode === 'campaign') {
            setupCampaignMode();
        }
    }

    if (mainMenuContainer && gameViewContainer /*&& playClassicButton*/ && backToMenuButton && playCampaignButton && drawCardButton) {
        // playClassicButton.addEventListener('click', () => {
        //     mainMenuContainer.style.display = 'none';
        //     gameViewContainer.style.display = 'flex';
        //     gameViewContainer.style.flexDirection = 'column';
        //     setupClassicMode();
        //     if (resetPlayersButton) resetPlayersButton.style.display = '';
        // });

        playCampaignButton.addEventListener('click', () => {
            console.log("Play Campaign button clicked");
            showGameView('campaign');
            initializeCampaignMode(); 
        });

        backToMenuButton.addEventListener('click', () => {
            if (activeGameMode === 'classic') {
                // saveGameState(); // Decide if saving on exit is desired for classic
                if (typeof prepareClassicModeForExit === 'function') {
                    prepareClassicModeForExit();
                } else {
                    console.warn("prepareClassicModeForExit not found. Classic state might persist.");
                }
            } else if (activeGameMode === 'campaign') {
                // TODO: Add logic to save campaign run state if it's active and savable
                console.log("Returned to menu from campaign mode. Campaign state saving TBD.");
                if (typeof campaignRunActive !== 'undefined' && campaignRunActive) {
                    // alert("Warning: Campaign run is active. Progress might be lost if not saved.");
                }
                if (typeof prepareCampaignModeForExit === 'function') {
                    prepareCampaignModeForExit();
                } else {
                    console.warn("prepareCampaignModeForExit not found. Campaign state might persist.");
                }
            }
            if (resetPlayersButton) resetPlayersButton.style.display = 'none';
            activeGameMode = null;
            gameViewContainer.style.display = 'none';
            mainMenuContainer.style.display = 'flex';
            document.body.classList.remove('campaign-mode-active'); // Clean up on back to menu
            if (drawCardButton) drawCardButton.onclick = null; // Clear listener
            if (addPlayerCard) addPlayerCard.style.display = 'flex'; // Default
            //if (campaignStatusDisplay) campaignStatusDisplay.style.display = 'none'; // Default
            
            if (classicPlayersPanel) {
                classicPlayersPanel.innerHTML = ''; 
                classicPlayersPanel.style.display = 'none';
            }
            if (campaignPlayersPanel) {
                campaignPlayersPanel.innerHTML = '';
                campaignPlayersPanel.style.display = 'none';
            }
            if (drawnCardsContainer) drawnCardsContainer.innerHTML = ''; // Clear drawn cards
            document.getElementById('roundInfo').textContent = 'Round info here'; // Reset text
            document.getElementById('roundMultiplier').textContent = 'Multiplier info here';
            document.getElementById('deck').setAttribute('data-count', '0');
        });
    }

    if (newGameButton) {
        newGameButton.addEventListener('click', () => {
            if (activeGameMode === 'classic') {
                startNewGame(); // Belongs to classic-mode.js
            } else {
                console.log("New Game button clicked, but not in Classic Mode.");
                // In campaign, starting new games is handled by its internal logic (e.g. startNewAttemptForCurrentQuota)
                // So this button might be best hidden or disabled when in campaign mode via updateCampaignGameButtons
            }
        });
    }

    if (drawCardButton) {
        drawCardButton.addEventListener('click', () => {
            if (activeGameMode === 'classic') {
                classicDrawCard(); 
            } else if (activeGameMode === 'campaign') {
                campaignDrawCard(); 
            } else {
                console.log("Draw card clicked, but no active game mode.");
            }
        });
    }

    if (completeQuotaButton) {
        completeQuotaButton.addEventListener('click', () => {
            if (activeGameMode === 'campaign') {
                playerCompletesQuota();
            } else {
                console.log("Complete Quota button clicked, but not in Campaign Mode.");
            }
        });
    }

    // ... (theme selector, debug toggle, etc.)
    loadTheme(); 
    const themeSelector = document.getElementById('themeSelector');
    if(themeSelector) {
        themeSelector.value = localStorage.getItem('theme') || 'default-theme';
        themeSelector.addEventListener('change', function() {
            applyTheme(this.value);
        });
    }

    const debugToggle = document.getElementById('toggleDebugNextCard');
    if (debugToggle) {
        debugToggle.addEventListener('change', () => {
            if (activeGameMode === 'classic') {
                updateDebugNextCardDisplay(); 
            } else if (activeGameMode === 'campaign') {
                updateCampaignDebugDisplay(); 
            }
        });
    }

    // --- Tutorial Event Listeners ---
    function handleTutorialNextClick() {
        if (currentStep === tutorialSteps.length - 1) {
            closeTutorial();
        } else {
            nextStep();
        }
    }

    document.getElementById('tutorialButton').addEventListener('click', startTutorial);
    document.getElementById('tutorialCloseButton').addEventListener('click', closeTutorial);
    document.getElementById('tutorialNextButton').addEventListener('click', handleTutorialNextClick);
    document.getElementById('tutorialPrevButton').addEventListener('click', prevStep);
    
    // --- Other Event Listeners ---
    document.getElementById('backToMenuButton').addEventListener('click', showMainMenu);

    document.getElementById('resetPlayersButton').addEventListener('click', () => {
        if (confirm('Are you sure you want to reset all players and scores? This cannot be undone.')) {
            if (document.body.classList.contains('classic-mode-active')) {
                 resetClassicGame();
            }
            // Add campaign reset logic here if needed in the future
        }
    });
}); 

let notificationTimeout = null;

function showGameNotification(message, type = 'info', duration = 4000) {
    const notificationElement = document.getElementById('gameNotification');
    const messageDiv = notificationElement ? notificationElement.querySelector('.message') : null;
    const closeButton = notificationElement ? notificationElement.querySelector('.close-btn') : null;

    if (!notificationElement || !messageDiv || !closeButton) {
        console.warn("Notification elements not found. Falling back to alert.");
        alert(message);
        return;
    }

    // Clear any existing timeout to prevent premature closing
    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
        notificationTimeout = null;
    }

    messageDiv.textContent = message;

    // Reset classes and apply new type
    notificationElement.className = ''; // Clear all existing classes first
    notificationElement.classList.add(type); // Add specific type class (e.g., 'success', 'error')
    
    // Make it visible and trigger animation
    notificationElement.classList.add('show');
    notificationElement.classList.remove('hide'); // Ensure hide is removed if it was there

    const closeNotification = () => {
        notificationElement.classList.remove('show');
        notificationElement.classList.add('hide');
        // Wait for animation to finish before setting display:none (or rely on CSS to handle it)
        // For simplicity, CSS will hide it when .hide is present and opacity is 0.
        // To ensure it can be reshown correctly if .hide isn't removed by .show logic:
        setTimeout(() => {
            if (notificationElement.classList.contains('hide')) { // check if it wasn't re-shown quickly
                 notificationElement.style.display = 'none'; // Fully hide after animation
            }
        }, 300); // Matches CSS transition duration
        if (notificationTimeout) {
            clearTimeout(notificationTimeout);
            notificationTimeout = null;
        }
    };

    // Close button functionality
    closeButton.onclick = closeNotification; 

    // Auto-hide if duration is set
    if (duration > 0) {
        notificationTimeout = setTimeout(closeNotification, duration);
    }
} 

function applyTheme(themeName) {
    document.documentElement.dataset.theme = themeName;
    localStorage.setItem('theme', themeName);
    console.log(`Theme applied: ${themeName}`);

    // Update theme selector dropdown if it exists (it might not on initial load if script runs before DOMContentLoaded)
    const themeSelector = document.getElementById('themeSelector');
    if (themeSelector) {
        themeSelector.value = themeName;
    }
}

function loadTheme() {
    const knownThemes = ["neon", "light", "dark-standard", "casino-green"];
    let savedTheme = localStorage.getItem('theme');
    if (savedTheme && knownThemes.includes(savedTheme)) {
        applyTheme(savedTheme); 
    } else {
        applyTheme("neon"); // Default theme if nothing valid saved
    }
} 