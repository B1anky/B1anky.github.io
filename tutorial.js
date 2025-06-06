const tutorialSteps = [
    {
        title: "Welcome to Ride the Bus!",
        text: "This is a simple card guessing game with five rounds. The goal is to make a correct guess for all five rounds to 'Ride the Bus' and win!"
    },
    {
        title: "Round 1: Red or Black",
        text: "The first and simplest round. All you have to do is guess if the next card drawn from the deck will be a Red suit (Hearts, Diamonds) or a Black suit (Clubs, Spades)."
    },
    {
        title: "Round 2: Higher or Lower",
        text: "For the second card, you must guess if its value will be HIGHER or LOWER than the first card you drew. (Aces are high!)"
    },
    {
        title: "Round 3: Inside or Outside",
        text: "Looking at your first two cards, you must guess if the value of the third card will fall INSIDE or OUTSIDE the range of the first two. For example, if you have a 2 and a 9, a 5 would be 'Inside', while a Jack would be 'Outside'."
    },
    {
        title: "Round 4: Guess the Suit",
        text: "For the fourth card, you must correctly guess its suit: Spades, Hearts, Diamonds, or Clubs. You have a 1 in 4 chance!"
    },
    {
        title: "Round 5: Guess the Value",
        text: "The final and hardest round. You must guess the exact value of the fifth card, from 2 through Ace. Good luck!"
    },
    {
        title: "Campaign Mode",
        text: "In Campaign Mode, you don't just play one game. You must meet an increasing 'Target Quota' of chips within a limited number of 'Attempts'. Each attempt is a full 'Ride the Bus' sequence."
    },
    {
        title: "Good Luck!",
        text: "That's everything you need to know. You can close this tutorial and select a game mode from the Main Menu. Have fun!"
    }
];

let currentStep = 0;

function startTutorial() {
    currentStep = 0;
    document.getElementById('tutorialModal').style.display = 'flex';
    updateTutorialView();
}

function closeTutorial() {
    document.getElementById('tutorialModal').style.display = 'none';
}

function nextStep() {
    if (currentStep < tutorialSteps.length - 1) {
        currentStep++;
        updateTutorialView();
    }
}

function prevStep() {
    if (currentStep > 0) {
        currentStep--;
        updateTutorialView();
    }
}

function updateTutorialView() {
    const step = tutorialSteps[currentStep];
    document.getElementById('tutorialTitle').textContent = step.title;
    document.getElementById('tutorialText').textContent = step.text;
    document.getElementById('tutorialStepCounter').textContent = `${currentStep + 1} / ${tutorialSteps.length}`;

    const prevButton = document.getElementById('tutorialPrevButton');
    const nextButton = document.getElementById('tutorialNextButton');

    prevButton.disabled = currentStep === 0;
    
    // The Next button is never disabled, it just changes text and function.
    nextButton.disabled = false;
    
    // Change "Next" to "Finish" on the last step.
    // The actual click logic is now handled by a single listener in main.js
    if (currentStep === tutorialSteps.length - 1) {
        nextButton.textContent = 'Finish';
    } else {
        nextButton.textContent = 'Next';
    }
} 