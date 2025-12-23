// ZenBudget Finance Tracker - State Management & Data Persistence

// Application State
let transactions = [];
let filteredTransactions = [];
let db;

// DOM Elements
const transactionForm = document.getElementById('transaction-form');
const transactionNameInput = document.getElementById('name');
const transactionAmountInput = document.getElementById('amount');
const transactionCategoryInput = document.getElementById('category');
const transactionsList = document.getElementById('transactions-list');
const totalBalanceElement = document.getElementById('total-balance');
const totalIncomeElement = document.getElementById('total-income');
const totalExpenseElement = document.getElementById('total-expense');
const searchInput = document.getElementById('search-transactions');
const clearAllButton = document.getElementById('clear-all-btn');
const confirmationModal = document.getElementById('confirmation-modal');
const closeModalButton = document.getElementById('close-modal');
const cancelClearButton = document.getElementById('cancel-clear');
const confirmClearButton = document.getElementById('confirm-clear');
const categoryBarsContainer = document.getElementById('category-bars');
const emptyListText = document.getElementById('empty-list-text');
const emptySummaryText = document.getElementById('empty-summary-text');

// PWA DOM Elements
const installPrompt = document.getElementById('install-prompt');
const installButton = document.getElementById('install-button');
const offlineIndicator = document.getElementById('offline-indicator');

// IndexedDB Configuration
const DB_NAME = 'ZenBudgetDB';
const DB_VERSION = 1;
const STORE_NAME = 'transactions';

// Initialize the application
async function init() {
    // Initialize IndexedDB
    await initIndexedDB();
    
    // Load transactions from IndexedDB
    await loadTransactions();
    
    // Render initial data
    renderTransactions();
    updateBalance();
    updateSpendingSummary();
    
    // Set current year in footer
    document.getElementById('current-year').textContent = new Date().getFullYear();
    
    // Set up event listeners
    setupEventListeners();
    
    // Initialize PWA features
    initPWA();
}

// Initialize IndexedDB
function initIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = (event) => {
            console.error('IndexedDB error:', event.target.error);
            reject(event.target.error);
        };
        
        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('IndexedDB initialized successfully');
            resolve();
        };
        
        request.onupgradeneeded = (event) => {
            db = event.target.result;
            
            // Create object store if it doesn't exist
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                
                // Create indexes for efficient querying
                store.createIndex('date', 'date', { unique: false });
                store.createIndex('category', 'category', { unique: false });
                store.createIndex('type', 'type', { unique: false });
                store.createIndex('amount', 'amount', { unique: false });
                
                console.log('Object store created:', STORE_NAME);
            }
        };
    });
}

// Load transactions from IndexedDB
async function loadTransactions() {
    return new Promise((resolve, reject) => {
        if (!db) {
            console.error('IndexedDB not initialized');
            transactions = [];
            filteredTransactions = [];
            resolve();
            return;
        }
        
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        
        request.onsuccess = (event) => {
            transactions = event.target.result;
            // Sort by date (newest first)
            transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
            filteredTransactions = [...transactions];
            console.log(`Loaded ${transactions.length} transactions from IndexedDB`);
            resolve();
        };
        
        request.onerror = (event) => {
            console.error('Error loading transactions from IndexedDB:', event.target.error);
            transactions = [];
            filteredTransactions = [];
            reject(event.target.error);
        };
    });
}

// Save a transaction to IndexedDB
async function saveTransaction(transaction) {
    return new Promise((resolve, reject) => {
        if (!db) {
            console.error('IndexedDB not initialized');
            reject('IndexedDB not initialized');
            return;
        }
        
        const dbTransaction = db.transaction(STORE_NAME, 'readwrite');
        const store = dbTransaction.objectStore(STORE_NAME);
        const request = store.put(transaction);
        
        request.onsuccess = () => {
            console.log('Transaction saved to IndexedDB:', transaction.id);
            resolve();
        };
        
        request.onerror = (event) => {
            console.error('Error saving transaction to IndexedDB:', event.target.error);
            reject(event.target.error);
        };
    });
}

// Delete a transaction from IndexedDB
async function deleteTransaction(id) {
    return new Promise((resolve, reject) => {
        if (!db) {
            console.error('IndexedDB not initialized');
            reject('IndexedDB not initialized');
            return;
        }
        
        const dbTransaction = db.transaction(STORE_NAME, 'readwrite');
        const store = dbTransaction.objectStore(STORE_NAME);
        const request = store.delete(id);
        
        request.onsuccess = () => {
            console.log('Transaction deleted from IndexedDB:', id);
            resolve();
        };
        
        request.onerror = (event) => {
            console.error('Error deleting transaction from IndexedDB:', event.target.error);
            reject(event.target.error);
        };
    });
}

// Clear all transactions from IndexedDB
async function clearAllTransactionsFromDB() {
    return new Promise((resolve, reject) => {
        if (!db) {
            console.error('IndexedDB not initialized');
            reject('IndexedDB not initialized');
            return;
        }
        
        const dbTransaction = db.transaction(STORE_NAME, 'readwrite');
        const store = dbTransaction.objectStore(STORE_NAME);
        const request = store.clear();
        
        request.onsuccess = () => {
            console.log('All transactions cleared from IndexedDB');
            resolve();
        };
        
        request.onerror = (event) => {
            console.error('Error clearing transactions from IndexedDB:', event.target.error);
            reject(event.target.error);
        };
    });
}

// Setup all event listeners
function setupEventListeners() {
    // Form submission
    transactionForm.addEventListener('submit', addTransaction);
    
    // Search functionality
    searchInput.addEventListener('input', filterTransactions);
    
    // Clear all button
    clearAllButton.addEventListener('click', () => {
        confirmationModal.classList.add('active');
    });
    
    // Modal controls
    closeModalButton.addEventListener('click', closeModal);
    cancelClearButton.addEventListener('click', closeModal);
    
    // Confirm clear all
    confirmClearButton.addEventListener('click', clearAllTransactions);
    
    // Close modal when clicking outside
    confirmationModal.addEventListener('click', (e) => {
        if (e.target === confirmationModal) {
            closeModal();
        }
    });
}

// Close confirmation modal
function closeModal() {
    confirmationModal.classList.remove('active');
}

// Add a new transaction
async function addTransaction(e) {
    e.preventDefault();
    
    const name = transactionNameInput.value.trim();
    const amount = parseFloat(transactionAmountInput.value);
    const category = transactionCategoryInput.value;
    
    // Validate inputs
    if (!name || isNaN(amount) || !category) {
        alert('Please fill in all fields correctly.');
        return;
    }
    
    // Create transaction object
    const transaction = {
        id: Date.now() + Math.random(), // More unique ID
        name,
        amount,
        category,
        date: new Date().toISOString(),
        type: amount >= 0 ? 'income' : 'expense'
    };
    
    try {
        // Save to IndexedDB
        await saveTransaction(transaction);
        
        // Add to transactions array (at beginning for newest first)
        transactions.unshift(transaction);
        filteredTransactions = [...transactions];
        
        // Update UI
        renderTransactions();
        updateBalance();
        updateSpendingSummary();
        
        // Reset form
        transactionForm.reset();
        
        // Show visual feedback
        transactionNameInput.focus();
        
        // Show success notification
        showNotification('Transaction added successfully!', 'success');
        
    } catch (error) {
        console.error('Error adding transaction:', error);
        showNotification('Error saving transaction. Please try again.', 'error');
    }
}

// Filter transactions based on search input
function filterTransactions() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    if (!searchTerm) {
        filteredTransactions = [...transactions];
    } else {
        filteredTransactions = transactions.filter(transaction => 
            transaction.name.toLowerCase().includes(searchTerm) ||
            transaction.category.toLowerCase().includes(searchTerm) ||
            transaction.type.toLowerCase().includes(searchTerm)
        );
    }
    
    renderTransactions();
}

// Render transactions list
function renderTransactions() {
    // Clear the list
    transactionsList.innerHTML = '';
    
    if (filteredTransactions.length === 0) {
        emptyListText.style.display = 'block';
        transactionsList.appendChild(emptyListText);
        return;
    }
    
    emptyListText.style.display = 'none';
    
    // Create transaction items
    filteredTransactions.forEach(transaction => {
        const transactionElement = createTransactionElement(transaction);
        
        // Add delete button to each transaction
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-transaction';
        deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
        deleteButton.addEventListener('click', async () => {
            if (confirm('Are you sure you want to delete this transaction?')) {
                try {
                    await deleteTransaction(transaction.id);
                    
                    // Remove from arrays
                    transactions = transactions.filter(t => t.id !== transaction.id);
                    filteredTransactions = filteredTransactions.filter(t => t.id !== transaction.id);
                    
                    // Update UI
                    renderTransactions();
                    updateBalance();
                    updateSpendingSummary();
                    
                    showNotification('Transaction deleted successfully!', 'success');
                } catch (error) {
                    console.error('Error deleting transaction:', error);
                    showNotification('Error deleting transaction. Please try again.', 'error');
                }
            }
        });
        
        transactionElement.appendChild(deleteButton);
        transactionsList.appendChild(transactionElement);
    });
}

// Create a transaction element
function createTransactionElement(transaction) {
    const transactionElement = document.createElement('div');
    transactionElement.className = `transaction-item ${transaction.type}`;
    transactionElement.dataset.id = transaction.id;
    
    // Format date
    const date = new Date(transaction.date);
    const formattedDate = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    // Format amount with proper color
    const formattedAmount = formatCurrency(Math.abs(transaction.amount));
    const amountClass = transaction.type === 'income' ? 'income' : 'expense';
    const amountSign = transaction.type === 'income' ? '+' : '-';
    
    transactionElement.innerHTML = `
        <div class="transaction-info">
            <div class="transaction-name">${transaction.name}</div>
            <div class="transaction-category">
                <i class="fas fa-tag"></i> ${transaction.category}
            </div>
            <div class="transaction-date">${formattedDate}</div>
        </div>
        <div class="transaction-amount ${amountClass}">
            ${amountSign}${formattedAmount}
        </div>
    `;
    
    return transactionElement;
}

// Update balance and totals
function updateBalance() {
    // Calculate totals using reduce()
    const totals = transactions.reduce((acc, transaction) => {
        if (transaction.type === 'income') {
            acc.income += transaction.amount;
        } else {
            acc.expense += Math.abs(transaction.amount);
        }
        return acc;
    }, { income: 0, expense: 0 });
    
    const totalBalance = totals.income - totals.expense;
    
    // Update DOM elements
    totalBalanceElement.textContent = formatCurrency(totalBalance);
    totalIncomeElement.textContent = formatCurrency(totals.income);
    totalExpenseElement.textContent = formatCurrency(totals.expense);
    
    // Add color class to balance based on value
    totalBalanceElement.className = 'balance-amount';
    if (totalBalance > 0) {
        totalBalanceElement.classList.add('positive');
    } else if (totalBalance < 0) {
        totalBalanceElement.classList.add('negative');
    }
}

// Update spending summary with progress bars
function updateSpendingSummary() {
    // Clear the summary
    categoryBarsContainer.innerHTML = '';
    
    // Get expense transactions only
    const expenseTransactions = transactions.filter(t => t.type === 'expense');
    
    if (expenseTransactions.length === 0) {
        emptySummaryText.style.display = 'block';
        categoryBarsContainer.appendChild(emptySummaryText);
        return;
    }
    
    emptySummaryText.style.display = 'none';
    
    // Calculate total expenses
    const totalExpenses = expenseTransactions.reduce((sum, transaction) => {
        return sum + Math.abs(transaction.amount);
    }, 0);
    
    // Group expenses by category
    const categories = {};
    expenseTransactions.forEach(transaction => {
        const category = transaction.category;
        const amount = Math.abs(transaction.amount);
        
        if (!categories[category]) {
            categories[category] = 0;
        }
        
        categories[category] += amount;
    });
    
    // Create progress bars for each category
    Object.entries(categories).forEach(([category, amount]) => {
        const percentage = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0;
        
        const categoryElement = document.createElement('div');
        categoryElement.className = 'category-item';
        
        // Assign color based on category
        const color = getCategoryColor(category);
        
        categoryElement.innerHTML = `
            <div class="category-header">
                <div class="category-name">
                    <i class="fas fa-${getCategoryIcon(category)}"></i>
                    ${category}
                </div>
                <div class="category-amount">${formatCurrency(amount)}</div>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${percentage}%; background: ${color};"></div>
                <span class="category-percentage">${percentage.toFixed(1)}%</span>
            </div>
        `;
        
        categoryBarsContainer.appendChild(categoryElement);
    });
}

// Get color for a category
function getCategoryColor(category) {
    const colors = {
        'Food': '#10b981',
        'Rent': '#6366f1',
        'Fun': '#8b5cf6',
        'Income': '#06b6d4',
        'Other': '#f59e0b'
    };
    
    return colors[category] || '#94a3b8';
}

// Get icon for a category
function getCategoryIcon(category) {
    const icons = {
        'Food': 'utensils',
        'Rent': 'home',
        'Fun': 'gamepad',
        'Income': 'money-bill-wave',
        'Other': 'shopping-bag'
    };
    
    return icons[category] || 'tag';
}

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
    }).format(amount);
}

// Clear all transactions
async function clearAllTransactions() {
    try {
        // Clear from IndexedDB
        await clearAllTransactionsFromDB();
        
        // Clear transactions array
        transactions = [];
        filteredTransactions = [];
        
        // Update UI
        renderTransactions();
        updateBalance();
        updateSpendingSummary();
        
        // Close modal
        closeModal();
        
        // Show confirmation message
        showNotification('All transactions have been cleared.', 'success');
    } catch (error) {
        console.error('Error clearing transactions:', error);
        showNotification('Error clearing transactions. Please try again.', 'error');
    }
}

// =============== PWA Functions ===============

// PWA Initialization
function initPWA() {
    // Register Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then((registration) => {
                    console.log('Service Worker registered with scope:', registration.scope);
                    
                    // Check for updates
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        console.log('New Service Worker found:', newWorker);
                    });
                })
                .catch((error) => {
                    console.error('Service Worker registration failed:', error);
                });
        });
    }
    
    // Install prompt
    let deferredPrompt;
    
    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent Chrome 67 and earlier from automatically showing the prompt
        e.preventDefault();
        // Stash the event so it can be triggered later
        deferredPrompt = e;
        
        // Show install button
        if (installPrompt) {
            installPrompt.style.display = 'block';
            
            installButton.addEventListener('click', () => {
                // Hide our install button
                installPrompt.style.display = 'none';
                
                // Show the install prompt
                deferredPrompt.prompt();
                
                // Wait for the user to respond to the prompt
                deferredPrompt.userChoice.then((choiceResult) => {
                    if (choiceResult.outcome === 'accepted') {
                        console.log('User accepted the install prompt');
                        showNotification('ZenBudget installed successfully!', 'success');
                    } else {
                        console.log('User dismissed the install prompt');
                    }
                    deferredPrompt = null;
                });
            });
        }
    });
    
    // Listen for app installed event
    window.addEventListener('appinstalled', (event) => {
        console.log('App was installed');
        if (installPrompt) {
            installPrompt.style.display = 'none';
        }
    });
    
    // Online/Offline detection
    window.addEventListener('online', () => {
        console.log('App is online');
        if (offlineIndicator) {
            offlineIndicator.style.display = 'none';
        }
        showNotification('You are back online!', 'success');
    });
    
    window.addEventListener('offline', () => {
        console.log('App is offline');
        if (offlineIndicator) {
            offlineIndicator.style.display = 'inline-flex';
        }
        showNotification('You are offline. Changes will sync when back online.', 'warning');
    });
    
    // Check initial network status
    if (!navigator.onLine && offlineIndicator) {
        offlineIndicator.style.display = 'inline-flex';
    }
    
    // Check for PWA display mode
    if (window.matchMedia('(display-mode: standalone)').matches) {
        console.log('Running in standalone mode');
    }
}

// Enhanced showNotification function with PWA support
function showNotification(message, type = 'info') {
    // If we have Notification API permission and app is in background
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
        const notification = new Notification('ZenBudget', {
            body: message,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-96x96.png'
        });
        
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
    }
    
    // Also show in-app notification
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Set colors based on notification type
    let backgroundColor;
    switch(type) {
        case 'success':
            backgroundColor = '#10b981';
            break;
        case 'warning':
            backgroundColor = '#f59e0b';
            break;
        case 'error':
            backgroundColor = '#ef4444';
            break;
        default:
            backgroundColor = 'var(--glass-bg)';
    }
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${backgroundColor};
        backdrop-filter: blur(10px);
        border: 1px solid var(--glass-border);
        padding: 15px 25px;
        border-radius: var(--radius-md);
        box-shadow: var(--glass-shadow);
        z-index: 1001;
        transform: translateX(150%);
        transition: transform 0.3s ease;
        color: white;
        max-width: 300px;
        word-wrap: break-word;
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 10);
    
    // Animate out and remove after 3 seconds
    setTimeout(() => {
        notification.style.transform = 'translateX(150%)';
        setTimeout(() => {
            if (notification.parentNode) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Request notification permission (call this from a user action, like a button)
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
            if (permission === 'granted') {
                showNotification('Notifications enabled!', 'success');
            }
        });
    }
}

// Stress test: Add sample data
async function addSampleData() {
    // Only add if no transactions exist
    if (transactions.length > 0) return;
    
    const sampleTransactions = [
        { name: 'Salary', amount: 3500, category: 'Income', date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() },
        { name: 'Rent', amount: -1200, category: 'Rent', date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString() },
        { name: 'Groceries', amount: -150, category: 'Food', date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
        { name: 'Concert Tickets', amount: -85, category: 'Fun', date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString() },
        { name: 'Freelance Work', amount: 800, category: 'Income', date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
        { name: 'Restaurant', amount: -65, category: 'Food', date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
        { name: 'Netflix Subscription', amount: -15.99, category: 'Fun', date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
        { name: 'Coffee Shop', amount: -12.5, category: 'Food', date: new Date().toISOString() }
    ];
    
    try {
        // Save each transaction to IndexedDB
        for (const transaction of sampleTransactions) {
            const fullTransaction = {
                ...transaction,
                id: Date.now() + Math.random(),
                type: transaction.amount >= 0 ? 'income' : 'expense'
            };
            
            await saveTransaction(fullTransaction);
            transactions.push(fullTransaction);
        }
        
        filteredTransactions = [...transactions];
        
        renderTransactions();
        updateBalance();
        updateSpendingSummary();
        
        showNotification('Sample data loaded. Try the search and clear features!', 'success');
    } catch (error) {
        console.error('Error adding sample data:', error);
        showNotification('Error loading sample data.', 'error');
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    init();
    
    // Add sample data for stress testing (uncomment to enable)
    // setTimeout(addSampleData, 1000);
});
