console.log("shop.js loaded");

// --- DOM Elements ---
const shopModal = document.getElementById('shopModal');
const shopContinueButton = document.getElementById('shopContinueButton');
const shopCurrentProfit = document.getElementById('shopCurrentProfit');
const shopItemsMoneyContainer = document.getElementById('shop-items-money');
const shopItemsMultsContainer = document.getElementById('shop-items-mults');
const tabButtons = document.querySelectorAll('.shop-tab-button');
const tabContents = document.querySelectorAll('.shop-tab-content');

// Investment Panel Elements
const investmentControls = document.getElementById('shopInvestmentControls');
const investmentItemTitle = document.getElementById('investmentItemTitle');
const investmentItemDesc = document.getElementById('investmentItemDesc');
const investmentAmountInput = document.getElementById('shopInvestmentAmountInput');
const investmentSlider = document.getElementById('shopInvestmentSlider');
const confirmInvestmentButton = document.getElementById('confirmInvestmentButton');

// --- State ---
let selectedShopItem = null;

// --- Shop Item Definitions ---
const SHOP_ITEMS = [
    {
        id: 'startingChips',
        type: 'money',
        title: 'Snowball',
        description: 'Increase your starting chips for each quota.',
        costText: 'Every $100 spent adds $1 to your start.',
        costPerUnit: 100,
        getBonus: () => campaignState.upgrades.startingChipsBonus,
        getBonusText: (bonus) => `Current Bonus: +$${bonus}`,
        applyUpgrade: (amountSpent) => {
            const bonusGained = amountSpent / 100;
            campaignState.upgrades.startingChipsBonus += bonusGained;
            return `Increased starting chips by $${bonusGained}.`;
        }
    },
    ...[1, 2, 3, 4, 5].map(roundNum => ({
        id: `multiplier_${roundNum}`,
        type: 'mult',
        title: `Round ${roundNum}`,
        description: `Increase the Round ${roundNum} payout multiplier.`,
        costText: 'Every $200 spent adds 0.1x to the multiplier.',
        costPerUnit: 200,
        getBonus: () => campaignState.upgrades.multiplierBonuses[roundNum - 1],
        getBonusText: (bonus) => `+${bonus.toFixed(1)}x`,
        applyUpgrade: (amountSpent) => {
            const bonusGained = (amountSpent / 200) * 0.1;
            campaignState.upgrades.multiplierBonuses[roundNum - 1] += bonusGained;
            return `Increased Round ${roundNum} multiplier by ${bonusGained.toFixed(1)}x.`;
        }
    }))
];

// --- Core Functions ---

function showShop() {
    selectedShopItem = null;
    investmentControls.classList.add('hidden');
    updateProfitDisplay();
    populateShopTabs();
    
    // Set default tab
    switchTab('money');

    shopModal.style.display = 'flex';
}

function hideShop() {
    shopModal.style.display = 'none';
}

function populateShopTabs() {
    shopItemsMoneyContainer.innerHTML = '';
    shopItemsMultsContainer.innerHTML = '';

    SHOP_ITEMS.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'shop-item';
        itemDiv.dataset.itemId = item.id;

        if (item.type === 'money') {
            itemDiv.innerHTML = `
                <div class="shop-item-info">
                    <h3>${item.title}</h3>
                    <p>${item.description}</p>
                </div>
                <div class="shop-item-bonus" id="bonus-display-${item.id}">
                    ${item.getBonusText(item.getBonus())}
                </div>`;
            shopItemsMoneyContainer.appendChild(itemDiv);
        } else if (item.type === 'mult') {
            itemDiv.classList.add('compact');
            itemDiv.innerHTML = `
                <h3>${item.title}</h3>
                <div class="shop-item-bonus" id="bonus-display-${item.id}">
                    ${item.getBonusText(item.getBonus())}
                </div>`;
            shopItemsMultsContainer.appendChild(itemDiv);
        }
        
        itemDiv.addEventListener('click', () => selectItem(item));
    });
}

function selectItem(item) {
    selectedShopItem = item;

    document.querySelectorAll('.shop-item').forEach(div => {
        div.classList.toggle('selected', div.dataset.itemId === item.id);
    });
    
    investmentItemTitle.textContent = item.title;
    investmentItemDesc.textContent = item.costText;
    
    investmentAmountInput.value = '';
    investmentAmountInput.max = campaignState.profit;
    investmentAmountInput.step = item.costPerUnit;

    investmentSlider.max = campaignState.profit;
    investmentSlider.step = item.costPerUnit;
    investmentSlider.value = 0;
    
    investmentControls.classList.remove('hidden');
}

function handleInvestment() {
    if (!selectedShopItem) {
        showGameNotification("Please select an item to upgrade.", "warning");
        return;
    }

    const amountToSpend = parseInt(investmentAmountInput.value, 10);
    const costPerUnit = selectedShopItem.costPerUnit;

    if (isNaN(amountToSpend) || amountToSpend <= 0) {
        showGameNotification("Please enter a valid amount.", "error");
        return;
    }

    if (amountToSpend > campaignState.profit) {
        showGameNotification("You don't have enough profit.", "error");
        return;
    }
    
    if (amountToSpend % costPerUnit !== 0) {
        showGameNotification(`Amount must be in multiples of $${costPerUnit}.`, "warning");
        return;
    }

    campaignState.profit -= amountToSpend;
    const successMessage = selectedShopItem.applyUpgrade(amountToSpend);
    showGameNotification(`Success! ${successMessage}`, "success");

    updateProfitDisplay();
    updateBonusDisplay(selectedShopItem);
    
    investmentAmountInput.value = '';
    investmentSlider.value = 0;
    updateSliderAndInputMax();
}

function switchTab(tabId) {
    tabContents.forEach(content => {
        content.classList.toggle('active', content.id === `shop-tab-${tabId}`);
    });
    tabButtons.forEach(button => {
        button.classList.toggle('active', button.dataset.tab === tabId);
    });
    // Reset selection when switching tabs
    selectedShopItem = null;
    investmentControls.classList.add('hidden');
    document.querySelectorAll('.shop-item').forEach(div => div.classList.remove('selected'));
}

// --- UI Update Helpers ---

function updateProfitDisplay() {
    shopCurrentProfit.textContent = `Available Profit: $${campaignState.profit}`;
}

function updateBonusDisplay(item) {
    const bonusEl = document.getElementById(`bonus-display-${item.id}`);
    if (bonusEl) {
        bonusEl.textContent = item.getBonusText(item.getBonus());
    }
}

function updateSliderAndInputMax() {
    investmentAmountInput.max = campaignState.profit;
    investmentSlider.max = campaignState.profit;
}

// --- Event Listeners ---

tabButtons.forEach(button => {
    button.addEventListener('click', () => switchTab(button.dataset.tab));
});

investmentSlider.addEventListener('input', () => {
    investmentAmountInput.value = investmentSlider.value;
});

investmentAmountInput.addEventListener('input', () => {
    const value = Math.min(parseInt(investmentAmountInput.value, 10) || 0, campaignState.profit);
    investmentAmountInput.value = value;
    investmentSlider.value = value;
});

confirmInvestmentButton.addEventListener('click', handleInvestment);

shopContinueButton.addEventListener('click', () => {
    hideShop();
    startNextCampaignRound(); 
}); 