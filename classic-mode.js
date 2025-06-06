// Game State Constants, Choices, Suits, Card Values are now in core-game-rules.js

let players = {};
let selectedPlayer = null;

// Add these initializations
let currentRound = 1;
let gameInProgress = false;
let activePlayers = new Set();
let deck = [];
let drawnCards = [];
// The roundMultipliers in classic-mode.js will use the BASE_ROUND_MULTIPLIERS as its default
// This allows classic mode to potentially have its own variant multipliers in the future if needed,
// or for Campaign mode to have a different way of managing multipliers.
let roundMultipliers = { ...BASE_ROUND_MULTIPLIERS }; 

let gamePhase = PHASE_BETTING; // Initial phase from core-game-rules.js

// Initialize the deck for Classic Mode
function initializeDeck() {
    console.log("classic-mode.js: initializeDeck");
    deck = createInitialDeck(); // Uses function from core-game-rules.js
    updateDeckDisplay();
    updateDebugNextCardDisplay();
}

// Call initializeDeck when starting a new game (specific to classic mode flow)
function startNewRound() {
    currentRound = 1;
    drawnCards = [];
    activePlayers = new Set(Object.keys(players).filter(playerName => players[playerName].chips > 0));
    
    Object.keys(players).forEach(playerName => {
        players[playerName].eliminated = false;
        players[playerName].currentChoice = undefined;
        players[playerName].lastBet = 0; // Bets reset per new round in classic
    });
    
    updateRoundInfo();
    updatePlayerArea();
    updateGameButtons();
    updateDeckDisplay();
    updateDebugNextCardDisplay();
}

const availableThemes = ["neon", "light", "dark-standard", "casino-green"];

function applyTheme(themeName) {
  if (!availableThemes.includes(themeName)) {
    themeName = availableThemes[0]; 
  }
  document.body.dataset.theme = themeName;
  localStorage.setItem('theme', themeName);
  updatePlayerArea();
  updateDebugNextCardDisplay(); 

  Object.entries(players).forEach(([name, player]) => {
    if (player.currentChoice) {
      const playerCard = document.querySelector(`.player-controls input[value="${name}"]`)?.closest('.player-controls');
      if (playerCard) {
        const choiceButtons = playerCard.querySelectorAll('.choice-button');
        choiceButtons.forEach(button => {
          if (button.textContent.toLowerCase() === player.currentChoice) {
            button.classList.add('selected');
          } else {
            button.classList.remove('selected');
          }
        });
      }
    }
  });
}

function loadTheme() {
  let savedTheme = localStorage.getItem('theme');
  if (!savedTheme || !availableThemes.includes(savedTheme)) {
    savedTheme = availableThemes[0]; 
  }
  applyTheme(savedTheme);
  const themeSelector = document.getElementById('themeSelector');
  if (themeSelector) themeSelector.value = savedTheme;
}


// The window.onload in classic-mode.js is no longer needed as main.js handles initial load calls.
// However, we might need a specific function to initialize classic mode if called from main.js
// For now, main.js calls loadGameState() and UI updates directly.

// Classic mode specific save function (might be renamed or adapted later)
function savePlayers() {
  // In classic mode, player data is saved under a specific key.
  localStorage.setItem('classic_players', JSON.stringify(players));
  // UI updates related to saving might be better handled by the calling function
  // updateDeckDisplay(); // These seem out of place for a function named savePlayers
  // updateDebugNextCardDisplay();
}

// Overarching save game state for classic mode
function saveGameState() {
  const gameState = {
    players,
    deck,
    drawnCards,
    currentRound,
    gameInProgress,
    activePlayers: Array.from(activePlayers),
    gamePhase
  };
  localStorage.setItem('classic_gameState', JSON.stringify(gameState));
  // Datalist update is a UI concern, moved to be called after state changes typically.
  // if (typeof updateDatalist === 'function') { updateDatalist(); }
}

// Overarching load game state for classic mode
function loadGameState() {
  const savedState = localStorage.getItem('classic_gameState');
  if (savedState) {
    const gameState = JSON.parse(savedState);
    players = gameState.players || {};
    deck = gameState.deck || [];
    drawnCards = gameState.drawnCards || [];
    currentRound = gameState.currentRound || 1;
    gameInProgress = gameState.gameInProgress || false;
    activePlayers = new Set(gameState.activePlayers || []);
    gamePhase = gameState.gamePhase || PHASE_BETTING;

    if (deck.length === 0 && (gamePhase === PHASE_PLAYING || (gamePhase === PHASE_BETTING && activePlayers.size > 0))) {
        console.log("Classic mode: Deck empty on load during active game/betting, re-initializing.");
        initializeDeck(); // Re-initialize if deck is empty but game was in progress or bets were placed
    }

  } else {
    players = {}; // Ensure players is an empty object if no saved state
    initializeDeck(); 
    gamePhase = PHASE_BETTING; 
  }
  // UI updates are now called by main.js after loadGameState
}


function handleAddPlayerOrLoan() {
  const nameInput = document.getElementById('newPlayerNameInput');
  const chipsInput = document.getElementById('newPlayerChipsInput');
  const name = nameInput.value.trim();
  const chips = parseInt(chipsInput.value);

  if (!name || isNaN(chips) || chips < 0) {
    // alert('Please enter a valid name and a non-negative chip amount.');
    showGameNotification('Please enter a valid name and a non-negative chip amount.', 'warning');
    return;
  }

  if (players[name]) {
    players[name].chips += chips;
    players[name].debt = (players[name].debt || 0) + chips;
  } else {
    players[name] = { chips, lastBet: 0, debt: 0, currentChoice: undefined, historicalBet: 0 };
  }

  updatePlayerArea();
  updateWallOfShame();
  saveGameState(); // Use the more comprehensive save function
  if (typeof updateDatalist === 'function') updateDatalist(); // Ensure datalist updates

  nameInput.value = '';
  chipsInput.value = '';
  nameInput.dispatchEvent(new Event('input'));
}

function payDebt(playerName) {
  const targetPlayerName = playerName || selectedPlayer;
  if (!targetPlayerName) {
    // alert('Select a player or use the specific pay debt button.');
    showGameNotification('Select a player or use the specific pay debt button.', 'warning');
    return;
  }
  const player = players[targetPlayerName];
  if (player && player.debt > 0 && player.chips > 0) {
    const payment = Math.min(player.chips, player.debt);
    player.chips -= payment;
    player.debt -= payment;
    updatePlayerArea(); 
    saveGameState();
    if (typeof updateDatalist === 'function') updateDatalist();
  } else if (player && player.debt <= 0) {
    // alert(`${targetPlayerName} has no debt to pay.`);
    showGameNotification(`${targetPlayerName} has no debt to pay.`, 'info');
  } else if (player && player.chips <= 0) {
    // alert(`${targetPlayerName} has no chips to pay with.`);
    showGameNotification(`${targetPlayerName} has no chips to pay with.`, 'warning');
  }
}

function resetPlayers() {
  if (confirm('Are you sure you want to reset all player data for Classic Mode?')) {
    players = {};
    selectedPlayer = null;
    gameInProgress = false;
    currentRound = 1;
    drawnCards = [];
    activePlayers.clear(); 
    gamePhase = PHASE_BETTING;

    initializeDeck(); // This creates a new deck and does initial UI updates for deck
    updateDrawnCardsDisplay();
    updateRoundInfo();
    updatePlayerArea(); // This also calls updateGameButtons
    saveGameState(); 
    if (typeof updateDatalist === 'function') updateDatalist();
  }
}

function updatePlayerArea() {
    const playerArea = document.getElementById('classicPlayersPanel');
    if (!playerArea) return;
    playerArea.innerHTML = '';

    Object.entries(players).forEach(([name, player]) => {
        const playerDiv = createPlayerControlsDiv(name, player);
        playerArea.appendChild(playerDiv);
    });
    updateGameButtons();
    updateWallOfShame(); 
    calculateAndApplyColumnWidths(); 
}

function createPlayerControlsDiv(name, player) {
    const playerDiv = document.createElement('div');
    playerDiv.className = 'player-controls';

    const headerRow = document.createElement('div');
    headerRow.className = 'player-header-row';
    const nameDiv = document.createElement('div');
    nameDiv.className = 'player-name';
    nameDiv.textContent = name;
    const chipsDiv = document.createElement('div');
    chipsDiv.className = 'player-chips';
    chipsDiv.textContent = `Chips: ${player.chips}`;
    headerRow.appendChild(nameDiv);
    headerRow.appendChild(chipsDiv);
    playerDiv.appendChild(headerRow);

    const betRow = document.createElement('div');
    betRow.className = 'player-bet-row';
    const betInputId = `betInput_${name}`;
    const betInput = document.createElement('input');
    betInput.type = 'number';
    betInput.id = betInputId;
    betInput.value = player.lastBet || 0;
    betInput.min = 0;
    betInput.max = player.chips > 0 ? player.chips : 0;
    betInput.onchange = () => {
        let newBet = parseInt(betInput.value) || 0;
        if (newBet < 0) newBet = 0;
        if (newBet > player.chips) {
            newBet = player.chips;
            betInput.value = newBet;
            // alert("Bet cannot exceed current chips. Bet adjusted.");
            showGameNotification("Bet cannot exceed current chips. Bet adjusted.", 'warning');
        }
        player.lastBet = newBet;
        activePlayers = getActivePlayers(); 
        updatePlayerArea();   
        updateGameButtons();  
        updateRoundInfo();    
        saveGameState(); // Save state after bet change
    };
    betInput.readOnly = gamePhase === PHASE_PLAYING || gamePhase === PHASE_GAME_OVER || player.chips <= 0;
    if (player.chips <= 0 && gamePhase !== PHASE_PLAYING) {
        player.lastBet = 0;
        betInput.value = 0;
    }
    betRow.appendChild(betInput);

    if (gamePhase === PHASE_BETTING && player.historicalBet > 0 && player.chips >= player.historicalBet) {
        const useLastBetButton = document.createElement('button');
        useLastBetButton.textContent = `Use Last (${player.historicalBet})`;
        useLastBetButton.className = 'use-last-bet-button';
        useLastBetButton.onclick = () => {
            const betInputElement = document.getElementById(betInputId);
            if (betInputElement) {
                if (player.chips >= player.historicalBet) {
                    betInputElement.value = player.historicalBet;
                    betInputElement.dispatchEvent(new Event('change', { bubbles: true }));
                } else {
                    // alert("Not enough chips to use last bet amount.");
                    showGameNotification("Not enough chips to use last bet amount.", 'warning');
                }
            }
        };
        betRow.appendChild(useLastBetButton);
    }

    if (player.debt > 0 && player.chips > 0) {
        const payDebtButton = document.createElement('button');
        payDebtButton.textContent = 'Pay Debt';
        payDebtButton.className = 'choice-button'; // Consistent styling
        payDebtButton.onclick = () => payDebt(name);
        betRow.appendChild(payDebtButton);
    }
    playerDiv.appendChild(betRow);

    if ((gamePhase === PHASE_BETTING || gamePhase === PHASE_PLAYING) && player.lastBet > 0) {
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'choice-buttons';
        let choices = [];
        
        if (gamePhase === PHASE_BETTING && currentRound === 1) { // Only R1 choices in betting phase
            choices = [CHOICE_RED, CHOICE_BLACK];
        } else if (gamePhase === PHASE_PLAYING) {
            switch (currentRound) {
                case 1: choices = [CHOICE_RED, CHOICE_BLACK]; break;
                case 2: choices = [CHOICE_HIGHER, CHOICE_LOWER]; break;
                case 3: choices = [CHOICE_INSIDE, CHOICE_OUTSIDE]; break;
                case 4: choices = [SUIT_SPADES, SUIT_HEARTS, SUIT_DIAMONDS, SUIT_CLUBS]; break;
                case 5: choices = []; break; // R5 is special input or cashout
            }
            if (currentRound > 1 && currentRound <= 5) { // Cash out option available from R2 onwards (or R5 for R4 winnings)
                const cashOutButton = document.createElement('button');
                cashOutButton.className = 'cash-out-button';
                const multiplierRoundForCashOut = (currentRound === 5) ? 4 : currentRound - 1;
                const cashOutMultiplier = roundMultipliers[multiplierRoundForCashOut] || 0;
                cashOutButton.textContent = `Cash Out (${cashOutMultiplier}x = ${player.lastBet * cashOutMultiplier} chips)`;
                cashOutButton.onclick = () => handleCashOut(name);
                buttonsContainer.appendChild(cashOutButton);
            }
            if (currentRound === 5) {
                const valueSelect = document.createElement('select');
                valueSelect.id = `r5_value_select_${name}`;
                valueSelect.className = 'choice-button'; // Consistent styling
                const placeholderOption = document.createElement('option');
                placeholderOption.value = "";
                placeholderOption.textContent = "Guess Value...";
                placeholderOption.selected = true;
                placeholderOption.disabled = true;
                valueSelect.appendChild(placeholderOption);
                CARD_VALUES_WITH_ACE_HIGH.forEach(val => {
                    const option = document.createElement('option');
                    option.value = val;
                    option.textContent = val;
                    valueSelect.appendChild(option);
                });
                if (player.currentChoice) {
                    valueSelect.value = player.currentChoice;
                }
                valueSelect.onchange = function() {
                    if (this.value) makeChoice(name, this.value);
                };
                buttonsContainer.appendChild(valueSelect);
            }
        }
        
        choices.forEach(choiceText => {
            const button = document.createElement('button');
            button.className = 'choice-button';
            button.textContent = choiceText.charAt(0).toUpperCase() + choiceText.slice(1);
            button.onclick = () => makeChoice(name, choiceText);
            if (player.currentChoice && choiceText.toLowerCase() === player.currentChoice.toLowerCase()) {
                button.classList.add('selected');
            }
            buttonsContainer.appendChild(button);
        });

        if (buttonsContainer.hasChildNodes()) {
            playerDiv.appendChild(buttonsContainer);
        }
    }
    return playerDiv;
}

function calculateAndApplyColumnWidths() {
    const columnClasses = ['.player-name', '.player-chips', '.player-bet-row', '.choice-buttons'];
    const playerRows = document.querySelectorAll('#classicPlayersPanel .player-controls');
    if (playerRows.length === 0) return;

    columnClasses.forEach(selector => {
        let maxWidth = 0;
        const elementsToMeasure = [];
        playerRows.forEach(row => {
            const el = row.querySelector(selector);
            if (el) {
                el.style.flexBasis = 'auto'; 
                elementsToMeasure.push(el);
            }
        });
        elementsToMeasure.forEach(el => {
            if (el.scrollWidth > maxWidth) maxWidth = el.scrollWidth;
        });
        const finalWidth = maxWidth + 10; // Add some padding
        elementsToMeasure.forEach(el => {
            el.style.flexBasis = `${finalWidth}px`;
        });
    });
}

function makeChoice(playerName, choice) {
    const player = players[playerName];
    if (!player || player.lastBet <= 0) {
        console.log(`Cannot make choice for ${playerName} - no bet placed or player not found`);
        return;
    }
    player.currentChoice = choice;
    updatePlayerArea(); 
    updateGameButtons(); 
    updateRoundInfo(); 
    saveGameState(); // Save state after choice
}

async function drawCard() {
    const deckElement = document.getElementById('deck');
    const gameBoardPanel = document.getElementById('gameBoardPanel');
    if (!deckElement || !gameBoardPanel) return;

    if (gamePhase === PHASE_BETTING) {
        const currentBettingPlayers = getActivePlayers();
        if (currentBettingPlayers.size === 0 || !allActivePlayersMadeChoices(false)) {
            // alert('All active players must place bets and make their Round 1 choices before starting.');
            showGameNotification('All active players must place bets and make their Round 1 choices before starting.', 'warning', 5000);
            return;
        }
        currentBettingPlayers.forEach(playerName => {
            const player = players[playerName];
            if (player.lastBet > 0) {
                player.historicalBet = player.lastBet;
                player.chips -= player.lastBet; 
            }
        });
        gamePhase = PHASE_PLAYING;
        gameInProgress = true;
        currentRound = 1; // Explicitly start at round 1 for card draw logic
        drawnCards = []; // Clear any previous drawn cards
        updateDrawnCardsDisplay(); // Clear UI
        console.log('[DrawCard] Transitioned to playing phase, round 1.');
    } else if (gamePhase === PHASE_PLAYING) {
        if (!allActivePlayersMadeChoices(true) || deck.length === 0) {
            console.log('[DrawCard] Waiting for choices or deck empty.');
            return;
        }
    }

    const card = deck.pop();
    if (!card) return;

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

    drawnCards.push(card);
    updateDrawnCardsDisplay(true);

    const drawnCardsContainer = document.getElementById('drawnCards');
    const actualCardElement = drawnCardsContainer.lastElementChild;

    if (actualCardElement) {
        const targetRect = actualCardElement.getBoundingClientRect();
        requestAnimationFrame(() => {
            ghostCard.style.transform = `translate(${(targetRect.left - deckRect.left)}px, ${(targetRect.top - deckRect.top)}px) scale(1)`;
            ghostCard.style.width = targetRect.width + 'px';
            ghostCard.style.height = targetRect.height + 'px';
            ghostCard.addEventListener('transitionend', () => {
                if (ghostCard.parentNode) ghostCard.parentNode.removeChild(ghostCard);
                actualCardElement.classList.remove('drawn-card-target');
            }, { once: true });
        });
    } else {
        if (ghostCard.parentNode) ghostCard.parentNode.removeChild(ghostCard);
    }

    processRoundResults(card);
    
    // ProcessRoundResults might change gamePhase to gameOver or increment currentRound
    // UI updates should reflect the state AFTER results are processed.
    updateDeckDisplay();
    updatePlayerArea(); // Will show new choices or updated chip counts
    updateGameButtons(); // Reflects if game is over or next turn possible
    updateRoundInfo();   // Shows new round or game over message
    updateDebugNextCardDisplay();
    saveGameState(); // Save the new state after a card draw and results processing
}

function updateDrawnCardsDisplay(animateLastCard = false) {
  const container = document.getElementById('drawnCards');
  if (!container) return;
  container.innerHTML = '';
  drawnCards.forEach((card, index) => {
    const cardElement = document.createElement('div');
    cardElement.className = 'card';
    cardElement.style.color = [SUIT_HEARTS, SUIT_DIAMONDS].includes(card.suit) ? 'red' : 'black';
    cardElement.textContent = `${card.value}${card.suit}`;
    if (animateLastCard && index === drawnCards.length - 1) {
      cardElement.classList.add('drawn-card-target');
    }
    container.appendChild(cardElement);
  });
}

function processRoundResults(drawnCard) {
    const playersToEvaluate = new Set(activePlayers); // Process only players active at the start of this draw

    playersToEvaluate.forEach(playerName => {
        const player = players[playerName];
        if (!player || !player.currentChoice) return; // Skip if player somehow has no choice

        let playerWins = false;
        const numericalDrawnCardValue = getCardValue(drawnCard.value);

        switch (currentRound) {
            case 1:
                playerWins = evaluateRound1Win(player.currentChoice, drawnCard.suit);
                break;
            case 2:
                if (drawnCards.length < 2) { playerWins = false; break; } // Need previous card
                const prevCardNumericalValue = getCardValue(drawnCards[drawnCards.length - 2].value);
                playerWins = evaluateRound2Win(player.currentChoice, numericalDrawnCardValue, prevCardNumericalValue);
                break;
            case 3:
                if (drawnCards.length < 3) { playerWins = false; break; } // Need two previous cards for range
                const card1Val = getCardValue(drawnCards[0].value);
                const card2Val = getCardValue(drawnCards[1].value);
                playerWins = evaluateRound3Win(player.currentChoice, numericalDrawnCardValue, card1Val, card2Val);
                break;
            case 4:
                playerWins = evaluateRound4Win(player.currentChoice, drawnCard.suit);
                break;
            case 5: // Guess the exact value
                playerWins = evaluateRound5Win(player.currentChoice, drawnCard.value);
                break;
        }

        if (!playerWins) {
            activePlayers.delete(playerName); // Player is out
            player.lastBet = 0; // Lose the bet, effectively
            console.log(`${playerName} lost Round ${currentRound}.`);
        } else {
            console.log(`${playerName} won Round ${currentRound}!`);
            if (currentRound === 5) { // Won final round
                player.chips += player.lastBet * (roundMultipliers[5] || BASE_ROUND_MULTIPLIERS[5]);
                activePlayers.delete(playerName); // Won the game, out of active play
                player.lastBet = 0;
            }
            // For rounds 1-4, bet carries over. Chips are only modified by loss or cashout/final win.
        }
        player.currentChoice = undefined; // Reset choice for next round/action
    });

    if (activePlayers.size === 0 && gameInProgress) {
        console.log('[ProcessResults] All players eliminated or won. Ending game.');
        endGame();
    } else if (gamePhase === PHASE_PLAYING && currentRound < 5 && activePlayers.size > 0) {
        currentRound++;
        console.log(`[ProcessResults] Advancing to Round ${currentRound}.`);
    } else if (gamePhase === PHASE_PLAYING && currentRound === 5 && activePlayers.size > 0) {
        // If it's round 5 and there are still active players, it means they won R4 and must now choose R5 or cash out.
        // No automatic advancement here; player action is required via createPlayerControlsDiv.
        console.log('[ProcessResults] Round 5. Players need to make choice or cash out.');
    } else if (gamePhase === PHASE_PLAYING && activePlayers.size === 0) {
        // This case should be caught by the first if, but as a fallback:
        endGame();
    }
    // UI updates are called in drawCard after this function returns
}


function updateRoundInfo() {
    const roundInfo = document.getElementById('roundInfo');
    const multiplierInfo = document.getElementById('roundMultiplier');
    if (!roundInfo || !multiplierInfo) return;

    if (gamePhase === PHASE_GAME_OVER) {
        roundInfo.textContent = 'Game Over! Click \'New Game\' to play again.';
        const anyHistoricalBets = Object.values(players).some(p => p.historicalBet > 0);
        multiplierInfo.textContent = anyHistoricalBets ? 'Use \'Last Bet\' for previous bets.' : 'Deck reshuffled on New Game.';
    } else if (gamePhase === PHASE_BETTING) {
        const currentBettingPlayers = getActivePlayers();
        if (currentBettingPlayers.size === 0) {
            roundInfo.textContent = 'Classic Mode: Place your bets!';
            multiplierInfo.textContent = 'Deck will be reshuffled on New Game.';
        } else {
            const playersNeedingChoice = Array.from(currentBettingPlayers).filter(name => !players[name].currentChoice).length;
            if (playersNeedingChoice > 0) {
                roundInfo.textContent = 'Round 1: Guess Red or Black';
                multiplierInfo.textContent = `Waiting for ${playersNeedingChoice} player(s) to choose.`;
            } else {
                roundInfo.textContent = 'Ready to Play!';
                multiplierInfo.textContent = 'Click Draw Card to start.';
            }
        }
    } else if (gamePhase === PHASE_PLAYING) {
        let roundText = `Round ${currentRound}: `;
        let multiplierText = `Multiplier for Cash Out: `;
        switch (currentRound) {
            case 1: 
                roundText += 'Red or Black?'; 
                multiplierText = `Win: ${roundMultipliers[1]}x (Bet carries over if won)`;
                break;
            case 2: 
                roundText += 'Higher or Lower?'; 
                multiplierText = `Cash Out: ${roundMultipliers[1]}x. (Bet carries if win)`; 
                break;
            case 3: 
                roundText += 'Inside or Outside?'; 
                multiplierText = `Cash Out: ${roundMultipliers[2]}x. (Bet carries if win)`; 
                break;
            case 4: 
                roundText += 'Guess the Suit'; 
                multiplierText = `Cash Out: ${roundMultipliers[3]}x. (Bet carries if win)`; 
                break;
            case 5: 
                roundText += 'Guess Exact Card Value or Cash Out'; 
                multiplierText = `Cash Out (R4 win): ${roundMultipliers[4]}x. Guess Value Win: ${roundMultipliers[5]}x`; 
                break;
        }
        roundInfo.textContent = roundText;
        multiplierInfo.textContent = multiplierText;
    }
}

function handleCashOut(playerName) {
    const player = players[playerName];
    if (!player || gamePhase !== PHASE_PLAYING || !activePlayers.has(playerName) || player.lastBet <= 0) return;
    
    // Cash out is always based on the bet that won the *previous* round.
    // For R5 cash out, it's R4 multiplier. For R2 cash out, it's R1 multiplier.
    // currentRound is the round they are ABOUT to play, so cash out uses currentRound-1 multiplier.
    const cashOutMultiplierRound = (currentRound === 5) ? 4 : currentRound - 1;
    if (cashOutMultiplierRound < 1) { console.log("Cannot cash out before Round 2."); return; }

    const multiplier = roundMultipliers[cashOutMultiplierRound] || BASE_ROUND_MULTIPLIERS[cashOutMultiplierRound];
    const winnings = player.lastBet * multiplier;
    player.chips += winnings;
    
    console.log(`${playerName} cashed out. Original bet: ${player.lastBet}, Multiplier: ${multiplier}x (from R${cashOutMultiplierRound}), Winnings: ${winnings}, New Chips: ${player.chips}`);

    player.lastBet = 0; // Bet is now cashed out
    player.historicalBet = 0; // Reset historical too, as this sequence ended.
    activePlayers.delete(playerName);

    updatePlayerArea(); 
    updateGameButtons(); 
    updateRoundInfo();
    saveGameState();

    if (activePlayers.size === 0 && gameInProgress) {
        endGame();
    }
}

function endGame() {
    console.log('[endGame] Classic Mode Game Over.');
    gameInProgress = false;
    gamePhase = PHASE_GAME_OVER; 
    // currentRound is not reset here, let it reflect the round the game ended on until new game.
    
    Object.values(players).forEach(p => {
        p.currentChoice = undefined; // Clear choices, bets remain for potential 'Use Last Bet'
    });

    updateDeckDisplay(); 
    updateRoundInfo();
    updatePlayerArea(); 
    updateGameButtons(); 
    saveGameState();
}

function updateWallOfShame() {
    const wallOfShameArea = document.getElementById('wallOfShameArea');
    const wallOfShameContent = document.getElementById('wallOfShameContent');
    if (!wallOfShameArea || !wallOfShameContent) return;

    wallOfShameContent.innerHTML = '';
    let hasDebt = false;
    Object.entries(players).forEach(([name, player]) => {
        if (player.debt > 0) {
            hasDebt = true;
            const debtEntry = document.createElement('p');
            debtEntry.textContent = `${name}: ${player.debt} chips in debt`;
            wallOfShameContent.appendChild(debtEntry);
        }
    });
    wallOfShameArea.style.display = hasDebt ? '' : 'none';
}

function startNewGame() { // Specific to Classic Mode Button
    console.log('[startNewGame] Classic Mode CLICKED');
    gamePhase = PHASE_BETTING;
    gameInProgress = false; 
    initializeDeck();     
    currentRound = 1;
    drawnCards = [];      
    updateDrawnCardsDisplay();

    Object.values(players).forEach(player => {
        player.currentChoice = undefined; // Bets from previous game (if any) persist for "Use Last Bet"
        // player.lastBet = 0; // Do not reset lastBet here, allow Use Last Bet feature for first round
    });
    
    activePlayers = getActivePlayers(); 

    updateRoundInfo();
    updatePlayerArea(); 
    updateGameButtons();
    saveGameState();
}

function shouldGameBeInProgress() {
    // This function helps determine if, on load, a game was potentially underway.
    // It's a bit simplistic for complex state recovery but okay for classic.
    const hasBetsOrChoices = Object.values(players).some(p => p.lastBet > 0 || p.currentChoice !== undefined);
    return gameInProgress || (gamePhase === PHASE_PLAYING) || (gamePhase === PHASE_BETTING && hasBetsOrChoices);
}


function updateDeckDisplay() {
  const deckDiv = document.getElementById('deck');
  if (deckDiv) {
      deckDiv.setAttribute('data-count', deck.length > 0 ? deck.length : 'Empty');
  }
}

// function toggleSelectAllPlayers(selectAllCheckbox) { ... } // Seems unused, remove if confirmed

// Helper: Get active players (bet > 0 and not eliminated)
function getActivePlayers() {
    return new Set(Object.keys(players).filter(name => players[name] && players[name].lastBet > 0 && !players[name].eliminated));
}

// Helper: Check if all active players have made their choices
function allActivePlayersMadeChoices(checkPlayingPhase = false) {
    const playersToCheck = checkPlayingPhase ? activePlayers : getActivePlayers();
    if (playersToCheck.size === 0 && checkPlayingPhase) return false; // No active players in playing phase means no one to make choices
    if (playersToCheck.size === 0 && !checkPlayingPhase) return false; // No betting players means no one to make choices
    
    return Array.from(playersToCheck).every(name => {
        const player = players[name];
        return player && player.currentChoice !== undefined;
    });
}

function updateGameButtons() {
    const newGameButton = document.getElementById('newGameButton');
    const drawCardButton = document.getElementById('drawCardButton');
    if (!newGameButton || !drawCardButton) return;

    newGameButton.className = 'draw-button'; 

    if (gamePhase === PHASE_GAME_OVER) {
        newGameButton.style.display = '';
        drawCardButton.style.display = 'none';
        newGameButton.disabled = Object.keys(players).length === 0; // Disable if no players exist at all
    } else if (gamePhase === PHASE_BETTING) {
        newGameButton.style.display = 'none';
        drawCardButton.style.display = '';
        const bettingPlayers = getActivePlayers();
        drawCardButton.disabled = !(bettingPlayers.size > 0 && allActivePlayersMadeChoices(false));
    } else if (gamePhase === PHASE_PLAYING) {
        newGameButton.style.display = 'none';
        drawCardButton.style.display = '';
        drawCardButton.disabled = !(activePlayers.size > 0 && allActivePlayersMadeChoices(true));
    }
}


function updateDebugNextCardDisplay() {
    const debugNextCardDiv = document.getElementById('debugNextCard');
    const toggleCheckbox = document.getElementById('toggleDebugNextCard');
    if (!debugNextCardDiv || !toggleCheckbox) return;
    
    const isChecked = toggleCheckbox.checked;
    const theme = document.body.dataset.theme || 'neon';
    let defaultTextColor = 'var(--ncc-text)';
    if (theme === 'light') defaultTextColor = 'black';
    else if (theme === 'dark-standard' || theme === 'neon' || theme === 'casino-green') defaultTextColor = 'white';

    if (!isChecked) {
        debugNextCardDiv.textContent = 'Next Card: (Hidden)';
        debugNextCardDiv.style.color = defaultTextColor;
        return;
    }

    if (deck && deck.length > 0) {
        const nextCard = deck[deck.length - 1];
        debugNextCardDiv.textContent = `Next Card: ${nextCard.value}${nextCard.suit}`;
        debugNextCardDiv.style.color = [SUIT_HEARTS, SUIT_DIAMONDS].includes(nextCard.suit) ? 'red' : defaultTextColor;
    } else {
        debugNextCardDiv.textContent = 'Next Card: (Deck Empty)';
        debugNextCardDiv.style.color = defaultTextColor;
    }
}

// This DOMContentLoaded is for classic-mode specific initializations and event listeners
// that are tied to the game view elements.
let classicModeInitialized = false;

function initializeClassicModeView() {
    if (classicModeInitialized) return;

    console.log("Initializing Classic Mode View specific listeners and elements...");

    const newGameBtn = document.getElementById('newGameButton');
    if (newGameBtn) newGameBtn.onclick = startNewGame; // startNewGame is classic mode specific

    const resetBtn = document.getElementById('resetPlayersButton');
    if (resetBtn) resetBtn.onclick = resetPlayers; // resetPlayers is classic specific

    const themeSelectorElement = document.getElementById('themeSelector');
    if (themeSelectorElement) {
        // loadTheme(); // loadTheme is called by main.js when view becomes active
        themeSelectorElement.onchange = (event) => applyTheme(event.target.value);
    }

    const drawCardBtn = document.getElementById('drawCardButton');
    if (drawCardBtn) drawCardBtn.onclick = drawCard; // drawCard is classic specific

    const nameInput = document.getElementById('newPlayerNameInput');
    const chipsInput = document.getElementById('newPlayerChipsInput');
    const actionButton = document.getElementById('newAddPlayerButton');
    const dataList = document.getElementById('playerDatalist');
    const addPlayerForm = document.querySelector('.add-player-form'); // Used for onsubmit in HTML

    if (nameInput && chipsInput && actionButton && dataList && addPlayerForm) {
        nameInput.addEventListener('input', () => {
            const enteredName = nameInput.value.trim();
            if (players[enteredName]) {
                chipsInput.placeholder = 'Loaning Chips';
                actionButton.textContent = '$ Apply for Financial Assistance';
            } else {
                chipsInput.placeholder = 'Starting Chips';
                actionButton.textContent = '+ Add Player';
            }
        });
    }
  
    const toggleDebugCheckbox = document.getElementById('toggleDebugNextCard');
    if (toggleDebugCheckbox) {
        toggleDebugCheckbox.onchange = updateDebugNextCardDisplay;
    }
    
    // Ensure updateDatalist is available globally or explicitly passed if classic-mode becomes a module.
    // Hook into saveGameState to update datalist.
    const originalSaveGameState = window.saveGameState; // Assumes saveGameState is global
    window.saveGameState = function() {
        if (typeof originalSaveGameState === 'function') {
            originalSaveGameState.apply(this, arguments);
        }
        if (typeof updateDatalist === 'function') {
            updateDatalist(); 
        }
    };
    classicModeInitialized = true;
}

// `updateDatalist` needs to be defined for the `saveGameState` override and `main.js` to call.
function updateDatalist() {
    const dataList = document.getElementById('playerDatalist');
    if (!dataList) return;
    dataList.innerHTML = '';
    if (players && Object.keys(players).length > 0) {
        Object.keys(players).forEach(playerName => {
            const option = document.createElement('option');
            option.value = playerName;
            dataList.appendChild(option);
        });
    }
}

function prepareClassicModeForExit() {
    console.log("Preparing Classic Mode for exit. Resetting players and game state.");
    // This effectively resets the classic game state.
    players = [];
    drawnCards = [];
    currentDeck = [];
    currentRound = 1;
    gamePhase = PHASE_BETTING;
    gameInProgress = false;
}

// The old `DOMContentLoaded` is replaced by `initializeClassicModeView` which is called by `main.js`
// when the classic mode view is shown.