let activeGameMode = null; // Can be 'classic' or 'campaign'
let currentGameMode = 'classic'; // Default mode

document.addEventListener('DOMContentLoaded', function() {
    const mainMenuContainer = document.getElementById('mainMenuContainer');
    const gameViewContainer = document.getElementById('gameViewContainer');
    const playClassicButton = document.getElementById('playClassicButton');
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
    const newPlayerNameInput = document.getElementById('newPlayerNameInput');
    const newPlayerChipsInput = document.getElementById('newPlayerChipsInput');
    const addPlayerForm = document.querySelector('.add-player-form');
    const themeSelector = document.getElementById('themeSelector');
    const debugToggle = document.getElementById('toggleDebugNextCard');
    const tutorialButton = document.getElementById('tutorialButton');
    const tutorialCloseButton = document.getElementById('tutorialCloseButton');
    const tutorialModal = document.getElementById('tutorialModal');
    const header = document.querySelector('header');
    const headerToggleButton = document.getElementById('headerToggleButton');

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
            adjustMenuLogo();
        }
    }

    function showGameView(mode) {
        const mainMenu = document.getElementById('mainMenuContainer');
        const gameView = document.getElementById('gameViewContainer');
        const resetPlayersButton = document.getElementById('resetPlayersButton');
        const auxPanel = document.getElementById('auxPanel');

        mainMenu.style.display = 'none';
        gameView.style.display = 'flex';

        currentGameMode = mode;
        console.log(`Switched to ${mode} mode.`);

        if (mode === 'classic') {
            document.body.classList.remove('campaign-mode-active');
            document.body.classList.add('classic-mode-active');
            document.getElementById('classicPlayersPanel').style.display = 'flex';
            document.getElementById('campaignPlayersPanel').style.display = 'none';
            resetPlayersButton.style.display = 'inline-block';
            auxPanel.style.display = 'flex';
        } else if (mode === 'campaign') {
            document.body.classList.remove('classic-mode-active');
            document.body.classList.add('campaign-mode-active');
            document.getElementById('classicPlayersPanel').style.display = 'none';
            document.getElementById('campaignPlayersPanel').style.display = 'flex';
            resetPlayersButton.style.display = 'none';
            auxPanel.style.display = 'none';
        }
    }

    // --- Header Collapse Logic ---
    if (header && headerToggleButton) {
        // Start expanded on larger screens for better UX, collapsed on mobile/tablet
        if (window.innerWidth > 1024) {
            header.classList.add('header-expanded');
        } else {
            header.classList.remove('header-expanded');
        }

        headerToggleButton.addEventListener('click', () => {
            header.classList.toggle('header-expanded');
        });
    }

    // --- Tutorial Modal Logic ---
    if (tutorialButton && tutorialModal) {
        tutorialButton.addEventListener('click', () => {
            startTutorial();
        });
    }

    if(tutorialCloseButton && tutorialModal) {
        tutorialCloseButton.addEventListener('click', () => {
            closeTutorial();
        });
    }

    const tutorialNextButton = document.getElementById('tutorialNextButton');
    if (tutorialNextButton) {
        tutorialNextButton.addEventListener('click', () => {
            if (tutorialNextButton.textContent === 'Finish') {
                closeTutorial();
            } else {
                nextStep();
            }
        });
    }

    const tutorialPrevButton = document.getElementById('tutorialPrevButton');
    if (tutorialPrevButton) {
        tutorialPrevButton.addEventListener('click', () => {
            prevStep();
        });
    }

    // --- Main Menu and Game View Logic ---
    if (playClassicButton) {
        playClassicButton.addEventListener('click', () => {
            showGameView('classic');
            setupClassicMode();
        });
    }

    if (playCampaignButton) {
        playCampaignButton.addEventListener('click', () => {
            showGameView('campaign');
            setupCampaignMode();
        });
    }

    if (backToMenuButton) {
        backToMenuButton.addEventListener('click', () => {
            // Reset the state for whichever mode is active.
            if (currentGameMode === 'campaign') {
                prepareCampaignModeForExit();
            } else if (currentGameMode === 'classic') {
                prepareClassicModeForExit();
            }
            showMainMenu();
        });
    }

    // --- Classic Mode Game Controls ---
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

    if (addPlayerForm) {
        addPlayerForm.addEventListener('submit', (event) => {
            event.preventDefault();
            handleAddPlayerOrLoan();
        });
    }

    // --- Global Controls ---
    if (themeSelector) {
        // Load saved theme
        const savedTheme = localStorage.getItem('theme') || 'neon';
        document.documentElement.dataset.theme = savedTheme;
        themeSelector.value = savedTheme;

        // Listen for changes
        themeSelector.addEventListener('change', (event) => {
            setTheme(event.target.value);
        });
    }

    if(debugToggle) {
        debugToggle.addEventListener('change', () => {
            if (currentGameMode === 'classic') {
                updateDebugNextCardDisplay();
            } else if (currentGameMode === 'campaign') {
                updateCampaignDebugDisplay();
            }
        });
    }

    // Initial and responsive adjustments for menu layout
    adjustMenuLogo();
    window.addEventListener('resize', debounce(adjustMenuLogo, 150));
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

function setTheme(themeName) {
    document.documentElement.dataset.theme = themeName;
    localStorage.setItem('theme', themeName);
}

function adjustMenuLogo() {
    const menuContainer = document.getElementById('mainMenuContainer');
    const logo = menuContainer.querySelector('.menu-title img');
    
    if (!menuContainer || !logo) {
        if (menuContainer) menuContainer.classList.remove('menu-hidden');
        return;
    }

    const performAdjustment = () => {
        // 1. Reset width to the CSS default to get a baseline
        logo.style.width = '';

        let maxTries = 10; // Safety break

        function checkAndResize() {
            if (maxTries-- <= 0) {
                console.warn('adjustMenuLogo reached max iterations.');
                menuContainer.classList.remove('menu-hidden'); // Show menu even if it fails
                return;
            }

            // 2. Check for overflow
            if (menuContainer.scrollHeight > menuContainer.clientHeight) {
                // 3. If overflowing, shrink the logo and re-check on the next frame
                const currentWidth = logo.clientWidth;
                logo.style.width = (currentWidth * 0.95) + 'px';
                requestAnimationFrame(checkAndResize);
            } else {
                // No overflow, we're done. Show the menu.
                menuContainer.classList.remove('menu-hidden');
            }
        }
        
        requestAnimationFrame(checkAndResize);
    };

    // Ensure the logo image is loaded before we try to measure it.
    if (logo.complete) {
        performAdjustment();
    } else {
        logo.addEventListener('load', performAdjustment, { once: true });
        logo.addEventListener('error', () => {
            // If the logo fails to load, just show the menu anyway.
            console.error("Logo image failed to load.");
            performAdjustment(); // Try to adjust based on text/other content
        }, { once: true });
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const menuContainer = document.getElementById('mainMenuContainer');
        // Check computed style to see if the menu is actually visible
        if (menuContainer && window.getComputedStyle(menuContainer).display !== 'none') {
            menuContainer.classList.add('menu-hidden');
        }

        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
} 