/* ==========================================================================
   LEXPROP FINANZAS - APPLICATION LOGIC
   ========================================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, setDoc, deleteDoc, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCF9BugrARzleEALJc00c8S2RXT0xMIMN4",
  authDomain: "control-finanzas-7c5f5.firebaseapp.com",
  projectId: "control-finanzas-7c5f5",
  storageBucket: "control-finanzas-7c5f5.firebasestorage.app",
  messagingSenderId: "910316992640",
  appId: "1:910316992640:web:ae296ea26ecf33a2030e65"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// State Variables
let currentUser = null;
let currentProfile = 'empresa'; // 'empresa' or 'personal'
let unsubscribeTransactions = null;
let sortField = 'date';
let sortDirection = 'desc';

// --- 1. CONFIGURATION & DOM REFERENCES ---
const CATEGORIES = {
    income: [
        { value: 'brokerage-sale', label: 'Comisión por Venta', group: 'Corretaje' },
        { value: 'brokerage-rental', label: 'Comisión por Arriendo', group: 'Corretaje' },
        { value: 'brokerage-administration', label: 'Administración de Propiedades', group: 'Corretaje' },
        { value: 'judicial-litigation', label: 'Honorarios de Litigio', group: 'Judicial' },
        { value: 'judicial-consultancy', label: 'Asesoría / Consultoría', group: 'Judicial' },
        { value: 'judicial-notary', label: 'Trámites Notariales', group: 'Judicial' }
    ],
    expense: [
        { value: 'expense-rent', label: 'Arriendo de Oficina', group: 'Oficina' },
        { value: 'expense-luz', label: 'Servicio de Luz', group: 'Oficina' },
        { value: 'expense-agua', label: 'Servicio de Agua', group: 'Oficina' },
        { value: 'expense-internet', label: 'Internet & Telecomunicaciones', group: 'Oficina' },
        { value: 'expense-supplies', label: 'Suministros e Imprenta', group: 'Oficina' },
        { value: 'expense-marketing', label: 'Publicidad & Marketing', group: 'Oficina' },
        { value: 'expense-salaries', label: 'Sueldos & Honorarios', group: 'Oficina' },
        { value: 'expense-taxes', label: 'Impuestos', group: 'Oficina' },
        { value: 'expense-other', label: 'Otros Gastos', group: 'Oficina' }
    ]
};

// State
let transactions = [];
let charts = {};
let currentAttachment = null; // Local state for file uploads
let lastExportedData = null; // Stores last export content for sharing

// DOM Elements
const elements = {
    // Nav & Views
    navBtns: document.querySelectorAll('.nav-btn, .mobile-nav-btn[data-view]'),
    views: document.querySelectorAll('.app-view'),
    currentTitle: document.getElementById('page-current-title'),
    currentSubtitle: document.getElementById('header-current-subtitle'),
    currentDateText: document.getElementById('current-date-text'),
    
    // Dashboard Filter
    dashboardPeriodSelect: document.getElementById('dashboard-period-select'),
    
    // Dashboard metric values
    valNetBalance: document.getElementById('val-net-balance'),
    valIncomeJudicial: document.getElementById('val-income-judicial'),
    valIncomeBrokerage: document.getElementById('val-income-brokerage'),
    valTotalExpenses: document.getElementById('val-total-expenses'),
    lblBalanceTrend: document.getElementById('lbl-balance-trend'),
    lblJudicialCount: document.getElementById('lbl-judicial-count'),
    lblBrokerageCount: document.getElementById('lbl-brokerage-count'),
    lblExpensesCount: document.getElementById('lbl-expenses-count'),
    
    // Recent activity list
    tableRecentBody: document.getElementById('table-recent-body'),
    btnGoTransactions: document.querySelector('.btn-go-transactions'),
    
    // Transactions View
    tableTransactionsBody: document.getElementById('table-transactions-body'),
    tableEmptyState: document.getElementById('table-empty-state'),
    mainTransactionsTable: document.getElementById('main-transactions-table'),
    filterSearch: document.getElementById('filter-search'),
    filterType: document.getElementById('filter-type'),
    filterCategory: document.getElementById('filter-category'),
    filterStatus: document.getElementById('filter-status'),
    filterMonth: document.getElementById('filter-month'),
    btnExportCsv: document.getElementById('btn-export-csv'),
    btnEmptyAdd: document.getElementById('btn-empty-add'),
    btnClearAll: document.getElementById('btn-clear-all'),
    btnExportJson: document.getElementById('btn-export-json'),
    btnImportJson: document.getElementById('btn-import-json'),
    inputImportJson: document.getElementById('input-import-json'),
    
    // Reports View
    valProfitMargin: document.getElementById('val-profit-margin'),
    valPendingCollect: document.getElementById('val-pending-collect'),
    lblPendingCount: document.getElementById('lbl-pending-count'),
    valAvgMonthlyIncome: document.getElementById('val-avg-monthly-income'),
    tableSummaryBody: document.getElementById('table-summary-body'),
    
    // Modal & Form
    btnOpenModal: document.getElementById('btn-open-modal'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    btnCancelModal: document.getElementById('btn-cancel-modal'),
    modalOverlay: document.getElementById('transaction-modal'),
    modalTitle: document.getElementById('modal-title'),
    form: document.getElementById('transaction-form'),
    formTxId: document.getElementById('form-tx-id'),
    formTypeRadios: document.querySelectorAll('input[name="tx-type"]'),
    formCategorySelect: document.getElementById('form-category'),
    formDate: document.getElementById('form-date'),
    formPeriod: document.getElementById('form-period'),
    formReference: document.getElementById('form-reference'),
    formReferenceLabel: document.getElementById('form-reference-label'),
    formAmount: document.getElementById('form-amount'),
    formStatus: document.getElementById('form-status'),
    formNotes: document.getElementById('form-notes'),
    
    // File Upload DOM Elements
    formAttachment: document.getElementById('form-attachment'),
    formAttachmentPreview: document.getElementById('form-attachment-preview'),
    formAttachmentName: document.getElementById('form-attachment-name'),
    btnRemoveAttachment: document.getElementById('btn-remove-attachment'),
    
    // Voucher Modal
    voucherModal: document.getElementById('voucher-modal'),
    voucherContent: document.getElementById('voucher-content'),
    btnPrintVoucher: document.getElementById('btn-print-voucher'),
    btnCloseVoucher: document.getElementById('btn-close-voucher'),
    btnCloseVoucherFoot: document.getElementById('btn-close-voucher-foot'),
    
    // Toast
    toast: document.getElementById('app-toast'),
    toastMsg: document.querySelector('.toast-message'),

    // Export Reminder Modal
    exportReminderModal: document.getElementById('export-reminder-modal'),
    btnCloseReminder: document.getElementById('btn-close-reminder'),
    btnCloseReminderFoot: document.getElementById('btn-close-reminder-foot'),
    btnReminderEmail: document.getElementById('btn-reminder-email'),
    btnReminderCopy: document.getElementById('btn-reminder-copy'),

    // Login & Profile Switcher
    loginOverlay: document.getElementById('login-overlay'),
    loginForm: document.getElementById('login-form'),
    loginEmail: document.getElementById('login-email'),
    loginPassword: document.getElementById('login-password'),
    loginErrorMsg: document.getElementById('login-error-msg'),
    userDisplayEmail: document.getElementById('user-display-email'),
    userAvatarInitials: document.getElementById('user-avatar-initials'),
    btnLogout: document.getElementById('btn-logout'),
    profileSwitchEmpresa: document.getElementById('profile-switch-empresa'),
    profileSwitchPersonal: document.getElementById('profile-switch-personal'),

    // Mobile Navigation & Drawer Elements
    btnMobileAdd: document.getElementById('btn-mobile-add'),
    btnMenuToggle: document.getElementById('mobile-nav-menu-toggle'),
    mobileDrawer: document.getElementById('mobile-drawer'),
    btnCloseDrawer: document.getElementById('btn-close-drawer'),
    mobileDrawerOverlay: document.getElementById('mobile-drawer-overlay'),
    drawerSwitchEmpresa: document.getElementById('drawer-switch-empresa'),
    drawerSwitchPersonal: document.getElementById('drawer-switch-personal'),
    drawerUserEmail: document.getElementById('drawer-user-email'),
    drawerAvatarInitials: document.getElementById('drawer-avatar-initials'),
    btnDrawerLogout: document.getElementById('btn-drawer-logout')
};

// --- 2. INITIALIZATION & STORAGE ---
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    // Setup date string in header
    setupHeaderDate();
    
    // Set up Authentication Controls
    setupAuthControls();
    
    // Set up Navigation
    setupNavigation();
    
    // Set up Form Selects & Event Listeners
    setupFormControls();
    
    // Setup Filter Listeners
    setupFilters();
    
    // Setup Export Reminder Modal Controls
    setupExportReminderControls();
    
    // Setup Mobile Navigation & Drawer Controls
    setupMobileControls();
    
    // Initial Render of everything
    updateUI();
    
    // Initialize Lucide Icons
    lucide.createIcons();
}

function setupHeaderDate() {
    const today = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateFormatted = today.toLocaleDateString('es-ES', options);
    elements.currentDateText.textContent = dateFormatted.charAt(0).toUpperCase() + dateFormatted.slice(1);
}

// Convert numbers to currency CL/General
function formatCurrency(val) {
    return new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        minimumFractionDigits: 0
    }).format(val).replace('CLP', '$');
}

// Helper: Formats "YYYY-MM" to readable capitalized month-year
function formatPeriodString(periodStr) {
    if (!periodStr) return '-';
    const [year, month] = periodStr.split('-');
    const dateObj = new Date(year, month - 1, 1);
    const formatString = dateObj.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    return formatString.charAt(0).toUpperCase() + formatString.slice(1);
}

// Helper: category label mappings
function getCategoryLabel(type, value) {
    const list = CATEGORIES[type];
    const cat = list.find(c => c.value === value);
    return cat ? cat.label : 'General';
}

// Helper: clean date formatting
function formatDateString(isoString) {
    if (!isoString) return '-';
    const [year, month, day] = isoString.split('-');
    const dateObj = new Date(year, month - 1, day);
    const options = { day: '2-digit', month: 'short', year: 'numeric' };
    return dateObj.toLocaleDateString('es-ES', options).replace('.', '');
}

function getMockTransactions() {
    const today = new Date();
    const subMonths = (m) => {
        const d = new Date();
        d.setMonth(today.getMonth() - m);
        return d.toISOString().split('T')[0];
    };
    
    const getPeriodStr = (dateStr) => {
        return dateStr.substring(0, 7);
    };
    
    const d0 = subMonths(0);
    const d1 = subMonths(1);
    
    return [
        {
            id: 'tx-1',
            type: 'income',
            category: 'brokerage-sale',
            date: d0,
            period: getPeriodStr(d0),
            reference: 'Comisión Venta Terreno Melipilla (Familia Silva)',
            amount: 4500000,
            status: 'paid',
            notes: 'Comisión correspondiente al 2% de la venta acordada. Excelente gestión.'
        },
        {
            id: 'tx-2',
            type: 'income',
            category: 'judicial-litigation',
            date: d0,
            period: getPeriodStr(d0),
            reference: 'Honorarios Defensa Juicio Civil Inmobiliaria del Sur',
            amount: 2800000,
            status: 'paid',
            notes: 'Pago de primera cuota según contrato de honorarios.'
        },
        {
            id: 'tx-3',
            type: 'income',
            category: 'brokerage-rental',
            date: d0,
            period: getPeriodStr(d0),
            reference: 'Comisión Arriendo Depto Av. Las Condes #402',
            amount: 350000,
            status: 'paid',
            notes: 'Cobro de comisión equivalente al 50% de un mes de arriendo al propietario.'
        },
        {
            id: 'tx-4',
            type: 'income',
            category: 'judicial-consultancy',
            date: d0, // Paid in June
            period: getPeriodStr(d1), // Corresponds to May's advisory work
            reference: 'Honorarios Asesoría Tributaria Grupo Holding S.A.',
            amount: 1200000,
            status: 'pending',
            notes: 'Asesoría de reestructuración corporativa familiar realizada en Mayo. Factura emitida, pendiente pago.'
        },
        {
            id: 'tx-5',
            type: 'income',
            category: 'judicial-notary',
            date: d1,
            period: getPeriodStr(d1),
            reference: 'Redacción Promesa Compraventa y Estudio de Títulos - Sr. Gómez',
            amount: 150000,
            status: 'paid',
            notes: 'Trámite notarial y estudio de títulos finalizado con éxito.'
        },
        {
            id: 'tx-6',
            type: 'expense',
            category: 'expense-rent',
            date: d0,
            period: getPeriodStr(d0),
            reference: 'Arriendo Oficina Mansarda Providencia #190',
            amount: 850000,
            status: 'paid',
            notes: 'Arriendo mensual del mes en curso.'
        },
        {
            id: 'tx-7',
            type: 'expense',
            category: 'expense-luz',
            date: d0, // Paid in June
            period: getPeriodStr(d1), // Corresponds to May service bill
            reference: 'Cuenta de Luz Oficina (Enel)',
            amount: 75000,
            status: 'paid',
            notes: 'Consumo eléctrico del mes de mayo.'
        },
        {
            id: 'tx-7-agua',
            type: 'expense',
            category: 'expense-agua',
            date: d0, // Paid in June
            period: getPeriodStr(d1), // Corresponds to May service bill
            reference: 'Cuenta de Agua Oficina (Aguas Andinas)',
            amount: 45000,
            status: 'paid',
            notes: 'Consumo de agua potable del mes de mayo.'
        },
        {
            id: 'tx-8',
            type: 'expense',
            category: 'expense-marketing',
            date: d0,
            period: getPeriodStr(d0),
            reference: 'Campaña Publicidad Facebook Ads / Google Ads',
            amount: 250000,
            status: 'paid',
            notes: 'Presupuesto de marketing digital para captación de clientes de corretaje.'
        },
        {
            id: 'tx-9',
            type: 'expense',
            category: 'expense-supplies',
            date: d1,
            period: getPeriodStr(d1),
            reference: 'Compra de Insumos Oficina (Resmas, Tinta y Café)',
            amount: 45000,
            status: 'paid',
            notes: 'Suministros comprados en Librería Nacional.'
        },
        {
            id: 'tx-10',
            type: 'expense',
            category: 'expense-internet',
            date: d0, // Paid in June
            period: getPeriodStr(d1), // Corresponds to May service
            reference: 'Plan Internet Fibra + Telefonía Oficina VTR',
            amount: 60000,
            status: 'pending',
            notes: 'Servicio de conectividad de fibra óptica de mayo. Cuenta vence el 15 de este mes.'
        }
    ];
}

// --- 3. UI RENDERING & CHARTS ---
function updateUI() {
    // Refresh periods in filter dropdowns
    populatePeriodFilter();
    populateDashboardPeriodSelect();
    
    // Renders
    renderDashboardMetrics();
    renderRecentTable();
    renderTransactionsTable();
    renderReportsView();
    
    // Render Charts
    setTimeout(() => {
        renderCharts();
    }, 100);
}

// Get currently active dashboard filtered list
function getFilteredDashboardTxs() {
    const selectedVal = elements.dashboardPeriodSelect ? elements.dashboardPeriodSelect.value : 'all';
    
    return transactions.filter(tx => {
        if (selectedVal === 'all') return true;
        if (selectedVal === 'current-year') {
            const currentYearStr = new Date().getFullYear().toString();
            return tx.period.startsWith(currentYearStr);
        }
        // Specific Month Period (YYYY-MM)
        return tx.period === selectedVal;
    });
}

function renderDashboardMetrics() {
    const filteredTxs = getFilteredDashboardTxs();
    
    let incomeJudicial = 0;
    let incomeBrokerage = 0;
    let totalExpenses = 0;
    
    let judCount = 0;
    let broCount = 0;
    let expCount = 0;
    
    filteredTxs.forEach(tx => {
        if (tx.type === 'income') {
            if (tx.category.startsWith('judicial')) {
                incomeJudicial += Number(tx.amount);
                judCount++;
            } else if (tx.category.startsWith('brokerage')) {
                incomeBrokerage += Number(tx.amount);
                broCount++;
            }
        } else if (tx.type === 'expense') {
            totalExpenses += Number(tx.amount);
            expCount++;
        }
    });
    
    const netBalance = (incomeJudicial + incomeBrokerage) - totalExpenses;
    
    // Updates values in dashboard cards
    elements.valNetBalance.textContent = formatCurrency(netBalance);
    elements.valIncomeJudicial.textContent = formatCurrency(incomeJudicial);
    elements.valIncomeBrokerage.textContent = formatCurrency(incomeBrokerage);
    elements.valTotalExpenses.textContent = formatCurrency(totalExpenses);
    
    elements.lblJudicialCount.textContent = `${judCount} ${judCount === 1 ? 'transacción' : 'transacciones'}`;
    elements.lblBrokerageCount.textContent = `${broCount} ${broCount === 1 ? 'transacción' : 'transacciones'}`;
    elements.lblExpensesCount.textContent = `${expCount} ${expCount === 1 ? 'transacción' : 'transacciones'}`;
    
    // Dynamic styling of balance badge
    if (netBalance > 0) {
        elements.lblBalanceTrend.className = 'trend-badge trend-positive';
        elements.lblBalanceTrend.innerHTML = '<i data-lucide="trending-up"></i> Superávit Financiero';
    } else if (netBalance < 0) {
        elements.lblBalanceTrend.className = 'trend-badge trend-negative';
        elements.lblBalanceTrend.innerHTML = '<i data-lucide="trending-down"></i> Déficit en Cuenta';
    } else {
        elements.lblBalanceTrend.className = 'trend-badge trend-neutral';
        elements.lblBalanceTrend.innerHTML = '<i data-lucide="activity"></i> Cuenta en Cero';
    }
    
    lucide.createIcons({
        attrs: {
            'data-lucide': true
        },
        nameAttr: 'data-lucide',
        nodeList: [elements.lblBalanceTrend]
    });
}

function renderRecentTable() {
    const filteredTxs = getFilteredDashboardTxs();
    
    // Get last 5 transactions sorted by date descending
    const sorted = [...filteredTxs]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);
        
    elements.tableRecentBody.innerHTML = '';
    
    if (sorted.length === 0) {
        elements.tableRecentBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: var(--color-text-muted); padding: 30px;">
                    No hay transacciones en el período seleccionado
                </td>
            </tr>
        `;
        return;
    }
    
    sorted.forEach(tx => {
        const tr = document.createElement('tr');
        const formattedDate = formatDateString(tx.date);
        const categoryLabel = getCategoryLabel(tx.type, tx.category);
        const categoryClass = tx.type === 'income' 
            ? (tx.category.startsWith('judicial') ? 'cat-judicial' : 'cat-brokerage')
            : 'cat-expense';
            
        tr.innerHTML = `
            <td>${formattedDate}</td>
            <td>
                <div class="type-cell ${tx.type}">
                    <i data-lucide="${tx.type === 'income' ? 'trending-up' : 'trending-down'}"></i>
                    <div>
                        <span class="category-tag ${categoryClass}">${categoryLabel}</span>
                        <div style="font-size: 0.72rem; color: var(--color-text-muted); margin-top: 3px;">
                            ${formatPeriodString(tx.period)}
                        </div>
                    </div>
                </div>
            </td>
            <td>${tx.reference}</td>
            <td class="amount-cell ${tx.type}">${tx.type === 'income' ? '+' : '-'}&nbsp;${formatCurrency(tx.amount)}</td>
            <td>
                <span class="status-badge ${tx.status}" onclick="toggleStatus('${tx.id}')">
                    <i data-lucide="${tx.status === 'paid' ? 'check-circle' : 'clock'}"></i>
                    ${tx.status === 'paid' ? 'Cobrado' : 'Pendiente'}
                </span>
            </td>
        `;
        elements.tableRecentBody.appendChild(tr);
    });
    
    lucide.createIcons({
        attrs: {
            'data-lucide': true
        },
        nameAttr: 'data-lucide',
        nodeList: elements.tableRecentBody.querySelectorAll('[data-lucide]')
    });
}

function renderTransactionsTable() {
    // Get filter states
    const query = elements.filterSearch.value.toLowerCase().trim();
    const type = elements.filterType.value;
    const category = elements.filterCategory.value;
    const status = elements.filterStatus.value;
    const period = elements.filterMonth.value;
    
    // Apply filters
    const filtered = transactions.filter(tx => {
        const matchQuery = !query || 
            tx.reference.toLowerCase().includes(query) || 
            (tx.notes && tx.notes.toLowerCase().includes(query));
            
        const matchType = type === 'all' || tx.type === type;
        const matchCategory = category === 'all' || tx.category === category;
        const matchStatus = status === 'all' || tx.status === status;
        const matchPeriod = period === 'all' || tx.period === period;
        
        return matchQuery && matchType && matchCategory && matchStatus && matchPeriod;
    });
    
    // Sort transactions dynamically
    filtered.sort((a, b) => {
        let valA, valB;
        if (sortField === 'date') {
            valA = new Date(a.date);
            valB = new Date(b.date);
            return sortDirection === 'asc' ? valA - valB : valB - valA;
        } else if (sortField === 'amount') {
            valA = Number(a.amount) || 0;
            valB = Number(b.amount) || 0;
            return sortDirection === 'asc' ? valA - valB : valB - valA;
        } else if (sortField === 'type') {
            valA = a.type === 'income' ? 'Ingreso' : 'Gasto';
            valB = b.type === 'income' ? 'Ingreso' : 'Gasto';
        } else if (sortField === 'category') {
            valA = getCategoryLabel(a.type, a.category);
            valB = getCategoryLabel(b.type, b.category);
        } else if (sortField === 'reference') {
            valA = a.reference || '';
            valB = b.reference || '';
        } else if (sortField === 'status') {
            valA = a.status === 'paid' ? 'Cobrado' : 'Pendiente';
            valB = b.status === 'paid' ? 'Cobrado' : 'Pendiente';
        } else {
            valA = new Date(a.date);
            valB = new Date(b.date);
            return valB - valA;
        }
        
        return sortDirection === 'asc' 
            ? valA.localeCompare(valB, 'es', { sensitivity: 'base' }) 
            : valB.localeCompare(valA, 'es', { sensitivity: 'base' });
    });
    
    // Handle empty state
    if (filtered.length === 0) {
        elements.tableEmptyState.style.display = 'flex';
        elements.mainTransactionsTable.style.display = 'none';
        return;
    } else {
        elements.tableEmptyState.style.display = 'none';
        elements.mainTransactionsTable.style.display = 'table';
    }
    
    // Update sort headers styling and icons in HTML
    const headers = elements.mainTransactionsTable.querySelectorAll('th.sortable');
    headers.forEach(th => {
        const field = th.getAttribute('data-sort');
        const icon = th.querySelector('.sort-icon');
        if (icon) {
            if (field === sortField) {
                th.classList.add('active-sort');
                icon.setAttribute('data-lucide', sortDirection === 'asc' ? 'arrow-up' : 'arrow-down');
            } else {
                th.classList.remove('active-sort');
                icon.setAttribute('data-lucide', 'arrow-up-down');
            }
        }
    });
    
    elements.tableTransactionsBody.innerHTML = '';
    
    filtered.forEach(tx => {
        const tr = document.createElement('tr');
        const formattedDate = formatDateString(tx.date);
        const categoryLabel = getCategoryLabel(tx.type, tx.category);
        const categoryClass = tx.type === 'income' 
            ? (tx.category.startsWith('judicial') ? 'cat-judicial' : 'cat-brokerage')
            : 'cat-expense';
            
        // Check if there is an attachment to render paperclip
        const clipIcon = tx.attachment ? `<i data-lucide="paperclip" style="width:12px; height:12px; color:var(--color-primary);" title="Comprobante adjunto"></i>` : '';
            
        tr.innerHTML = `
            <td>${formattedDate}</td>
            <td>
                <span class="type-cell ${tx.type}">
                    <i data-lucide="${tx.type === 'income' ? 'trending-up' : 'trending-down'}"></i>
                    ${tx.type === 'income' ? 'Ingreso' : 'Gasto'}
                </span>
            </td>
            <td>
                <span class="category-tag ${categoryClass}">${categoryLabel}</span>
                <div style="font-size:0.73rem; color:var(--color-text-muted); margin-top:4px; font-weight:600; display:flex; align-items:center; gap:4px;">
                    <i data-lucide="calendar" style="width:10px; height:10px;"></i>
                    ${formatPeriodString(tx.period)}
                    ${clipIcon}
                </div>
            </td>
            <td style="max-width: 230px; font-weight:600;">${tx.reference}</td>
            <td class="amount-cell ${tx.type}">${tx.type === 'income' ? '+' : '-'}&nbsp;${formatCurrency(tx.amount)}</td>
            <td>
                <span class="status-badge ${tx.status}" onclick="toggleStatus('${tx.id}')" title="Haz clic para cambiar estado">
                    <i data-lucide="${tx.status === 'paid' ? 'check-circle' : 'clock'}"></i>
                    ${tx.status === 'paid' ? 'Cobrado' : 'Pendiente'}
                </span>
            </td>
            <td style="max-width: 150px; font-size:0.8rem; color:var(--color-text-muted);" title="${tx.notes || ''}">
                ${tx.notes ? (tx.notes.length > 30 ? tx.notes.substring(0, 27) + '...' : tx.notes) : '-'}
            </td>
            <td class="text-right">
                <div class="actions-cell">
                    <button class="btn btn-secondary btn-icon" onclick="viewVoucher('${tx.id}')" title="Ver Voucher / Comprobante">
                        <i data-lucide="file-text"></i>
                    </button>
                    <button class="btn btn-secondary btn-icon" onclick="editTx('${tx.id}')" title="Editar">
                        <i data-lucide="edit-3"></i>
                    </button>
                    <button class="btn btn-danger btn-icon" onclick="deleteTx('${tx.id}')" title="Eliminar">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            </td>
        `;
        
        elements.tableTransactionsBody.appendChild(tr);
    });
    
    // Setup icons inside the table header and body
    lucide.createIcons({
        attrs: {
            'data-lucide': true
        },
        nameAttr: 'data-lucide',
        nodeList: elements.mainTransactionsTable.querySelectorAll('[data-lucide]')
    });
}

function renderReportsView() {
    let totalIncome = 0;
    let totalExpenses = 0;
    let incomeJudicial = 0;
    let incomeBrokerage = 0;
    let pendingAmount = 0;
    let pendingCount = 0;
    
    transactions.forEach(tx => {
        const amount = Number(tx.amount);
        if (tx.type === 'income') {
            totalIncome += amount;
            if (tx.category.startsWith('judicial')) {
                incomeJudicial += amount;
            } else if (tx.category.startsWith('brokerage')) {
                incomeBrokerage += amount;
            }
            if (tx.status === 'pending') {
                pendingAmount += amount;
                pendingCount++;
            }
        } else if (tx.type === 'expense') {
            totalExpenses += amount;
        }
    });
    
    // Profit margin percentage
    const profitMargin = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;
    elements.valProfitMargin.textContent = `${profitMargin.toFixed(1)}%`;
    elements.valProfitMargin.className = `metric-value ${profitMargin >= 0 ? 'text-primary' : 'text-expense'}`;
    
    // Pending collectibles
    elements.valPendingCollect.textContent = formatCurrency(pendingAmount);
    elements.lblPendingCount.textContent = `${pendingCount} cuentas pendientes por cobrar`;
    
    // Average Monthly Income
    const monthsSet = new Set(transactions.map(tx => tx.period));
    const uniqueMonthsCount = monthsSet.size || 1;
    const avgMonthly = totalIncome / uniqueMonthsCount;
    elements.valAvgMonthlyIncome.textContent = formatCurrency(avgMonthly);
    
    // 2. Render summary consolidated table
    const monthlySummary = {};
    transactions.forEach(tx => {
        const monthKey = tx.period; // YYYY-MM
        if (!monthlySummary[monthKey]) {
            monthlySummary[monthKey] = {
                month: monthKey,
                judicial: 0,
                brokerage: 0,
                expenses: 0
            };
        }
        const amt = Number(tx.amount);
        if (tx.type === 'income') {
            if (tx.category.startsWith('judicial')) {
                monthlySummary[monthKey].judicial += amt;
            } else {
                monthlySummary[monthKey].brokerage += amt;
            }
        } else if (tx.type === 'expense') {
            monthlySummary[monthKey].expenses += amt;
        }
    });
    
    const summaryRows = Object.values(monthlySummary).sort((a, b) => b.month.localeCompare(a.month));
    
    elements.tableSummaryBody.innerHTML = '';
    
    if (summaryRows.length === 0) {
        elements.tableSummaryBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: var(--color-text-muted); padding: 30px;">
                    No hay suficientes datos mensuales.
                </td>
            </tr>
        `;
        return;
    }
    
    summaryRows.forEach(row => {
        const totalInc = row.judicial + row.brokerage;
        const netResult = totalInc - row.expenses;
        const margin = totalInc > 0 ? (netResult / totalInc) * 100 : 0;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: 700; color:var(--color-text-light);">${formatPeriodString(row.month)}</td>
            <td class="text-judicial">${formatCurrency(row.judicial)}</td>
            <td class="text-brokerage">${formatCurrency(row.brokerage)}</td>
            <td class="text-expense">${formatCurrency(row.expenses)}</td>
            <td class="type-cell ${netResult >= 0 ? 'income' : 'expense'}">${formatCurrency(netResult)}</td>
            <td>
                <span class="trend-badge ${margin >= 0 ? 'trend-positive' : 'trend-negative'}">
                    ${margin.toFixed(0)}%
                </span>
            </td>
        `;
        elements.tableSummaryBody.appendChild(tr);
    });
}

// --- 4. CHART.JS CONFIGURATIONS ---
function renderCharts() {
    Object.keys(charts).forEach(key => {
        if (charts[key]) charts[key].destroy();
    });
    
    Chart.defaults.color = '#9ca3af';
    Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";
    Chart.defaults.font.size = 11;

    const filteredTxs = getFilteredDashboardTxs();
    const dashboardPeriodVal = elements.dashboardPeriodSelect ? elements.dashboardPeriodSelect.value : 'all';

    let labels = [];
    let incomeData = [];
    let expenseData = [];
    let isDailyBreakdown = false;

    if (dashboardPeriodVal !== 'all' && dashboardPeriodVal !== 'current-year') {
        // --- A. DAILY BREAKDOWN ---
        isDailyBreakdown = true;
        const [year, month] = dashboardPeriodVal.split('-');
        const yearInt = parseInt(year);
        const monthInt = parseInt(month);
        
        const daysInMonth = new Date(yearInt, monthInt, 0).getDate();
        
        const dailyIncomeMap = Array(daysInMonth).fill(0);
        const dailyExpenseMap = Array(daysInMonth).fill(0);
        
        filteredTxs.forEach(tx => {
            const txDay = parseInt(tx.date.split('-')[2]);
            if (txDay >= 1 && txDay <= daysInMonth) {
                const amt = Number(tx.amount);
                if (tx.type === 'income') {
                    dailyIncomeMap[txDay - 1] += amt;
                } else if (tx.type === 'expense') {
                    dailyExpenseMap[txDay - 1] += amt;
                }
            }
        });

        for (let day = 1; day <= daysInMonth; day++) {
            labels.push(`Día ${day}`);
            incomeData.push(dailyIncomeMap[day - 1]);
            expenseData.push(dailyExpenseMap[day - 1]);
        }
    } else {
        // --- B. MONTHLY TREND ---
        const monthsMap = {};
        const today = new Date();
        const yearFilter = dashboardPeriodVal === 'current-year' ? today.getFullYear().toString() : null;

        if (yearFilter) {
            for (let i = 0; i < 12; i++) {
                const key = `${yearFilter}-${String(i + 1).padStart(2, '0')}`;
                const d = new Date(parseInt(yearFilter), i, 1);
                monthsMap[key] = {
                    label: d.toLocaleDateString('es-ES', { month: 'short' }),
                    income: 0,
                    expense: 0
                };
            }
        } else {
            for (let i = 5; i >= 0; i--) {
                const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
                const key = d.toISOString().substring(0, 7);
                monthsMap[key] = {
                    label: d.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }),
                    income: 0,
                    expense: 0
                };
            }
            
            transactions.forEach(t => {
                const key = t.period;
                if (!monthsMap[key]) {
                    const [y, m] = key.split('-');
                    const d = new Date(parseInt(y), parseInt(m) - 1, 1);
                    monthsMap[key] = {
                        label: d.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }),
                        income: 0,
                        expense: 0
                    };
                }
            });
        }

        transactions.forEach(tx => {
            const key = tx.period;
            if (monthsMap[key]) {
                const amt = Number(tx.amount);
                if (tx.type === 'income') {
                    monthsMap[key].income += amt;
                } else if (tx.type === 'expense') {
                    monthsMap[key].expense += amt;
                }
            }
        });

        const sortedKeys = Object.keys(monthsMap).sort();
        labels = sortedKeys.map(k => monthsMap[k].label);
        incomeData = sortedKeys.map(k => monthsMap[k].income);
        expenseData = sortedKeys.map(k => monthsMap[k].expense);
    }

    let totalJud = 0;
    let totalBro = 0;
    filteredTxs.forEach(tx => {
        if (tx.type === 'income') {
            const amt = Number(tx.amount);
            if (tx.category.startsWith('judicial')) totalJud += amt;
            else if (tx.category.startsWith('brokerage')) totalBro += amt;
        }
    });

    const expenseCatSummary = {};
    CATEGORIES.expense.forEach(c => {
        expenseCatSummary[c.value] = {
            label: c.label,
            total: 0
        };
    });
    
    transactions.forEach(tx => {
        if (tx.type === 'expense') {
            const amt = Number(tx.amount);
            if (expenseCatSummary[tx.category]) {
                expenseCatSummary[tx.category].total += amt;
            } else {
                if (!expenseCatSummary['expense-other']) {
                    expenseCatSummary['expense-other'] = { label: 'Otros Gastos', total: 0 };
                }
                expenseCatSummary['expense-other'].total += amt;
            }
        }
    });
    
    const expenseLabels = [];
    const expenseDataValues = [];
    Object.values(expenseCatSummary).forEach(item => {
        if (item.total > 0) {
            expenseLabels.push(item.label);
            expenseDataValues.push(item.total);
        }
    });

    // Chart 1: Dashboard Cashflow Line/Bar Chart
    const ctxCashflow = document.getElementById('chart-cashflow-trend');
    if (ctxCashflow) {
        charts.cashflow = new Chart(ctxCashflow, {
            type: isDailyBreakdown ? 'bar' : 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Ingresos',
                        data: incomeData,
                        borderColor: '#10b981',
                        backgroundColor: isDailyBreakdown ? 'rgba(16, 185, 129, 0.45)' : 'rgba(16, 185, 129, 0.05)',
                        borderWidth: isDailyBreakdown ? 0 : 3,
                        pointBackgroundColor: '#10b981',
                        pointBorderColor: 'rgba(255,255,255,0.2)',
                        pointHoverRadius: 6,
                        tension: 0.35,
                        fill: !isDailyBreakdown,
                        borderRadius: isDailyBreakdown ? 4 : 0
                    },
                    {
                        label: 'Gastos',
                        data: expenseData,
                        borderColor: '#f43f5e',
                        backgroundColor: isDailyBreakdown ? 'rgba(244, 63, 94, 0.45)' : 'rgba(244, 63, 94, 0.05)',
                        borderWidth: isDailyBreakdown ? 0 : 3,
                        pointBackgroundColor: '#f43f5e',
                        pointBorderColor: 'rgba(255,255,255,0.2)',
                        pointHoverRadius: 6,
                        tension: 0.35,
                        fill: !isDailyBreakdown,
                        borderRadius: isDailyBreakdown ? 4 : 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#121829',
                        titleColor: '#fff',
                        bodyColor: '#e2e8f0',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            label: function(context) {
                                return ` ${context.dataset.label}: ${formatCurrency(context.raw)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: { 
                        grid: { display: false },
                        ticks: {
                            callback: function(val, index) {
                                if (isDailyBreakdown) {
                                    return (index % 3 === 0) ? labels[index] : '';
                                }
                                return labels[index];
                            }
                        }
                    },
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: {
                            callback: function(value) {
                                if (value >= 1000000) return '$' + (value / 1000000).toFixed(1) + 'M';
                                if (value >= 1000) return '$' + (value / 1000).toFixed(0) + 'k';
                                return '$' + value;
                            }
                        }
                    }
                }
            }
        });
    }

    // Chart 2: Dashboard Income Doughnut
    const ctxIncomeDist = document.getElementById('chart-income-dist');
    if (ctxIncomeDist) {
        const noData = totalJud === 0 && totalBro === 0;
        charts.incomeDist = new Chart(ctxIncomeDist, {
            type: 'doughnut',
            data: {
                labels: noData ? ['Sin datos'] : ['Leyes / Judicial', 'Corretaje'],
                datasets: [{
                    data: noData ? [1] : [totalJud, totalBro],
                    backgroundColor: noData ? ['#272d3d'] : ['#8b5cf6', '#10b981'],
                    borderColor: '#111827',
                    borderWidth: 2,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '72%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 16,
                            usePointStyle: true,
                            font: { weight: '600' }
                        }
                    },
                    tooltip: {
                        enabled: !noData,
                        backgroundColor: '#121829',
                        padding: 12,
                        callbacks: {
                            label: function(context) {
                                const total = totalJud + totalBro;
                                const pct = ((context.raw / total) * 100).toFixed(1);
                                return ` ${context.label}: ${formatCurrency(context.raw)} (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    // Chart 3: Reports Expenses Breakdown Pie/Doughnut
    const ctxExpenseBreakdown = document.getElementById('chart-expenses-breakdown');
    if (ctxExpenseBreakdown) {
        const hasExpenses = expenseDataValues.length > 0;
        charts.expenseBreakdown = new Chart(ctxExpenseBreakdown, {
            type: 'pie',
            data: {
                labels: hasExpenses ? expenseLabels : ['Sin gastos'],
                datasets: [{
                    data: hasExpenses ? expenseDataValues : [1],
                    backgroundColor: hasExpenses ? 
                        ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#6366f1'] : 
                        ['#272d3d'],
                    borderColor: '#111827',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 12,
                            usePointStyle: true,
                            font: { weight: '500', size: 10 }
                        }
                    },
                    tooltip: {
                        enabled: hasExpenses,
                        backgroundColor: '#121829',
                        padding: 12,
                        callbacks: {
                            label: function(context) {
                                const total = expenseDataValues.reduce((a, b) => a + b, 0);
                                const pct = ((context.raw / total) * 100).toFixed(1);
                                return ` ${context.label}: ${formatCurrency(context.raw)} (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    // Chart 4: Reports Monthly Bar Comparison Chart
    const ctxMonthlyComp = document.getElementById('chart-monthly-comparison');
    if (ctxMonthlyComp) {
        const monthsMap = {};
        const today = new Date();
        
        for (let i = 5; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const key = d.toISOString().substring(0, 7);
            monthsMap[key] = {
                label: d.toLocaleDateString('es-ES', { month: 'short' }),
                income: 0,
                expense: 0
            };
        }

        transactions.forEach(tx => {
            const key = tx.period;
            if (monthsMap[key]) {
                const amt = Number(tx.amount);
                if (tx.type === 'income') monthsMap[key].income += amt;
                else if (tx.type === 'expense') monthsMap[key].expense += amt;
            }
        });

        const sortedKeys = Object.keys(monthsMap).sort();
        const historicLabels = sortedKeys.map(k => monthsMap[k].label);
        const historicIncome = sortedKeys.map(k => monthsMap[k].income);
        const historicExpense = sortedKeys.map(k => monthsMap[k].expense);

        charts.monthlyComp = new Chart(ctxMonthlyComp, {
            type: 'bar',
            data: {
                labels: historicLabels,
                datasets: [
                    {
                        label: 'Ingresos',
                        backgroundColor: '#10b981',
                        data: historicIncome,
                        borderRadius: 6
                    },
                    {
                        label: 'Gastos',
                        backgroundColor: '#f43f5e',
                        data: historicExpense,
                        borderRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' },
                    tooltip: {
                        backgroundColor: '#121829',
                        padding: 12,
                        callbacks: {
                            label: function(context) {
                                return ` ${context.dataset.label}: ${formatCurrency(context.raw)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false } },
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: {
                            callback: function(value) {
                                if (value >= 1000000) return '$' + (value / 1000000).toFixed(1) + 'M';
                                if (value >= 1000) return '$' + (value / 1000).toFixed(0) + 'k';
                                return '$' + value;
                            }
                        }
                    }
                }
            }
        });
    }
}

// --- 5. NAVIGATION & MODAL CONTROLS ---
function setupNavigation() {
    elements.navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetView = btn.getAttribute('data-view');
            switchView(targetView);
        });
    });
    
    if (elements.btnGoTransactions) {
        elements.btnGoTransactions.addEventListener('click', () => {
            switchView('transactions');
        });
    }
}

function switchView(viewName) {
    elements.navBtns.forEach(btn => {
        if (btn.getAttribute('data-view') === viewName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    elements.views.forEach(view => {
        const viewId = view.getAttribute('id');
        if (viewId === `view-${viewName}`) {
            view.classList.add('active');
        } else {
            view.classList.remove('active');
        }
    });
    
    let title = 'Panel de Control';
    let subtitle = 'Bienvenido, aquí está el resumen financiero de tu oficina.';
    
    if (viewName === 'transactions') {
        title = 'Historial de Transacciones';
        subtitle = 'Administra todos los cobros de corretaje, honorarios legales y gastos.';
    } else if (viewName === 'reports') {
        title = 'Reportes & Análisis';
        subtitle = 'Métricas avanzadas de rentabilidad, cuentas por cobrar y comportamiento mensual.';
    }
    
    elements.currentTitle.textContent = title;
    elements.currentSubtitle.textContent = subtitle;
    
    setTimeout(() => {
        renderCharts();
    }, 150);
}

function openModal(editMode = false) {
    elements.modalOverlay.classList.add('active');
    
    const typeChecked = document.querySelector('input[name="tx-type"]:checked').value;
    populateFormCategories(typeChecked);
    
    // Reset attachments preview
    currentAttachment = null;
    elements.formAttachment.value = '';
    elements.formAttachmentPreview.style.display = 'none';
    elements.formAttachmentName.textContent = '';
    
    if (!editMode) {
        elements.modalTitle.textContent = 'Registrar Nueva Transacción';
        elements.formTxId.value = '';
        elements.form.reset();
        
        updateTypeSelectorCardUI('income');
        populateFormCategories('income');
        
        const todayStr = new Date().toISOString().split('T')[0];
        elements.formDate.value = todayStr;
        elements.formPeriod.value = todayStr.substring(0, 7);
        
        elements.formStatus.value = 'paid';
    }
}

function closeModal() {
    elements.modalOverlay.classList.remove('active');
    elements.form.reset();
}

function setupFormControls() {
    // Open triggers
    elements.btnOpenModal.addEventListener('click', () => openModal(false));
    if (elements.btnEmptyAdd) {
        elements.btnEmptyAdd.addEventListener('click', () => openModal(false));
    }
    
    // Close triggers
    elements.btnCloseModal.addEventListener('click', closeModal);
    elements.btnCancelModal.addEventListener('click', closeModal);
    elements.modalOverlay.addEventListener('click', (e) => {
        if (e.target === elements.modalOverlay) closeModal();
    });
    
    // Auto-update imputation period when transaction date changes!
    elements.formDate.addEventListener('change', (e) => {
        if (e.target.value) {
            elements.formPeriod.value = e.target.value.substring(0, 7);
        }
    });
    
    // Handle toggle Income / Expense in Form
    elements.formTypeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const val = e.target.value;
            updateTypeSelectorCardUI(val);
            populateFormCategories(val);
            
            if (val === 'income') {
                elements.formReferenceLabel.innerHTML = 'Cliente o Caso Judicial / Propiedad <span class="required">*</span>';
                elements.formReference.placeholder = 'Nombre del cliente, número de causa o dirección de propiedad...';
                elements.formStatus.options[0].text = 'Cobrado / Pagado';
            } else {
                elements.formReferenceLabel.innerHTML = 'Detalle de Proveedor / Concepto Gasto <span class="required">*</span>';
                elements.formReference.placeholder = 'Luz S.A., Aguas Andinas, VTR, Papelería central...';
                elements.formStatus.options[0].text = 'Pagado';
            }
        });
    });
    
    // --- ATTACHMENT UPLOAD TRIGGER & READER ---
    elements.formAttachment.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // Enforce 1MB maximum limit to preserve localStorage
        if (file.size > 1024 * 1024) {
            showToast('El archivo supera el límite de 1MB. Por favor, sube un archivo más ligero.', 'error');
            elements.formAttachment.value = '';
            elements.formAttachmentPreview.style.display = 'none';
            elements.formAttachmentName.textContent = '';
            currentAttachment = null;
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(evt) {
            currentAttachment = {
                name: file.name,
                type: file.type,
                data: evt.target.result // base64 string
            };
            elements.formAttachmentName.textContent = file.name;
            elements.formAttachmentPreview.style.display = 'flex';
            showToast('Comprobante cargado correctamente.');
        };
        reader.readAsDataURL(file);
    });
    
    // Remove attachment button
    elements.btnRemoveAttachment.addEventListener('click', () => {
        currentAttachment = null;
        elements.formAttachment.value = '';
        elements.formAttachmentPreview.style.display = 'none';
        elements.formAttachmentName.textContent = '';
        showToast('Comprobante removido.', 'info');
    });
    
    // --- CLIPBOARD PASTE (Ctrl+V) SCREENSHOT SUPPORT ---
    elements.form.addEventListener('paste', (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let index in items) {
            const item = items[index];
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                const blob = item.getAsFile();
                
                // Enforce 1MB maximum limit to preserve localStorage
                if (blob.size > 1024 * 1024) {
                    showToast('El pantallazo pegado supera el límite de 1MB. Por favor, sube un archivo más ligero.', 'error');
                    return;
                }
                
                const reader = new FileReader();
                reader.onload = function(evt) {
                    const today = new Date();
                    const formattedDate = today.toISOString().substring(0,10);
                    const formattedTime = today.toTimeString().substring(0,5).replace(':', '-');
                    const fileName = `Pantallazo_${formattedDate}_${formattedTime}.jpg`;
                    
                    currentAttachment = {
                        name: fileName,
                        type: 'image/jpeg',
                        data: evt.target.result // base64 string
                    };
                    
                    elements.formAttachmentName.textContent = fileName;
                    elements.formAttachmentPreview.style.display = 'flex';
                    showToast('Pantallazo pegado correctamente desde el portapapeles.');
                };
                reader.readAsDataURL(blob);
                
                // Prevent default paste action in input fields if image was handled
                e.preventDefault();
                break;
            }
        }
    });
    
    // --- VOUCHER CLOSE EVENTS ---
    const closeVoucher = () => {
        elements.voucherModal.classList.remove('active');
        elements.voucherContent.innerHTML = '';
    };
    
    elements.btnCloseVoucher.addEventListener('click', closeVoucher);
    elements.btnCloseVoucherFoot.addEventListener('click', closeVoucher);
    elements.voucherModal.addEventListener('click', (e) => {
        if (e.target === elements.voucherModal) closeVoucher();
    });
    
    // Printer trigger
    elements.btnPrintVoucher.addEventListener('click', () => {
        window.print();
    });
    
    // Form Submission
    elements.form.addEventListener('submit', (e) => {
        e.preventDefault();
        saveFormTx();
    });
}

function updateTypeSelectorCardUI(activeType) {
    const cardIncome = document.querySelector('.type-selector-card.type-income');
    const cardExpense = document.querySelector('.type-selector-card.type-expense');
    
    if (activeType === 'income') {
        cardIncome.classList.add('active');
        cardExpense.classList.remove('active');
    } else {
        cardExpense.classList.add('active');
        cardIncome.classList.remove('active');
    }
}

function populateFormCategories(type, selectVal = '') {
    elements.formCategorySelect.innerHTML = '';
    const cats = CATEGORIES[type];
    
    const groups = {};
    cats.forEach(c => {
        if (!groups[c.group]) groups[c.group] = [];
        groups[c.group].push(c);
    });
    
    Object.keys(groups).forEach(groupName => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = groupName;
        
        groups[groupName].forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.value;
            opt.textContent = c.label;
            if (selectVal && c.value === selectVal) opt.selected = true;
            optgroup.appendChild(opt);
        });
        
        elements.formCategorySelect.appendChild(optgroup);
    });
}

// --- 6. CORE CRUD BUSINESS LOGIC ---
function saveFormTx() {
    const txId = elements.formTxId.value;
    const type = document.querySelector('input[name="tx-type"]:checked').value;
    const category = elements.formCategorySelect.value;
    const date = elements.formDate.value;
    const period = elements.formPeriod.value;
    const reference = elements.formReference.value.trim();
    const amount = Math.abs(parseFloat(elements.formAmount.value));
    const status = elements.formStatus.value;
    const notes = elements.formNotes.value.trim();
    
    if (!category || !date || !period || !reference || isNaN(amount)) {
        showToast('Por favor, completa todos los campos requeridos.', 'error');
        return;
    }
    
    if (!currentUser) {
        showToast('Debes iniciar sesión para guardar datos.', 'error');
        return;
    }
    
    const finalId = txId || ('tx-' + Date.now());
    const txRef = doc(db, "transactions", finalId);
    const txData = {
        id: finalId,
        userId: currentUser.uid,
        profile: currentProfile,
        type,
        category,
        date,
        period,
        reference,
        amount,
        status,
        notes,
        attachment: currentAttachment || null
    };
    
    setDoc(txRef, txData)
        .then(() => {
            showToast(txId ? 'Transacción modificada correctamente.' : 'Nueva transacción registrada con éxito.');
            closeModal();
        })
        .catch(err => {
            showToast('Error al guardar en la nube.', 'error');
            console.error(err);
        });
}

window.toggleStatus = function(id) {
    const tx = transactions.find(t => t.id === id);
    if (tx) {
        const newStatus = tx.status === 'paid' ? 'pending' : 'paid';
        const txRef = doc(db, "transactions", id);
        setDoc(txRef, { status: newStatus }, { merge: true })
            .then(() => {
                showToast(`Transacción marcada como ${newStatus === 'paid' ? 'cobrada/pagada' : 'pendiente'}.`);
            })
            .catch(err => {
                showToast('Error al actualizar estado en la nube.', 'error');
                console.error(err);
            });
    }
};

window.editTx = function(id) {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;
    
    openModal(true);
    elements.modalTitle.textContent = 'Editar Transacción';
    elements.formTxId.value = tx.id;
    
    elements.formTypeRadios.forEach(radio => {
        if (radio.value === tx.type) {
            radio.checked = true;
        }
    });
    updateTypeSelectorCardUI(tx.type);
    
    populateFormCategories(tx.type, tx.category);
    
    elements.formDate.value = tx.date;
    elements.formPeriod.value = tx.period;
    elements.formReference.value = tx.reference;
    elements.formAmount.value = tx.amount;
    elements.formStatus.value = tx.status;
    elements.formNotes.value = tx.notes || '';
    
    // Load existing attachments if edit
    if (tx.attachment) {
        currentAttachment = tx.attachment;
        elements.formAttachmentName.textContent = tx.attachment.name;
        elements.formAttachmentPreview.style.display = 'flex';
    } else {
        currentAttachment = null;
        elements.formAttachmentPreview.style.display = 'none';
    }
    
    if (tx.type === 'income') {
        elements.formReferenceLabel.innerHTML = 'Cliente o Caso Judicial / Propiedad <span class="required">*</span>';
        elements.formReference.placeholder = 'Nombre del cliente, número de causa o dirección...';
    } else {
        elements.formReferenceLabel.innerHTML = 'Detalle de Proveedor / Concepto Gasto <span class="required">*</span>';
        elements.formReference.placeholder = 'Luz S.A., Aguas Andinas, VTR, Papelería central...';
    }
};

window.deleteTx = function(id) {
    if (confirm('¿Estás seguro de que deseas eliminar esta transacción? Esta acción no se puede deshacer.')) {
        const txRef = doc(db, "transactions", id);
        deleteDoc(txRef)
            .then(() => {
                showToast('Transacción eliminada de forma permanente.', 'info');
            })
            .catch(err => {
                showToast('Error al eliminar de la nube.', 'error');
                console.error(err);
            });
    }
};

// --- 7. FILTER SYSTEM & PERIOD CONVERSION ---
function setupFilters() {
    const triggerFilter = () => {
        renderTransactionsTable();
    };
    
    elements.filterSearch.addEventListener('input', triggerFilter);
    elements.filterType.addEventListener('change', triggerFilter);
    elements.filterCategory.addEventListener('change', triggerFilter);
    elements.filterStatus.addEventListener('change', triggerFilter);
    elements.filterMonth.addEventListener('change', triggerFilter);
    
    if (elements.dashboardPeriodSelect) {
        elements.dashboardPeriodSelect.addEventListener('change', () => {
            renderDashboardMetrics();
            renderRecentTable();
            renderCharts();
        });
    }
    
    elements.btnExportCsv.addEventListener('click', exportToCSV);
    if (elements.btnClearAll) {
        elements.btnClearAll.addEventListener('click', clearAllTransactions);
    }
    if (elements.btnExportJson) {
        elements.btnExportJson.addEventListener('click', exportToJSON);
    }
    if (elements.btnImportJson) {
        elements.btnImportJson.addEventListener('click', () => elements.inputImportJson.click());
    }
    if (elements.inputImportJson) {
        elements.inputImportJson.addEventListener('change', importFromJSON);
    }
    
    // Setup sorting column clicks
    const headers = elements.mainTransactionsTable.querySelectorAll('th.sortable');
    headers.forEach(th => {
        th.addEventListener('click', () => {
            const field = th.getAttribute('data-sort');
            if (sortField === field) {
                // Toggle direction
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                // New field, default to desc for date/amount, asc for text fields
                sortField = field;
                sortDirection = (field === 'date' || field === 'amount') ? 'desc' : 'asc';
            }
            renderTransactionsTable();
        });
    });
}

function populatePeriodFilter() {
    const monthSelect = elements.filterMonth;
    const selectedVal = monthSelect.value;
    
    monthSelect.innerHTML = '<option value="all">Todos los tiempos</option>';
    
    const periods = [];
    transactions.forEach(t => {
        const period = t.period;
        if (!periods.includes(period)) {
            periods.push(period);
        }
    });
    
    periods.sort((a, b) => b.localeCompare(a));
    
    periods.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = formatPeriodString(p);
        if (p === selectedVal) opt.selected = true;
        monthSelect.appendChild(opt);
    });
}

function populateDashboardPeriodSelect() {
    const dashSelect = elements.dashboardPeriodSelect;
    if (!dashSelect) return;
    
    const selectedVal = dashSelect.value;
    
    dashSelect.innerHTML = `
        <option value="all">Histórico (Todo el tiempo)</option>
        <option value="current-year">Año Actual (2026)</option>
    `;
    
    const periods = [];
    transactions.forEach(t => {
        const period = t.period;
        if (!periods.includes(period)) {
            periods.push(period);
        }
    });
    
    periods.sort((a, b) => b.localeCompare(a));
    
    periods.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = formatPeriodString(p);
        if (p === selectedVal) opt.selected = true;
        dashSelect.appendChild(opt);
    });
}

// --- 8. VOUCHER SYSTEM ---
window.viewVoucher = function(id) {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;
    
    // Generate beautiful layout for the voucher
    elements.voucherContent.innerHTML = `
        <div class="voucher-logo-area">
            <div>
                <div class="voucher-firm-name">Caro & Sebastiani</div>
                <div class="voucher-firm-sub">Abogados & Corretaje de Propiedades</div>
            </div>
            <span class="voucher-tag">${tx.type === 'income' ? 'Ingreso' : 'Egreso'}</span>
        </div>
        
        <div class="voucher-amount-section">
            <div class="voucher-amount-label">Monto de la Operación</div>
            <div class="voucher-amount-value ${tx.type}">${tx.type === 'income' ? '+' : '-'}&nbsp;${formatCurrency(tx.amount)}</div>
        </div>
        
        <div class="voucher-meta-grid">
            <div class="voucher-meta-item">
                <span class="voucher-meta-label">ID Transacción</span>
                <span class="voucher-meta-value" style="font-family: monospace; font-size:0.75rem;">${tx.id}</span>
            </div>
            <div class="voucher-meta-item">
                <span class="voucher-meta-label">Fecha Pago/Cobro</span>
                <span class="voucher-meta-value">${formatDateString(tx.date)}</span>
            </div>
            <div class="voucher-meta-item">
                <span class="voucher-meta-label">Período Contable</span>
                <span class="voucher-meta-value">${formatPeriodString(tx.period)}</span>
            </div>
            <div class="voucher-meta-item">
                <span class="voucher-meta-label">Categoría</span>
                <span class="voucher-meta-value">${getCategoryLabel(tx.type, tx.category)}</span>
            </div>
            
            <div class="voucher-meta-item" style="grid-column: span 2;">
                <span class="voucher-meta-label">${tx.type === 'income' ? 'Cliente / Caso / Propiedad' : 'Concepto / Proveedor'}</span>
                <span class="voucher-meta-value" style="font-size: 0.95rem; font-weight: 700; color: var(--color-text-light);">${tx.reference}</span>
            </div>
            
            <div class="voucher-meta-item" style="grid-column: span 2;">
                <span class="voucher-meta-label">Estado de Transacción</span>
                <span class="voucher-meta-value" style="display:flex; margin-top: 4px;">
                    <span class="status-badge ${tx.status}">
                        <i data-lucide="${tx.status === 'paid' ? 'check-circle' : 'clock'}"></i>
                        ${tx.status === 'paid' ? 'Cobrado / Pagado' : 'Pendiente'}
                    </span>
                </span>
            </div>
        </div>
        
        ${tx.notes ? `
        <div class="voucher-notes-section">
            <span class="voucher-meta-label">Detalles / Notas</span>
            <p style="font-size: 0.8rem; color:var(--color-text-main); margin-top: 4px; line-height: 1.4;">${tx.notes}</p>
        </div>
        ` : ''}
        
        ${tx.attachment ? `
        <div class="voucher-attachment-preview-box">
            <span class="voucher-attachment-title">Comprobante Adjunto</span>
            ${tx.attachment.type.startsWith('image/') ? `
                <img src="${tx.attachment.data}" class="voucher-img-preview" alt="Comprobante">
            ` : `
                <div class="voucher-pdf-box">
                    <div class="voucher-pdf-info">
                        <i data-lucide="file-text"></i>
                        <span style="text-overflow: ellipsis; white-space: nowrap; overflow: hidden; max-width: 250px;">${tx.attachment.name}</span>
                    </div>
                    <a href="${tx.attachment.data}" download="${tx.attachment.name}" class="btn btn-secondary btn-icon no-print" title="Descargar PDF">
                        <i data-lucide="download"></i>
                    </a>
                </div>
            `}
        </div>
        ` : ''}
    `;
    
    // Open modal
    elements.voucherModal.classList.add('active');
    
    // Trigger Lucide rendering inside the voucher content
    lucide.createIcons({
        attrs: {
            'data-lucide': true
        },
        nameAttr: 'data-lucide',
        nodeList: elements.voucherContent.querySelectorAll('[data-lucide]')
    });
};

// --- 9. EXPORTING & BACKING UP ---
function exportToCSV() {
    if (transactions.length === 0) {
        showToast('No hay transacciones registradas para exportar.', 'error');
        return;
    }
    
    let csvContent = "Fecha_Pago;Periodo_Imputacion;Tipo;Categoria;Concepto;Monto;Estado;Notas\r\n";
    
    transactions.forEach(tx => {
        const catLabel = getCategoryLabel(tx.type, tx.category);
        const typeLabel = tx.type === 'income' ? 'Ingreso' : 'Gasto';
        const statusLabel = tx.status === 'paid' ? 'Pagado/Cobrado' : 'Pendiente';
        const sanitizedNotes = tx.notes ? tx.notes.replace(/;/g, ',').replace(/\n/g, ' ') : '';
        const sanitizedRef = tx.reference.replace(/;/g, ',').replace(/\n/g, ' ');
        
        const row = [
            tx.date,
            tx.period,
            typeLabel,
            catLabel,
            sanitizedRef,
            tx.amount,
            statusLabel,
            sanitizedNotes
        ].join(';');
        
        csvContent += row + "\r\n";
    });
    
    const filename = `Caro_Sebastiani_Finanzas_Export_${new Date().toISOString().substring(0,10)}.csv`;
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    openExportReminderModal('csv', csvContent, filename);
}

function clearAllTransactions() {
    if (!currentUser) return;
    if (confirm('¿Estás seguro de que deseas eliminar TODOS los datos registrados de este perfil? Esta acción no se puede deshacer.')) {
        const promises = transactions.map(tx => {
            return deleteDoc(doc(db, "transactions", tx.id));
        });
        Promise.all(promises)
            .then(() => {
                showToast('Todos los datos de este perfil han sido eliminados de la nube.', 'info');
            })
            .catch(err => {
                showToast('Error al eliminar datos de la nube.', 'error');
                console.error(err);
            });
    }
}

function exportToJSON() {
    if (transactions.length === 0) {
        showToast('No hay transacciones para respaldar.', 'error');
        return;
    }
    const dataStr = JSON.stringify(transactions, null, 2);
    const filename = `CS_Finanzas_Backup_${new Date().toISOString().substring(0,10)}.json`;
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    openExportReminderModal('json', dataStr, filename);
}

function importFromJSON(e) {
    if (!currentUser) return;
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const imported = JSON.parse(evt.target.result);
            if (Array.isArray(imported)) {
                const isValid = imported.every(tx => tx.id && tx.type && tx.amount && tx.reference);
                if (isValid) {
                    if (confirm(`Se importarán ${imported.length} transacciones. Esto sobrescribirá o agregará los datos en la nube. ¿Deseas continuar?`)) {
                        const promises = imported.map(tx => {
                            const finalId = tx.id || ('tx-' + Date.now() + Math.random().toString(36).substring(2, 7));
                            const txRef = doc(db, "transactions", finalId);
                            return setDoc(txRef, {
                                id: finalId,
                                userId: currentUser.uid,
                                profile: currentProfile,
                                type: tx.type,
                                category: tx.category,
                                date: tx.date,
                                period: tx.period || tx.date.substring(0, 7),
                                reference: tx.reference,
                                amount: tx.amount,
                                status: tx.status || 'paid',
                                notes: tx.notes || '',
                                attachment: tx.attachment || null
                            });
                        });
                        
                        Promise.all(promises)
                            .then(() => {
                                showToast('Respaldo restaurado con éxito en la nube.');
                            })
                            .catch(err => {
                                showToast('Error al importar datos en la nube.', 'error');
                                console.error(err);
                            });
                    }
                } else {
                    showToast('El archivo no tiene el formato de copia de seguridad válido.', 'error');
                }
            } else {
                showToast('Formato de archivo inválido.', 'error');
            }
        } catch (err) {
            showToast('Error al leer el archivo de respaldo.', 'error');
        }
        elements.inputImportJson.value = '';
    };
    reader.readAsText(file);
}

// --- 10. UTILITY TOAST NOTIFIER ---
let toastTimeout;
function showToast(message, type = 'success') {
    elements.toastMsg.textContent = message;
    
    const toastIcon = elements.toast.querySelector('.toast-icon');
    if (type === 'success') {
        toastIcon.setAttribute('data-lucide', 'check-circle');
        toastIcon.style.color = 'var(--color-income)';
    } else if (type === 'error') {
        toastIcon.setAttribute('data-lucide', 'alert-circle');
        toastIcon.style.color = 'var(--color-expense)';
    } else {
        toastIcon.setAttribute('data-lucide', 'info');
        toastIcon.style.color = 'var(--color-primary)';
    }
    
    lucide.createIcons({
        attrs: {
            'data-lucide': true
        },
        nameAttr: 'data-lucide',
        nodeList: [toastIcon]
    });
    
    elements.toast.classList.add('active');
    
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        elements.toast.classList.remove('active');
    }, 3500);
}

// --- 11. EXPORT REMINDER MODAL LOGIC ---
function openExportReminderModal(type, content, filename) {
    lastExportedData = { type, content, filename };
    elements.exportReminderModal.classList.add('active');
}

function closeExportReminderModal() {
    elements.exportReminderModal.classList.remove('active');
    lastExportedData = null;
}

function handleReminderEmail() {
    if (!lastExportedData) return;
    
    const subject = encodeURIComponent(`Respaldo de Finanzas - Caro & Sebastiani (${lastExportedData.type.toUpperCase()})`);
    const body = encodeURIComponent(
        `Hola,\n\n` +
        `Adjunto el archivo de respaldo de finanzas "${lastExportedData.filename}" generado el día de hoy.\n\n` +
        `⚠️ [RECUERDA ADJUNTAR EL ARCHIVO DESCARGADO ANTES DE ENVIAR ESTE CORREO] 📎\n\n` +
        `Saludos,\n` +
        `Control de Finanzas`
    );
    
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    closeExportReminderModal();
}

function handleReminderCopy() {
    if (!lastExportedData) return;
    
    navigator.clipboard.writeText(lastExportedData.content)
        .then(() => {
            showToast('¡Datos copiados al portapapeles! 📋');
            closeExportReminderModal();
        })
        .catch(err => {
            showToast('Error al copiar al portapapeles.', 'error');
        });
}

function setupExportReminderControls() {
    elements.btnCloseReminder.addEventListener('click', closeExportReminderModal);
    elements.btnCloseReminderFoot.addEventListener('click', closeExportReminderModal);
    elements.btnReminderEmail.addEventListener('click', handleReminderEmail);
    elements.btnReminderCopy.addEventListener('click', handleReminderCopy);
    elements.exportReminderModal.addEventListener('click', (e) => {
        if (e.target === elements.exportReminderModal) closeExportReminderModal();
    });
}

function setupAuthControls() {
    // Handle Login Form Submit
    elements.loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = elements.loginEmail.value.trim();
        const password = elements.loginPassword;
        
        elements.loginErrorMsg.textContent = 'Autenticando...';
        
        signInWithEmailAndPassword(auth, email, password.value)
            .then(() => {
                showToast('¡Sesión iniciada con éxito!');
            })
            .catch((error) => {
                console.error("Login error:", error);
                let message = 'Correo o contraseña incorrectos.';
                if (error.code === 'auth/invalid-credential') {
                    message = 'Credenciales inválidas. Por favor intenta de nuevo.';
                } else if (error.code === 'auth/user-not-found') {
                    message = 'Usuario no registrado.';
                } else if (error.code === 'auth/wrong-password') {
                    message = 'Contraseña incorrecta.';
                }
                elements.loginErrorMsg.textContent = message;
            });
    });
    
    // Handle Logout Click
    elements.btnLogout.addEventListener('click', (e) => {
        e.preventDefault();
        signOut(auth)
            .then(() => {
                showToast('Sesión cerrada correctamente.', 'info');
            })
            .catch((error) => {
                showToast('Error al cerrar sesión.', 'error');
            });
    });
    
    // Handle Profile Switcher Buttons Click
    elements.profileSwitchEmpresa.addEventListener('click', () => switchProfile('empresa'));
    elements.profileSwitchPersonal.addEventListener('click', () => switchProfile('personal'));
}

function switchProfile(profile) {
    if (currentProfile === profile) return;
    currentProfile = profile;
    localStorage.setItem('cs_finanzas_current_profile', profile);
    
    setActiveProfileUI(profile);
    
    // Re-subscribe to Firestore with the new profile!
    subscribeToTransactions();
}

function setActiveProfileUI(profile) {
    if (profile === 'empresa') {
        elements.profileSwitchEmpresa.classList.add('active');
        elements.profileSwitchPersonal.classList.remove('active');
        elements.drawerSwitchEmpresa.classList.add('active');
        elements.drawerSwitchPersonal.classList.remove('active');
        document.body.classList.remove('personal-theme');
        
        elements.currentTitle.textContent = 'Panel de Control - Empresa';
        elements.currentSubtitle.textContent = 'Bienvenido, aquí está el resumen financiero de la oficina.';
    } else {
        elements.profileSwitchPersonal.classList.add('active');
        elements.profileSwitchEmpresa.classList.remove('active');
        elements.drawerSwitchPersonal.classList.add('active');
        elements.drawerSwitchEmpresa.classList.remove('active');
        document.body.classList.add('personal-theme');
        
        elements.currentTitle.textContent = 'Panel de Control - Personal';
        elements.currentSubtitle.textContent = 'Aquí está el resumen de tus finanzas personales.';
    }
}

function subscribeToTransactions() {
    if (!currentUser) return;
    
    // Clean up old listener
    if (unsubscribeTransactions) {
        unsubscribeTransactions();
    }
    
    // We query where userId == currentUser.uid AND profile == currentProfile
    const q = query(
        collection(db, "transactions"),
        where("userId", "==", currentUser.uid),
        where("profile", "==", currentProfile)
    );
    
    unsubscribeTransactions = onSnapshot(q, (snapshot) => {
        transactions = [];
        snapshot.forEach((docSnap) => {
            transactions.push(docSnap.data());
        });
        
        // Sort transactions by date descending
        transactions.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
        
        updateUI();
    }, (error) => {
        console.error("Error listening to transactions: ", error);
        showToast("Error al sincronizar datos.", "error");
    });
}

// Global Auth State Observer and Branding Manager
async function applyUserBranding(user) {
    const loginLogoTitle = document.getElementById('login-logo-title');
    const loginLogoSubtitle = document.getElementById('login-logo-subtitle');
    const sidebarLogoTitle = document.getElementById('sidebar-logo-title');
    const sidebarLogoSubtitle = document.getElementById('sidebar-logo-subtitle');

    let officeName = "Caro & Sebastiani";
    let specialty = "Finanzas";
    let themeClass = "theme-laboral";
    let tabTitle = "Caro & Sebastiani Finanzas | Control de Finanzas de Abogados & Corretaje";

    if (user) {
        try {
            // 1. Intentar obtener de Firestore
            const profileDocRef = doc(db, "users", user.uid, "settings", "profile");
            const profileSnap = await getDoc(profileDocRef);
            
            if (profileSnap.exists()) {
                const profileData = profileSnap.data();
                officeName = profileData.officeName || officeName;
                specialty = profileData.specialty || specialty;
                themeClass = profileData.themeClass || themeClass;
                tabTitle = `${officeName} Finanzas | Control de Finanzas`;
            } else {
                // 2. Si no existe, auto-provisionar según correo
                const emailLower = user.email.toLowerCase();
                if (emailLower === "defensa@abogadossanbernardo.cl") {
                    officeName = "Sebastiani & Puga";
                    specialty = "Finanzas";
                    themeClass = "theme-penal";
                } else {
                    officeName = "Caro & Sebastiani";
                    specialty = "Finanzas";
                    themeClass = "theme-laboral";
                }
                tabTitle = `${officeName} Finanzas | Control de Finanzas`;

                // 3. Guardar en Firestore
                await setDoc(profileDocRef, {
                    officeName: officeName,
                    specialty: specialty,
                    themeClass: themeClass,
                    createdAt: new Date().toISOString()
                });
                console.log("Perfil de marca de finanzas auto-provisionado en Firestore para:", user.email);
            }
        } catch (err) {
            console.error("Error al cargar marca de finanzas:", err);
            // Fallback local
            const emailLower = (user.email || "").toLowerCase();
            if (emailLower === "defensa@abogadossanbernardo.cl") {
                officeName = "Sebastiani & Puga";
                specialty = "Finanzas";
                themeClass = "theme-penal";
            }
            tabTitle = `${officeName} Finanzas | Control de Finanzas`;
        }
    } else {
        // Neutro al cerrar sesión
        if (loginLogoTitle) loginLogoTitle.textContent = "Control de Finanzas";
        if (loginLogoSubtitle) loginLogoSubtitle.textContent = "Ingrese sus credenciales para acceder";
        
        if (sidebarLogoTitle) sidebarLogoTitle.textContent = "Caro & Sebastiani";
        if (sidebarLogoSubtitle) sidebarLogoSubtitle.textContent = "Finanzas";
        
        document.body.className = "dark-theme"; // Clase por defecto
        document.title = "Caro & Sebastiani Finanzas | Control de Finanzas de Abogados & Corretaje";
        return;
    }

    // Actualizar elementos DOM
    if (sidebarLogoTitle) sidebarLogoTitle.textContent = officeName;
    if (sidebarLogoSubtitle) sidebarLogoSubtitle.textContent = specialty;
    
    if (loginLogoTitle) loginLogoTitle.textContent = officeName;
    if (loginLogoSubtitle) loginLogoSubtitle.textContent = `Control de ${specialty}`;
    
    document.title = tabTitle;

    // Aplicar temas
    document.body.classList.remove('theme-penal', 'theme-laboral');
    document.body.classList.add(themeClass);
}

// Global Auth State Observer
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        elements.loginOverlay.classList.remove('active');
        elements.loginErrorMsg.textContent = '';
        elements.loginForm.reset();
        
        // Aplicar marca dinámica del usuario
        await applyUserBranding(user);

        // Update user display
        elements.userDisplayEmail.textContent = user.email;
        elements.drawerUserEmail.textContent = user.email;
        const initials = user.email.substring(0, 2).toUpperCase();
        elements.userAvatarInitials.textContent = initials;
        elements.drawerAvatarInitials.textContent = initials;
        
        const savedProfile = localStorage.getItem('cs_finanzas_current_profile');
        if (savedProfile) {
            currentProfile = savedProfile;
        } else {
            currentProfile = 'empresa';
        }
        
        setActiveProfileUI(currentProfile);
        
        // Start listening to transactions in Firestore
        subscribeToTransactions();
    } else {
        currentUser = null;
        if (unsubscribeTransactions) {
            unsubscribeTransactions();
            unsubscribeTransactions = null;
        }
        transactions = [];
        updateUI();
        
        // Limpiar marca dinámica
        await applyUserBranding(null);

        elements.loginOverlay.classList.add('active');
        elements.userDisplayEmail.textContent = 'No conectado';
        elements.drawerUserEmail.textContent = 'No conectado';
        elements.userAvatarInitials.textContent = '?';
        elements.drawerAvatarInitials.textContent = '?';
    }
});

function setupMobileControls() {
    const openDrawer = () => {
        elements.mobileDrawer.classList.add('active');
    };
    
    const closeDrawer = () => {
        elements.mobileDrawer.classList.remove('active');
    };
    
    // Toggle menu button opens drawer
    elements.btnMenuToggle.addEventListener('click', openDrawer);
    
    // Close button and overlay close drawer
    elements.btnCloseDrawer.addEventListener('click', closeDrawer);
    elements.mobileDrawerOverlay.addEventListener('click', closeDrawer);
    
    // Floating Add button on mobile opens transaction modal
    elements.btnMobileAdd.addEventListener('click', () => {
        openModal(false);
    });
    
    // Profile Switchers inside Drawer
    elements.drawerSwitchEmpresa.addEventListener('click', () => {
        switchProfile('empresa');
        closeDrawer();
    });
    elements.drawerSwitchPersonal.addEventListener('click', () => {
        switchProfile('personal');
        closeDrawer();
    });
    
    // Drawer Logout button
    elements.btnDrawerLogout.addEventListener('click', (e) => {
        e.preventDefault();
        signOut(auth)
            .then(() => {
                showToast('Sesión cerrada correctamente.', 'info');
                closeDrawer();
            })
            .catch((error) => {
                showToast('Error al cerrar sesión.', 'error');
            });
    });
}
