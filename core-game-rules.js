// Core Game Constants & Pure Logic

// Game State Phases (used by multiple modes)
const PHASE_BETTING = 'betting';
const PHASE_PLAYING = 'playing';
const PHASE_GAME_OVER = 'gameOver';

// Player Choices (fundamental to game rules)
const CHOICE_RED = 'red';
const CHOICE_BLACK = 'black';
const CHOICE_HIGHER = 'higher';
const CHOICE_LOWER = 'lower';
const CHOICE_INSIDE = 'inside';
const CHOICE_OUTSIDE = 'outside';

// Card Suits (fundamental)
const SUIT_SPADES = '♠';
const SUIT_HEARTS = '♥';
const SUIT_DIAMONDS = '♦';
const SUIT_CLUBS = '♣';

// Card Values (fundamental for evaluation)
const CARD_VALUES_WITH_ACE_HIGH = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// Base Round Multipliers (can be overridden or modified by specific game modes)
const BASE_ROUND_MULTIPLIERS = {
    1: 2, 
    2: 3, 
    3: 4, 
    4: 20,
    5: 50 
};

/**
 * Converts card face values (J, Q, K, A) to numerical values for comparison.
 * @param {string} value - The face value of the card (e.g., 'A', 'K', '10').
 * @returns {number} The numerical value of the card.
 */
function getCardValue(value) {
  const values = {
    'A': 14,
    'K': 13,
    'Q': 12,
    'J': 11
  };
  return values[value] || parseInt(value);
}

/**
 * Creates and shuffles a standard 52-card deck.
 * @returns {Array<Object>} A new, shuffled deck of cards.
 */
function createInitialDeck() {
    const suits = [SUIT_SPADES, SUIT_HEARTS, SUIT_DIAMONDS, SUIT_CLUBS];
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    let newDeck = [];
    for (let suit of suits) {
        for (let value of values) {
            newDeck.push({ suit, value });
        }
    }
    // Shuffle the deck (Fisher-Yates shuffle)
    for (let i = newDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
    }
    return newDeck;
}

// Round evaluation functions - these are pure logic based on game rules

function evaluateRound1Win(choice, cardSuit) {
    const isRed = [SUIT_HEARTS, SUIT_DIAMONDS].includes(cardSuit);
    return !((choice === CHOICE_RED && !isRed) || (choice === CHOICE_BLACK && isRed));
}

function evaluateRound2Win(choice, currentCardValue, previousCardValue) {
    if (choice === CHOICE_HIGHER) return currentCardValue >= previousCardValue;
    if (choice === CHOICE_LOWER) return currentCardValue < previousCardValue;
    return false; // Should not happen
}

function evaluateRound3Win(choice, currentCardValue, firstCardValue, secondCardValue) {
    const minVal = Math.min(firstCardValue, secondCardValue);
    const maxVal = Math.max(firstCardValue, secondCardValue);

    if (choice === CHOICE_INSIDE) {
        return currentCardValue >= minVal && currentCardValue <= maxVal;
    }
    if (choice === CHOICE_OUTSIDE) {
        return currentCardValue < minVal || currentCardValue > maxVal;
    }
    return false; // Should not happen
}

function evaluateRound4Win(choice, cardSuit) {
    return choice === cardSuit;
}

function evaluateRound5Win(choice, cardValue) { // Value is 'A', 'K', '2' etc.
    return choice === cardValue;
} 