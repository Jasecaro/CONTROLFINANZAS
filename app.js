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
        // 1. Corretaje Inmobiliario
        { value: 'brokerage-administration', label: 'Administración de Propiedades', group: 'Corretaje Inmobiliario', order: 1 },
        { value: 'brokerage-rental', label: 'Comisión por Arriendo', group: 'Corretaje Inmobiliario', order: 2 },
        { value: 'brokerage-sale', label: 'Comisión por Venta', group: 'Corretaje Inmobiliario', order: 3 },
        
        // 2. Servicios Jurídicos & Judicial
        { value: 'judicial-consultancy', label: 'Asesoría / Consultoría Mensual', group: 'Servicios Jurídicos & Judicial', order: 10 },
        { value: 'judicial-litigation', label: 'Honorarios de Litigio', group: 'Servicios Jurídicos & Judicial', order: 11 },
        { value: 'judicial-notary', label: 'Trámites Notariales', group: 'Servicios Jurídicos & Judicial', order: 12 }
    ],
    expense: [
        // 1. Servicios Básicos & Arriendo
        { value: 'expense-luz', label: 'Servicio de Luz', group: 'Servicios Básicos & Arriendo', order: 1 },
        { value: 'expense-agua', label: 'Servicio de Agua', group: 'Servicios Básicos & Arriendo', order: 2 },
        { value: 'expense-internet', label: 'Internet & Telecomunicaciones', group: 'Servicios Básicos & Arriendo', order: 3 },
        { value: 'expense-rent', label: 'Arriendo de Oficina', group: 'Servicios Básicos & Arriendo', order: 4 },
        
        // 2. Personal & Sueldos
        { value: 'expense-salaries', label: 'Sueldos & Honorarios', group: 'Personal & Sueldos', order: 10 },
        
        // 3. Operaciones & Suministros
        { value: 'expense-supplies', label: 'Suministros e Imprenta', group: 'Operaciones & Suministros', order: 20 },
        
        // 4. Marketing & Publicidad
        { value: 'expense-marketing', label: 'Publicidad & Marketing', group: 'Marketing & Publicidad', order: 30 },
        
        // 5. Impuestos & Tributario
        { value: 'expense-taxes', label: 'Impuestos & Contribuciones', group: 'Impuestos & Tributario', order: 40 },
        
        // 6. Otros Gastos
        { value: 'expense-other', label: 'Otros Gastos', group: 'Otros Gastos', order: 99 }
    ]
};

// State
let transactions = [];
let charts = {};
let currentAttachment = null; // Local state for file uploads
let lastExportedData = null; // Stores last export content for sharing

// DOM Elements (Dynamic Getters for 100% Reliable Element Resolution)
const elements = {
    get navBtns() { return document.querySelectorAll('.nav-btn, .mobile-nav-btn[data-view]'); },
    get views() { return document.querySelectorAll('.app-view'); },
    get currentTitle() { return document.getElementById('page-current-title'); },
    get currentSubtitle() { return document.getElementById('header-current-subtitle'); },
    get currentDateText() { return document.getElementById('current-date-text'); },
    
    get dashboardPeriodSelect() { return document.getElementById('dashboard-period-select'); },
    
    get valNetBalance() { return document.getElementById('val-net-balance'); },
    get valIncomeJudicial() { return document.getElementById('val-income-judicial'); },
    get valIncomeBrokerage() { return document.getElementById('val-income-brokerage'); },
    get valTotalExpenses() { return document.getElementById('val-total-expenses'); },
    get lblBalanceTrend() { return document.getElementById('lbl-balance-trend'); },
    get lblJudicialCount() { return document.getElementById('lbl-judicial-count'); },
    get lblBrokerageCount() { return document.getElementById('lbl-brokerage-count'); },
    get lblExpensesCount() { return document.getElementById('lbl-expenses-count'); },
    
    get tableRecentBody() { return document.getElementById('table-recent-body'); },
    get btnGoTransactions() { return document.querySelector('.btn-go-transactions'); },
    
    get tableTransactionsBody() { return document.getElementById('table-transactions-body'); },
    get tableEmptyState() { return document.getElementById('table-empty-state'); },
    get mainTransactionsTable() { return document.getElementById('main-transactions-table'); },
    get filterSearch() { return document.getElementById('filter-search'); },
    get filterType() { return document.getElementById('filter-type'); },
    get filterCategory() { return document.getElementById('filter-category'); },
    get filterStatus() { return document.getElementById('filter-status'); },
    get filterMonth() { return document.getElementById('filter-month'); },
    get btnExportCsv() { return document.getElementById('btn-export-csv'); },
    get btnExportExcel() { return document.getElementById('btn-export-excel'); },
    get btnClonePrevMonth() { return document.getElementById('btn-clone-prev-month'); },
    get btnExportReportsExcel() { return document.getElementById('btn-export-reports-excel'); },
    get btnPrintReportsPdf() { return document.getElementById('btn-print-reports-pdf'); },
    get btnEmptyAdd() { return document.getElementById('btn-empty-add'); },
    get btnClearAll() { return document.getElementById('btn-clear-all'); },
    get btnExportJson() { return document.getElementById('btn-export-json'); },
    get btnImportJson() { return document.getElementById('btn-import-json'); },
    get inputImportJson() { return document.getElementById('input-import-json'); },
    
    get reportsPdfModal() { return document.getElementById('reports-pdf-modal'); },
    get reportsPdfPrintableArea() { return document.getElementById('reports-pdf-printable-area'); },
    get reportsPdfPeriodSelect() { return document.getElementById('reports-pdf-period-select'); },
    get btnCloseReportsPdf() { return document.getElementById('btn-close-reports-pdf'); },
    get btnCloseReportsPdfFoot() { return document.getElementById('btn-close-reports-pdf-foot'); },
    get btnDoPrintPdf() { return document.getElementById('btn-do-print-pdf'); },

    get btnOpenBatchIncomes() { return document.getElementById('btn-open-batch-incomes'); },
    get btnOpenBatchIncomesSidebar() { return document.getElementById('btn-open-batch-incomes-sidebar'); },
    get batchIncomesModal() { return document.getElementById('batch-incomes-modal'); },
    get batchIncomeMonthInput() { return document.getElementById('batch-income-month-input'); },
    get batchIncomesTbody() { return document.getElementById('batch-incomes-tbody'); },
    get batchIncomeTotalSummary() { return document.getElementById('batch-income-total-summary'); },
    get batchIncomeSelectAll() { return document.getElementById('batch-income-select-all'); },
    get btnReloadBatchIncomeTemplate() { return document.getElementById('btn-reload-batch-income-template'); },
    get btnAddBatchIncomeRow() { return document.getElementById('btn-add-batch-income-row'); },
    get btnCloseBatchIncomeModal() { return document.getElementById('btn-close-batch-income-modal'); },
    get btnCancelBatchIncomeModal() { return document.getElementById('btn-cancel-batch-income-modal'); },
    get btnSaveBatchIncomes() { return document.getElementById('btn-save-batch-incomes'); },

    get btnOpenBatchExpenses() { return document.getElementById('btn-open-batch-expenses'); },
    get btnOpenBatchExpensesSidebar() { return document.getElementById('btn-open-batch-expenses-sidebar'); },
    get batchExpensesModal() { return document.getElementById('batch-expenses-modal'); },
    get batchMonthInput() { return document.getElementById('batch-month-input'); },
    get batchExpensesTbody() { return document.getElementById('batch-expenses-tbody'); },
    get batchTotalSummary() { return document.getElementById('batch-total-summary'); },
    get batchSelectAll() { return document.getElementById('batch-select-all'); },
    get btnReloadBatchTemplate() { return document.getElementById('btn-reload-batch-template'); },
    get btnAddBatchRow() { return document.getElementById('btn-add-batch-row'); },
    get btnCloseBatchModal() { return document.getElementById('btn-close-batch-modal'); },
    get btnCancelBatchModal() { return document.getElementById('btn-cancel-batch-modal'); },
    get btnSaveBatchExpenses() { return document.getElementById('btn-save-batch-expenses'); },
    
    get valProfitMargin() { return document.getElementById('val-profit-margin'); },
    get valPendingCollect() { return document.getElementById('val-pending-collect'); },
    get lblPendingCount() { return document.getElementById('lbl-pending-count'); },
    get valAvgMonthlyIncome() { return document.getElementById('val-avg-monthly-income'); },
    get tableSummaryBody() { return document.getElementById('table-summary-body'); },
    
    get btnOpenModal() { return document.getElementById('btn-open-modal'); },
    get btnCloseModal() { return document.getElementById('btn-close-modal'); },
    get btnCancelModal() { return document.getElementById('btn-cancel-modal'); },
    get modalOverlay() { return document.getElementById('transaction-modal'); },
    get modalTitle() { return document.getElementById('modal-title'); },
    get form() { return document.getElementById('transaction-form'); },
    get formTxId() { return document.getElementById('form-tx-id'); },
    get formTypeRadios() { return document.querySelectorAll('input[name="tx-type"]'); },
    get formCategorySelect() { return document.getElementById('form-category'); },
    get formDate() { return document.getElementById('form-date'); },
    get formPeriod() { return document.getElementById('form-period'); },
    get formReference() { return document.getElementById('form-reference'); },
    get formReferenceLabel() { return document.getElementById('form-reference-label'); },
    get formAmount() { return document.getElementById('form-amount'); },
    get formStatus() { return document.getElementById('form-status'); },
    get formNotes() { return document.getElementById('form-notes'); },
    
    get formAttachment() { return document.getElementById('form-attachment'); },
    get formAttachmentPreview() { return document.getElementById('form-attachment-preview'); },
    get formAttachmentName() { return document.getElementById('form-attachment-name'); },
    get btnRemoveAttachment() { return document.getElementById('btn-remove-attachment'); },
    
    get voucherModal() { return document.getElementById('voucher-modal'); },
    get voucherContent() { return document.getElementById('voucher-content'); },
    get btnPrintVoucher() { return document.getElementById('btn-print-voucher'); },
    get btnCloseVoucher() { return document.getElementById('btn-close-voucher'); },
    get btnCloseVoucherFoot() { return document.getElementById('btn-close-voucher-foot'); },
    
    get toast() { return document.getElementById('app-toast'); },
    get toastMsg() { return document.querySelector('.toast-message'); },

    get exportReminderModal() { return document.getElementById('export-reminder-modal'); },
    get btnCloseReminder() { return document.getElementById('btn-close-reminder'); },
    get btnCloseReminderFoot() { return document.getElementById('btn-close-reminder-foot'); },
    get btnReminderEmail() { return document.getElementById('btn-reminder-email'); },
    get btnReminderCopy() { return document.getElementById('btn-reminder-copy'); },

    get loginOverlay() { return document.getElementById('login-overlay'); },
    get loginForm() { return document.getElementById('login-form'); },
    get loginEmail() { return document.getElementById('login-email'); },
    get loginPassword() { return document.getElementById('login-password'); },
    get loginErrorMsg() { return document.getElementById('login-error-msg'); },
    get userDisplayEmail() { return document.getElementById('user-display-email'); },
    get userAvatarInitials() { return document.getElementById('user-avatar-initials'); },
    get btnLogout() { return document.getElementById('btn-logout'); },
    get profileSwitchEmpresa() { return document.getElementById('profile-switch-empresa'); },
    get profileSwitchPersonal() { return document.getElementById('profile-switch-personal'); },

    get btnMobileAdd() { return document.getElementById('btn-mobile-add'); },
    get btnMenuToggle() { return document.getElementById('mobile-nav-menu-toggle'); },
    get mobileDrawer() { return document.getElementById('mobile-drawer'); },
    get btnCloseDrawer() { return document.getElementById('btn-close-drawer'); },
    get mobileDrawerOverlay() { return document.getElementById('mobile-drawer-overlay'); },
    get drawerSwitchEmpresa() { return document.getElementById('drawer-switch-empresa'); },
    get drawerSwitchPersonal() { return document.getElementById('drawer-switch-personal'); },
    get drawerUserEmail() { return document.getElementById('drawer-user-email'); },
    get drawerAvatarInitials() { return document.getElementById('drawer-avatar-initials'); },
    get btnDrawerLogout() { return document.getElementById('btn-drawer-logout'); }
};

// --- 2. INITIALIZATION & STORAGE ---
document.addEventListener('DOMContentLoaded', () => {
    // --- GLOBAL EVENT DELEGATION (catches ALL button clicks by ID) ---
    document.body.addEventListener('click', (e) => {
        const btn = e.target.closest('[id]');
        if (!btn) return;
        const id = btn.id;

        if (id === 'btn-open-batch-incomes' || id === 'btn-open-batch-incomes-sidebar' || id === 'drawer-btn-batch-incomes') {
            elements.mobileDrawer?.classList.remove('active');
            openBatchIncomesModal();
        } else if (id === 'btn-close-batch-income-modal' || id === 'btn-cancel-batch-income-modal') {
            closeBatchIncomesModal();
        } else if (id === 'btn-save-batch-incomes') {
            saveBatchIncomes();
        } else if (id === 'btn-add-batch-income-row') {
            addBatchIncomeRow();
        } else if (id === 'btn-reload-batch-income-template') {
            const mi = document.getElementById('batch-income-month-input');
            populateBatchIncomesTable(mi ? mi.value : new Date().toISOString().substring(0, 7));
        } else if (id === 'btn-open-batch-expenses' || id === 'btn-open-batch-expenses-sidebar' || id === 'drawer-btn-batch-expenses') {
            elements.mobileDrawer?.classList.remove('active');
            openBatchExpensesModal();
        } else if (id === 'btn-close-batch-modal' || id === 'btn-cancel-batch-modal') {
            closeBatchExpensesModal();
        } else if (id === 'btn-save-batch-expenses') {
            saveBatchExpenses();
        } else if (id === 'btn-add-batch-row') {
            addBatchExpenseRow();
        } else if (id === 'btn-reload-batch-template') {
            const mi = document.getElementById('batch-month-input');
            populateBatchExpensesTable(mi ? mi.value : new Date().toISOString().substring(0, 7));
        } else if (id === 'btn-do-print-pdf') {
            printReportPdf();
        } else if (id === 'btn-open-modal') {
            openModal(false);
        } else if (id === 'btn-empty-add') {
            openModal(false);
        } else if (id === 'btn-close-modal' || id === 'btn-cancel-modal') {
            closeModal();
        } else if (id === 'btn-mobile-add') {
            openModal(false);
        }
    });

    initApp();
});

function initApp() {
    try { setupHeaderDate(); } catch(e) { console.warn('setupHeaderDate error:', e); }
    
    // Set up Authentication Controls — siempre primero
    try { setupAuthControls(); } catch(e) { console.error('setupAuthControls error:', e); }
    
    // Set up Navigation
    try { setupNavigation(); } catch(e) { console.warn('setupNavigation error:', e); }
    
    // Set up Form Selects & Event Listeners
    try { setupFormControls(); } catch(e) { console.warn('setupFormControls error:', e); }
    
    // Setup Filter Listeners
    try { setupFilters(); } catch(e) { console.warn('setupFilters error:', e); }
    
    // Setup Export Reminder Modal Controls
    try { setupExportReminderControls(); } catch(e) { console.warn('setupExportReminderControls error:', e); }
    
    // Setup Mobile Navigation & Drawer Controls
    try { setupMobileControls(); } catch(e) { console.warn('setupMobileControls error:', e); }
    
    // Initial Render of everything
    try { updateUI(); } catch(e) { console.warn('updateUI error:', e); }
    
    // Initialize Lucide Icons
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function setupHeaderDate() {
    const el = elements.currentDateText;
    if (!el) return;
    const today = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateFormatted = today.toLocaleDateString('es-ES', options);
    el.textContent = dateFormatted.charAt(0).toUpperCase() + dateFormatted.slice(1);
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

// Helper: safe HTML escaping
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Helper: get sorting order of an expense category
function getExpenseCategoryOrder(catValue) {
    const found = CATEGORIES.expense.find(c => c.value === catValue);
    return found ? (found.order || 50) : 100;
}

// Helper: get group name of an expense category
function getExpenseCategoryGroup(catValue) {
    const found = CATEGORIES.expense.find(c => c.value === catValue);
    return found ? found.group : 'Otros Gastos';
}

// Helper: get sorting order of an income category
function getIncomeCategoryOrder(catValue) {
    const found = CATEGORIES.income.find(c => c.value === catValue);
    return found ? (found.order || 50) : 100;
}

// Helper: get group name of an income category
function getIncomeCategoryGroup(catValue) {
    const found = CATEGORIES.income.find(c => c.value === catValue);
    return found ? found.group : 'Otros Ingresos';
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
                    <button class="btn btn-secondary btn-icon" onclick="duplicateTx('${tx.id}')" title="Duplicar / Repetir Transacción">
                        <i data-lucide="copy"></i>
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
    // Only render charts if dashboard or reports view is currently active in the DOM
    const dashboardView = document.getElementById('view-dashboard');
    const reportsView = document.getElementById('view-reports');
    const isDashActive = dashboardView && dashboardView.classList.contains('active');
    const isReportsActive = reportsView && reportsView.classList.contains('active');
    if (!isDashActive && !isReportsActive) return;

    Object.keys(charts).forEach(key => {
        if (charts[key]) {
            try { charts[key].destroy(); } catch(e) {}
            charts[key] = null;
        }
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
    if (!elements.modalOverlay) return;
    elements.modalOverlay.classList.add('active');
    
    const checkedRadio = document.querySelector('input[name="tx-type"]:checked');
    const typeChecked = checkedRadio ? checkedRadio.value : 'income';
    populateFormCategories(typeChecked);
    
    // Reset attachments preview
    currentAttachment = null;
    if (elements.formAttachment) elements.formAttachment.value = '';
    if (elements.formAttachmentPreview) elements.formAttachmentPreview.style.display = 'none';
    if (elements.formAttachmentName) elements.formAttachmentName.textContent = '';
    
    if (!editMode) {
        if (elements.modalTitle) elements.modalTitle.textContent = 'Registrar Nueva Transacción';
        if (elements.formTxId) elements.formTxId.value = '';
        if (elements.form) elements.form.reset();
        
        updateTypeSelectorCardUI('income');
        populateFormCategories('income');
        
        const todayStr = new Date().toISOString().split('T')[0];
        if (elements.formDate) elements.formDate.value = todayStr;
        if (elements.formPeriod) elements.formPeriod.value = todayStr.substring(0, 7);
        
        if (elements.formStatus) elements.formStatus.value = 'paid';
    }
}

function closeModal() {
    if (elements.modalOverlay) elements.modalOverlay.classList.remove('active');
    if (elements.form) elements.form.reset();
}

function setupFormControls() {
    // Open triggers
    elements.btnOpenModal?.addEventListener('click', () => openModal(false));
    elements.btnEmptyAdd?.addEventListener('click', () => openModal(false));
    
    // Close triggers
    elements.btnCloseModal?.addEventListener('click', closeModal);
    elements.btnCancelModal?.addEventListener('click', closeModal);
    elements.modalOverlay?.addEventListener('click', (e) => {
        if (e.target === elements.modalOverlay) closeModal();
    });
    
    // Auto-update imputation period when transaction date changes!
    elements.formDate?.addEventListener('change', (e) => {
        if (e.target.value && elements.formPeriod) {
            elements.formPeriod.value = e.target.value.substring(0, 7);
        }
    });
    
    // Handle toggle Income / Expense in Form
    elements.formTypeRadios?.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const val = e.target.value;
            updateTypeSelectorCardUI(val);
            populateFormCategories(val);
            
            if (val === 'income') {
                if (elements.formReferenceLabel) elements.formReferenceLabel.innerHTML = 'Cliente o Caso Judicial / Propiedad <span class="required">*</span>';
                if (elements.formReference) elements.formReference.placeholder = 'Nombre del cliente, número de causa o dirección de propiedad...';
                if (elements.formStatus?.options?.[0]) elements.formStatus.options[0].text = 'Cobrado / Pagado';
            } else {
                if (elements.formReferenceLabel) elements.formReferenceLabel.innerHTML = 'Detalle de Proveedor / Concepto Gasto <span class="required">*</span>';
                if (elements.formReference) elements.formReference.placeholder = 'Luz S.A., Aguas Andinas, VTR, Papelería central...';
                if (elements.formStatus?.options?.[0]) elements.formStatus.options[0].text = 'Pagado';
            }
        });
    });
    
    // --- ATTACHMENT UPLOAD TRIGGER & READER ---
    elements.formAttachment?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        if (file.size > 1024 * 1024) {
            showToast('El archivo supera el límite de 1MB. Por favor, sube un archivo más ligero.', 'error');
            if (elements.formAttachment) elements.formAttachment.value = '';
            if (elements.formAttachmentPreview) elements.formAttachmentPreview.style.display = 'none';
            if (elements.formAttachmentName) elements.formAttachmentName.textContent = '';
            currentAttachment = null;
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(evt) {
            currentAttachment = {
                name: file.name,
                type: file.type,
                data: evt.target.result
            };
            if (elements.formAttachmentName) elements.formAttachmentName.textContent = file.name;
            if (elements.formAttachmentPreview) elements.formAttachmentPreview.style.display = 'flex';
            showToast('Comprobante cargado correctamente.');
        };
        reader.readAsDataURL(file);
    });
    
    // Remove attachment button
    elements.btnRemoveAttachment?.addEventListener('click', () => {
        currentAttachment = null;
        if (elements.formAttachment) elements.formAttachment.value = '';
        if (elements.formAttachmentPreview) elements.formAttachmentPreview.style.display = 'none';
        if (elements.formAttachmentName) elements.formAttachmentName.textContent = '';
        showToast('Comprobante removido.', 'info');
    });
    
    // --- CLIPBOARD PASTE (Ctrl+V) SCREENSHOT SUPPORT ---
    elements.form?.addEventListener('paste', (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let index in items) {
            const item = items[index];
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                const blob = item.getAsFile();
                
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
                        data: evt.target.result
                    };
                    
                    if (elements.formAttachmentName) elements.formAttachmentName.textContent = fileName;
                    if (elements.formAttachmentPreview) elements.formAttachmentPreview.style.display = 'flex';
                    showToast('Pantallazo pegado correctamente desde el portapapeles.');
                };
                reader.readAsDataURL(blob);
                
                e.preventDefault();
                break;
            }
        }
    });
    
    // --- VOUCHER CLOSE EVENTS ---
    const closeVoucher = () => {
        if (elements.voucherModal) elements.voucherModal.classList.remove('active');
        if (elements.voucherContent) elements.voucherContent.innerHTML = '';
    };
    
    elements.btnCloseVoucher?.addEventListener('click', closeVoucher);
    elements.btnCloseVoucherFoot?.addEventListener('click', closeVoucher);
    elements.voucherModal?.addEventListener('click', (e) => {
        if (e.target === elements.voucherModal) closeVoucher();
    });
    
    // Printer trigger
    elements.btnPrintVoucher?.addEventListener('click', () => {
        window.print();
    });
    
    // Form Submission
    elements.form?.addEventListener('submit', (e) => {
        e.preventDefault();
        saveFormTx();
    });
}

function updateTypeSelectorCardUI(activeType) {
    const cardIncome = document.querySelector('.type-selector-card.type-income');
    const cardExpense = document.querySelector('.type-selector-card.type-expense');
    if (!cardIncome || !cardExpense) return;
    
    if (activeType === 'income') {
        cardIncome.classList.add('active');
        cardExpense.classList.remove('active');
    } else {
        cardExpense.classList.add('active');
        cardIncome.classList.remove('active');
    }
}

function populateFormCategories(type, selectVal = '') {
    if (!elements.formCategorySelect) return;
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

window.duplicateTx = function(id) {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;
    
    openModal(false);
    elements.modalTitle.textContent = 'Duplicar / Repetir Transacción';
    
    elements.formTypeRadios.forEach(radio => {
        if (radio.value === tx.type) {
            radio.checked = true;
        }
    });
    updateTypeSelectorCardUI(tx.type);
    populateFormCategories(tx.type, tx.category);
    
    const today = new Date();
    const todayStr = today.toISOString().substring(0, 10);
    const periodStr = todayStr.substring(0, 7);
    
    elements.formDate.value = todayStr;
    elements.formPeriod.value = periodStr;
    elements.formReference.value = tx.reference;
    elements.formAmount.value = tx.amount;
    elements.formStatus.value = tx.status || 'paid';
    elements.formNotes.value = tx.notes ? `${tx.notes} (Recurrente)` : 'Transacción duplicada / recurrente';
    
    showToast('Datos precargados. Revisa el monto o fecha y presiona Registrar.');
};

function duplicatePreviousMonthExpenses() {
    if (!currentUser) {
        showToast('Debes iniciar sesión para duplicar gastos.', 'error');
        return;
    }
    
    const today = new Date();
    const currentPeriod = today.toISOString().substring(0, 7);
    
    const profileExpenses = transactions.filter(t => 
        t.type === 'expense' && 
        (t.profile === currentProfile || !t.profile)
    );

    const periodsWithExpenses = Array.from(new Set(
        profileExpenses
            .map(t => t.period || (t.date ? t.date.substring(0, 7) : ''))
            .filter(Boolean)
    )).sort();

    const priorPeriods = periodsWithExpenses.filter(p => p < currentPeriod);
    
    if (priorPeriods.length === 0) {
        showToast(`No se encontraron gastos registrados en meses anteriores para clonar.`, 'error');
        return;
    }
    
    const prevPeriod = priorPeriods[priorPeriods.length - 1];
    const prevExpenses = profileExpenses.filter(t => (t.period === prevPeriod || (!t.period && t.date?.substring(0, 7) === prevPeriod)));
    
    if (prevExpenses.length === 0) {
        showToast(`No se encontraron gastos registrados en ${formatPeriodString(prevPeriod)}.`, 'error');
        return;
    }
    
    const currentExpensesRefs = transactions
        .filter(t => (t.period === currentPeriod || (!t.period && t.date?.substring(0, 7) === currentPeriod)) && t.type === 'expense' && (t.profile === currentProfile || !t.profile))
        .map(t => (t.reference || '').toLowerCase().trim());
        
    const expensesToClone = prevExpenses.filter(t => !currentExpensesRefs.includes((t.reference || '').toLowerCase().trim()));
    
    if (expensesToClone.length === 0) {
        showToast(`Los gastos de ${formatPeriodString(prevPeriod)} ya están registrados en el mes actual (${formatPeriodString(currentPeriod)}).`, 'info');
        return;
    }
    
    const expenseSummaryText = expensesToClone.map(e => `• ${e.reference}: ${formatCurrency(e.amount)}`).join('\n');
    if (confirm(`Se clonarán ${expensesToClone.length} gastos desde ${formatPeriodString(prevPeriod)} al mes actual (${formatPeriodString(currentPeriod)}):\n\n${expenseSummaryText}\n\n¿Deseas continuar?`)) {
        const todayStr = today.toISOString().substring(0, 10);
        const promises = expensesToClone.map(t => {
            const finalId = 'tx-' + Date.now() + Math.random().toString(36).substring(2, 7);
            const txRef = doc(db, "transactions", finalId);
            return setDoc(txRef, {
                id: finalId,
                userId: currentUser.uid,
                profile: currentProfile,
                type: 'expense',
                category: t.category,
                date: todayStr,
                period: currentPeriod,
                reference: t.reference,
                amount: t.amount,
                status: t.status || 'paid',
                notes: `Clonado de ${formatPeriodString(prevPeriod)}`,
                attachment: null
            });
        });
        
        Promise.all(promises)
            .then(() => {
                showToast(`¡Se clonaron ${expensesToClone.length} gastos al mes actual exitosamente!`);
            })
            .catch(err => {
                showToast('Error al clonar gastos en la nube.', 'error');
                console.error(err);
            });
    }
}

// --- 7. FILTER SYSTEM & PERIOD CONVERSION ---
function setupFilters() {
    const triggerFilter = () => {
        renderTransactionsTable();
    };
    
    if (elements.filterSearch) elements.filterSearch.addEventListener('input', triggerFilter);
    if (elements.filterType) elements.filterType.addEventListener('change', triggerFilter);
    if (elements.filterCategory) elements.filterCategory.addEventListener('change', triggerFilter);
    if (elements.filterStatus) elements.filterStatus.addEventListener('change', triggerFilter);
    if (elements.filterMonth) elements.filterMonth.addEventListener('change', triggerFilter);
    
    if (elements.dashboardPeriodSelect) {
        elements.dashboardPeriodSelect.addEventListener('change', () => {
            renderDashboardMetrics();
            renderRecentTable();
            renderCharts();
        });
    }
    
    if (elements.btnExportCsv) elements.btnExportCsv.addEventListener('click', exportToCSV);
    if (elements.btnExportExcel) elements.btnExportExcel.addEventListener('click', exportToExcel);
    if (elements.btnExportReportsExcel) elements.btnExportReportsExcel.addEventListener('click', exportToExcel);
    
    if (elements.btnPrintReportsPdf) elements.btnPrintReportsPdf.addEventListener('click', openReportsPdfModal);
    if (elements.btnCloseReportsPdf) elements.btnCloseReportsPdf.addEventListener('click', closeReportsPdfModal);
    if (elements.btnCloseReportsPdfFoot) elements.btnCloseReportsPdfFoot.addEventListener('click', closeReportsPdfModal);
    if (elements.btnDoPrintPdf) elements.btnDoPrintPdf.addEventListener('click', printReportPdf);
    if (elements.reportsPdfModal) {
        elements.reportsPdfModal.addEventListener('click', (e) => {
            if (e.target === elements.reportsPdfModal) closeReportsPdfModal();
        });
    }

    // --- BATCH INCOMES MODAL EVENT LISTENERS ---
    if (elements.btnOpenBatchIncomes) elements.btnOpenBatchIncomes.addEventListener('click', openBatchIncomesModal);
    if (elements.btnOpenBatchIncomesSidebar) elements.btnOpenBatchIncomesSidebar.addEventListener('click', openBatchIncomesModal);
    if (elements.btnCloseBatchIncomeModal) elements.btnCloseBatchIncomeModal.addEventListener('click', closeBatchIncomesModal);
    if (elements.btnCancelBatchIncomeModal) elements.btnCancelBatchIncomeModal.addEventListener('click', closeBatchIncomesModal);
    if (elements.batchIncomesModal) {
        elements.batchIncomesModal.addEventListener('click', (e) => {
            if (e.target === elements.batchIncomesModal) closeBatchIncomesModal();
        });
    }
    if (elements.btnReloadBatchIncomeTemplate) {
        elements.btnReloadBatchIncomeTemplate.addEventListener('click', () => {
            const periodVal = elements.batchIncomeMonthInput.value || new Date().toISOString().substring(0, 7);
            populateBatchIncomesTable(periodVal);
        });
    }
    if (elements.btnAddBatchIncomeRow) elements.btnAddBatchIncomeRow.addEventListener('click', addBatchIncomeRow);
    if (elements.btnSaveBatchIncomes) elements.btnSaveBatchIncomes.addEventListener('click', saveBatchIncomes);
    if (elements.batchIncomeMonthInput) {
        elements.batchIncomeMonthInput.addEventListener('change', (e) => {
            if (e.target.value) {
                populateBatchIncomesTable(e.target.value);
            }
        });
    }
    if (elements.batchIncomeSelectAll) {
        elements.batchIncomeSelectAll.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            const rowChecks = elements.batchIncomesTbody.querySelectorAll('.batch-income-row-check');
            rowChecks.forEach(chk => chk.checked = isChecked);
            updateBatchIncomeTotalSummary();
        });
    }

    // --- BATCH EXPENSES MODAL EVENT LISTENERS ---
    if (elements.btnOpenBatchExpenses) elements.btnOpenBatchExpenses.addEventListener('click', openBatchExpensesModal);
    if (elements.btnOpenBatchExpensesSidebar) elements.btnOpenBatchExpensesSidebar.addEventListener('click', openBatchExpensesModal);
    if (elements.btnCloseBatchModal) elements.btnCloseBatchModal.addEventListener('click', closeBatchExpensesModal);
    if (elements.btnCancelBatchModal) elements.btnCancelBatchModal.addEventListener('click', closeBatchExpensesModal);
    if (elements.batchExpensesModal) {
        elements.batchExpensesModal.addEventListener('click', (e) => {
            if (e.target === elements.batchExpensesModal) closeBatchExpensesModal();
        });
    }
    if (elements.btnReloadBatchTemplate) {
        elements.btnReloadBatchTemplate.addEventListener('click', () => {
            const periodVal = elements.batchMonthInput.value || new Date().toISOString().substring(0, 7);
            populateBatchExpensesTable(periodVal);
        });
    }
    if (elements.btnAddBatchRow) elements.btnAddBatchRow.addEventListener('click', addBatchExpenseRow);
    if (elements.btnSaveBatchExpenses) elements.btnSaveBatchExpenses.addEventListener('click', saveBatchExpenses);
    if (elements.batchMonthInput) {
        elements.batchMonthInput.addEventListener('change', (e) => {
            if (e.target.value) {
                populateBatchExpensesTable(e.target.value);
            }
        });
    }
    if (elements.batchSelectAll) {
        elements.batchSelectAll.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            const rowChecks = elements.batchExpensesTbody.querySelectorAll('.batch-row-check');
            rowChecks.forEach(chk => chk.checked = isChecked);
            updateBatchTotalSummary();
        });
    }
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
    const mainTable = elements.mainTransactionsTable;
    if (mainTable) {
        const headers = mainTable.querySelectorAll('th.sortable');
        headers.forEach(th => {
            th.addEventListener('click', () => {
                const field = th.getAttribute('data-sort');
                if (sortField === field) {
                    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    sortField = field;
                    sortDirection = (field === 'date' || field === 'amount') ? 'desc' : 'asc';
                }
                renderTransactionsTable();
            });
        });
    }
}

function populatePeriodFilter() {
    const monthSelect = elements.filterMonth;
    if (!monthSelect) return;
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

// --- PDF EXECUTIVE REPORT GENERATOR ---
function renderPdfReportContent(selectedPeriod = 'all') {
    const profileTxs = transactions.filter(t => t.profile === currentProfile || !t.profile);
    if (profileTxs.length === 0) {
        elements.reportsPdfPrintableArea.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #64748b;">
                <p style="font-size: 1.1rem; font-weight: 700; margin-bottom: 8px;">No hay transacciones registradas para este perfil.</p>
                <p style="font-size: 0.85rem;">Agrega ingresos o gastos para visualizar y exportar tu informe financiero.</p>
            </div>
        `;
        return;
    }

    const todayStr = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    const profileLabel = currentProfile === 'empresa' ? 'Empresa / Oficina' : 'Personal';
    const officeName = (document.getElementById('sidebar-logo-title') || {}).textContent || "Caro & Sebastiani";

    // Populate period selector options if needed
    const periodSelect = document.getElementById('reports-pdf-period-select');
    if (periodSelect) {
        const allPeriods = Array.from(new Set(
            profileTxs.map(t => t.period || (t.date ? t.date.substring(0, 7) : '')).filter(Boolean)
        )).sort().reverse();

        const currentOptions = Array.from(periodSelect.options).map(o => o.value);
        const expectedOptions = ['all', ...allPeriods];

        if (JSON.stringify(currentOptions) !== JSON.stringify(expectedOptions)) {
            let selectHtml = `<option value="all" ${selectedPeriod === 'all' ? 'selected' : ''}>Todos los períodos (Consolidado Histórico)</option>`;
            allPeriods.forEach(p => {
                const isSel = p === selectedPeriod ? 'selected' : '';
                selectHtml += `<option value="${p}" ${isSel}>${formatPeriodString(p)}</option>`;
            });
            periodSelect.innerHTML = selectHtml;
        } else {
            periodSelect.value = selectedPeriod;
        }

        periodSelect.onchange = (e) => {
            renderPdfReportContent(e.target.value);
        };
    }

    // Filter transactions according to selectedPeriod
    let targetTxs = profileTxs;
    let periodTitle = "Informe Financiero Ejecutivo y Estado de Cuenta (Consolidado)";
    if (selectedPeriod !== 'all') {
        targetTxs = profileTxs.filter(t => 
            (t.period === selectedPeriod || (!t.period && t.date?.substring(0, 7) === selectedPeriod))
        );
        periodTitle = `Informe Financiero Ejecutivo - Período ${formatPeriodString(selectedPeriod)}`;
    }

    // Metrics calculation
    let totalIncome = 0;
    let totalExpenses = 0;
    targetTxs.forEach(tx => {
        const amt = Number(tx.amount) || 0;
        if (tx.type === 'income') totalIncome += amt;
        else if (tx.type === 'expense') totalExpenses += amt;
    });

    const netResult = totalIncome - totalExpenses;
    const margin = totalIncome > 0 ? ((netResult / totalIncome) * 100).toFixed(1) : '0';

    // Monthly summary for consolidated table (if selectedPeriod === 'all')
    const monthlySummary = {};
    profileTxs.forEach(tx => {
        const monthKey = tx.period || (tx.date ? tx.date.substring(0, 7) : 'Sin fecha');
        if (!monthlySummary[monthKey]) {
            monthlySummary[monthKey] = { judicial: 0, brokerage: 0, expenses: 0 };
        }
        const amt = Number(tx.amount) || 0;
        if (tx.type === 'income') {
            if (tx.category && tx.category.startsWith('judicial')) monthlySummary[monthKey].judicial += amt;
            else monthlySummary[monthKey].brokerage += amt;
        } else if (tx.type === 'expense') {
            monthlySummary[monthKey].expenses += amt;
        }
    });
    const sortedMonths = Object.keys(monthlySummary).sort().reverse();

    // Prepare Incomes grouped and sorted
    const incomeTxs = targetTxs.filter(t => t.type === 'income');
    incomeTxs.sort((a, b) => {
        const orderA = getIncomeCategoryOrder(a.category);
        const orderB = getIncomeCategoryOrder(b.category);
        if (orderA !== orderB) return orderA - orderB;
        return (a.reference || '').localeCompare(b.reference || '');
    });

    // Group Incomes
    const incomeGroups = {};
    incomeTxs.forEach(tx => {
        const g = getIncomeCategoryGroup(tx.category);
        if (!incomeGroups[g]) incomeGroups[g] = [];
        incomeGroups[g].push(tx);
    });

    // Prepare Expenses grouped and sorted
    const expenseTxs = targetTxs.filter(t => t.type === 'expense');
    expenseTxs.sort((a, b) => {
        const orderA = getExpenseCategoryOrder(a.category);
        const orderB = getExpenseCategoryOrder(b.category);
        if (orderA !== orderB) return orderA - orderB;
        return (a.reference || '').localeCompare(b.reference || '');
    });

    // Group Expenses
    const expenseGroups = {};
    expenseTxs.forEach(tx => {
        const g = getExpenseCategoryGroup(tx.category);
        if (!expenseGroups[g]) expenseGroups[g] = [];
        expenseGroups[g].push(tx);
    });

    // Build HTML
    let html = `
        <div style="border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
            <div>
                <h1 style="font-size: 1.55rem; font-weight: 800; color: #0f172a; margin: 0; letter-spacing: -0.5px;">${escapeHtml(officeName)}</h1>
                <p style="font-size: 0.85rem; color: #475569; margin-top: 4px; font-weight: 700;">${escapeHtml(periodTitle)}</p>
            </div>
            <div style="text-align: right; font-size: 0.78rem; color: #475569; line-height: 1.5;">
                <p><strong>Fecha de Emisión:</strong> ${todayStr}</p>
                <p><strong>Contexto / Perfil:</strong> ${profileLabel}</p>
                ${selectedPeriod !== 'all' ? `<p><strong>Período:</strong> ${formatPeriodString(selectedPeriod)}</p>` : `<p><strong>Cobertura:</strong> Todos los Períodos Registrados</p>`}
            </div>
        </div>

        <!-- Metric Grid -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px;">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; text-align: center;">
                <div style="font-size: 0.68rem; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Margen Rentabilidad</div>
                <div style="font-size: 1.35rem; font-weight: 800; color: ${margin >= 0 ? '#059669' : '#dc2626'}; margin-top: 4px;">${margin}%</div>
            </div>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; text-align: center;">
                <div style="font-size: 0.68rem; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Ingresos Totales</div>
                <div style="font-size: 1.35rem; font-weight: 800; color: #059669; margin-top: 4px;">${formatCurrency(totalIncome)}</div>
            </div>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; text-align: center;">
                <div style="font-size: 0.68rem; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Gastos Totales</div>
                <div style="font-size: 1.35rem; font-weight: 800; color: #dc2626; margin-top: 4px;">${formatCurrency(totalExpenses)}</div>
            </div>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; text-align: center;">
                <div style="font-size: 0.68rem; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Resultado Neto</div>
                <div style="font-size: 1.35rem; font-weight: 800; color: ${netResult >= 0 ? '#059669' : '#dc2626'}; margin-top: 4px;">${formatCurrency(netResult)}</div>
            </div>
        </div>
    `;

    // SECTION 1: Resumen Consolidado (if selectedPeriod === 'all')
    if (selectedPeriod === 'all') {
        html += `
            <h3 style="font-size: 1.05rem; font-weight: 800; color: #0f172a; margin-bottom: 10px; border-bottom: 2px solid #cbd5e1; padding-bottom: 6px;">1. Resumen Mensual Consolidado</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 28px; font-size: 0.82rem;">
                <thead>
                    <tr style="background-color: #0f172a; color: #ffffff;">
                        <th style="padding: 9px 12px; text-align: left;">Mes / Período</th>
                        <th style="padding: 9px 12px; text-align: right;">Ing. Corretaje</th>
                        <th style="padding: 9px 12px; text-align: right;">Ing. Judiciales</th>
                        <th style="padding: 9px 12px; text-align: right;">Gastos Totales</th>
                        <th style="padding: 9px 12px; text-align: right;">Resultado Neto</th>
                        <th style="padding: 9px 12px; text-align: center;">Margen</th>
                    </tr>
                </thead>
                <tbody>
        `;

        sortedMonths.forEach((m, idx) => {
            const item = monthlySummary[m];
            const totInc = item.judicial + item.brokerage;
            const net = totInc - item.expenses;
            const mPct = totInc > 0 ? ((net / totInc) * 100).toFixed(0) + '%' : '0%';
            const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

            html += `
                <tr style="background-color: ${bg}; border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 8px 12px; font-weight: 700; color: #0f172a;">${formatPeriodString(m)}</td>
                    <td style="padding: 8px 12px; text-align: right; color: #047857; font-weight: 600;">${formatCurrency(item.brokerage)}</td>
                    <td style="padding: 8px 12px; text-align: right; color: #4338ca; font-weight: 600;">${formatCurrency(item.judicial)}</td>
                    <td style="padding: 8px 12px; text-align: right; color: #dc2626; font-weight: 600;">${formatCurrency(item.expenses)}</td>
                    <td style="padding: 8px 12px; text-align: right; font-weight: 800; color: ${net >= 0 ? '#059669' : '#dc2626'};">${formatCurrency(net)}</td>
                    <td style="padding: 8px 12px; text-align: center; font-weight: 700; color: ${net >= 0 ? '#059669' : '#dc2626'};">${mPct}</td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
        `;
    }

    // SECTION 2: Desglose Detallado de Ingresos (Agrupados y Ordenados)
    const incomeSectionNum = selectedPeriod === 'all' ? '2' : '1';
    html += `
        <h3 style="font-size: 1.05rem; font-weight: 800; color: #0f172a; margin-bottom: 10px; border-bottom: 2px solid #10b981; padding-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
            <span>${incomeSectionNum}. Desglose Detallado de Ingresos ${selectedPeriod !== 'all' ? '(' + formatPeriodString(selectedPeriod) + ')' : ''}</span>
            <span style="font-size: 0.88rem; color: #059669; font-weight: 800;">Total: ${formatCurrency(totalIncome)}</span>
        </h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 28px; font-size: 0.81rem;">
            <thead>
                <tr style="background-color: #064e3b; color: #ffffff;">
                    <th style="padding: 9px 12px; text-align: left; width: 14%;">Período</th>
                    <th style="padding: 9px 12px; text-align: left; width: 14%;">Fecha</th>
                    <th style="padding: 9px 12px; text-align: left; width: 22%;">Categoría</th>
                    <th style="padding: 9px 12px; text-align: left; width: 28%;">Cliente / Propiedad / Causa</th>
                    <th style="padding: 9px 12px; text-align: right; width: 12%;">Monto</th>
                    <th style="padding: 9px 12px; text-align: center; width: 10%;">Estado</th>
                </tr>
            </thead>
            <tbody>
    `;

    if (incomeTxs.length === 0) {
        html += `<tr><td colspan="6" style="text-align:center; padding:18px; color:#64748b;">No hay ingresos registrados para este período.</td></tr>`;
    } else {
        Object.keys(incomeGroups).forEach(groupName => {
            const groupList = incomeGroups[groupName];
            const groupSubtotal = groupList.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

            html += `
                <tr style="background-color: #ecfdf5; border-top: 2px solid #a7f3d0; border-bottom: 1px solid #a7f3d0;">
                    <td colspan="6" style="padding: 7px 12px; font-weight: 800; font-size: 0.78rem; color: #065f46; letter-spacing: 0.4px;">
                        📁 ${escapeHtml(groupName.toUpperCase())} &nbsp;&bull;&nbsp; <span style="font-weight: 700; color: #047857;">Subtotal: ${formatCurrency(groupSubtotal)} (${groupList.length} registros)</span>
                    </td>
                </tr>
            `;

            groupList.forEach((tx, idx) => {
                const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
                html += `
                    <tr style="background-color: ${bg}; border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 8px 12px; font-weight: 600; color: #475569;">${formatPeriodString(tx.period)}</td>
                        <td style="padding: 8px 12px; color: #64748b;">${formatDateString(tx.date)}</td>
                        <td style="padding: 8px 12px; font-weight: 600; color: #0f172a;">${getCategoryLabel(tx.type, tx.category)}</td>
                        <td style="padding: 8px 12px; font-weight: 700; color: #0f172a;">${escapeHtml(tx.reference)}</td>
                        <td style="padding: 8px 12px; text-align: right; font-weight: 800; color: #059669;">${formatCurrency(tx.amount)}</td>
                        <td style="padding: 8px 12px; text-align: center;">
                            <span style="display:inline-block; padding: 2px 7px; border-radius: 4px; font-size: 0.72rem; font-weight: 700; background: ${tx.status === 'paid' ? '#dcfce7' : '#fef3c7'}; color: ${tx.status === 'paid' ? '#15803d' : '#b45309'};">
                                ${tx.status === 'paid' ? 'Pagado' : 'Pendiente'}
                            </span>
                        </td>
                    </tr>
                `;
            });
        });
    }

    html += `
            </tbody>
        </table>
    `;

    // SECTION 3: Desglose Detallado de Gastos (Agrupados y Ordenados)
    const expenseSectionNum = selectedPeriod === 'all' ? '3' : '2';
    html += `
        <h3 style="font-size: 1.05rem; font-weight: 800; color: #0f172a; margin-bottom: 10px; border-bottom: 2px solid #ef4444; padding-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
            <span>${expenseSectionNum}. Desglose Detallado de Gastos ${selectedPeriod !== 'all' ? '(' + formatPeriodString(selectedPeriod) + ')' : ''}</span>
            <span style="font-size: 0.88rem; color: #dc2626; font-weight: 800;">Total: ${formatCurrency(totalExpenses)}</span>
        </h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 0.81rem;">
            <thead>
                <tr style="background-color: #7f1d1d; color: #ffffff;">
                    <th style="padding: 9px 12px; text-align: left; width: 14%;">Período</th>
                    <th style="padding: 9px 12px; text-align: left; width: 14%;">Fecha</th>
                    <th style="padding: 9px 12px; text-align: left; width: 22%;">Categoría</th>
                    <th style="padding: 9px 12px; text-align: left; width: 28%;">Proveedor / Concepto</th>
                    <th style="padding: 9px 12px; text-align: right; width: 12%;">Monto</th>
                    <th style="padding: 9px 12px; text-align: center; width: 10%;">Estado</th>
                </tr>
            </thead>
            <tbody>
    `;

    if (expenseTxs.length === 0) {
        html += `<tr><td colspan="6" style="text-align:center; padding:18px; color:#64748b;">No hay gastos registrados para este período.</td></tr>`;
    } else {
        Object.keys(expenseGroups).forEach(groupName => {
            const groupList = expenseGroups[groupName];
            const groupSubtotal = groupList.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

            html += `
                <tr style="background-color: #fef2f2; border-top: 2px solid #fecaca; border-bottom: 1px solid #fecaca;">
                    <td colspan="6" style="padding: 7px 12px; font-weight: 800; font-size: 0.78rem; color: #991b1b; letter-spacing: 0.4px;">
                        📁 ${escapeHtml(groupName.toUpperCase())} &nbsp;&bull;&nbsp; <span style="font-weight: 700; color: #b91c1c;">Subtotal: ${formatCurrency(groupSubtotal)} (${groupList.length} registros)</span>
                    </td>
                </tr>
            `;

            groupList.forEach((tx, idx) => {
                const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
                html += `
                    <tr style="background-color: ${bg}; border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 8px 12px; font-weight: 600; color: #475569;">${formatPeriodString(tx.period)}</td>
                        <td style="padding: 8px 12px; color: #64748b;">${formatDateString(tx.date)}</td>
                        <td style="padding: 8px 12px; font-weight: 600; color: #0f172a;">${getCategoryLabel(tx.type, tx.category)}</td>
                        <td style="padding: 8px 12px; font-weight: 700; color: #0f172a;">${escapeHtml(tx.reference)}</td>
                        <td style="padding: 8px 12px; text-align: right; font-weight: 800; color: #dc2626;">${formatCurrency(tx.amount)}</td>
                        <td style="padding: 8px 12px; text-align: center;">
                            <span style="display:inline-block; padding: 2px 7px; border-radius: 4px; font-size: 0.72rem; font-weight: 700; background: ${tx.status === 'paid' ? '#dcfce7' : '#fef3c7'}; color: ${tx.status === 'paid' ? '#15803d' : '#b45309'};">
                                ${tx.status === 'paid' ? 'Pagado' : 'Pendiente'}
                            </span>
                        </td>
                    </tr>
                `;
            });
        });
    }

    html += `
            </tbody>
        </table>
    `;

    elements.reportsPdfPrintableArea.innerHTML = html;
}

function openReportsPdfModal() {
    if (transactions.length === 0) {
        showToast('No hay transacciones registradas para generar el reporte.', 'error');
        return;
    }

    // Default period: active dashboard period or 'all'
    const dashSelect = elements.dashboardPeriodSelect;
    const initialPeriod = (dashSelect && dashSelect.value && dashSelect.value !== 'all') ? dashSelect.value : 'all';

    renderPdfReportContent(initialPeriod);
    elements.reportsPdfModal.classList.add('active');
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

function closeReportsPdfModal() {
    elements.reportsPdfModal.classList.remove('active');
}

function printReportPdf() {
    const printableArea = document.getElementById('reports-pdf-printable-area');
    if (!printableArea) {
        window.print();
        return;
    }

    const reportHtml = printableArea.innerHTML;
    const officeName = (document.getElementById('sidebar-logo-title') || {}).textContent || "Caro & Sebastiani";
    const periodSelect = document.getElementById('reports-pdf-period-select');
    const periodText = (periodSelect && periodSelect.value !== 'all') ? formatPeriodString(periodSelect.value) : 'Consolidado';

    // Create an isolated hidden iframe for 100% reliable, pristine PDF printing
    let printFrame = document.getElementById('report-print-iframe');
    if (printFrame) {
        printFrame.remove();
    }

    printFrame = document.createElement('iframe');
    printFrame.id = 'report-print-iframe';
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const doc = printFrame.contentWindow.document;
    doc.open();
    doc.write(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>${escapeHtml(officeName)} - Informe Financiero (${escapeHtml(periodText)})</title>
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
            <style>
                @page {
                    margin: 10mm 12mm;
                    size: A4 portrait;
                }
                * {
                    box-sizing: border-box;
                    margin: 0;
                    padding: 0;
                }
                body {
                    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: #ffffff !important;
                    color: #0f172a !important;
                    padding: 10px 14px;
                    font-size: 10.5pt;
                    line-height: 1.4;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                table {
                    width: 100% !important;
                    border-collapse: collapse !important;
                    page-break-inside: auto !important;
                }
                tr {
                    page-break-inside: avoid !important;
                    page-break-after: auto !important;
                }
                thead {
                    display: table-header-group !important;
                }
                th, td {
                    vertical-align: middle;
                }
            </style>
        </head>
        <body>
            ${reportHtml}
        </body>
        </html>
    `);
    doc.close();

    setTimeout(() => {
        try {
            printFrame.contentWindow.focus();
            printFrame.contentWindow.print();
        } catch (e) {
            console.error("Error al imprimir via iframe, fallback:", e);
            window.print();
        }
    }, 300);
}

window.printReportPdf = printReportPdf;

// --- 12. CARGA MASIVA DE GASTOS (BATCH EXPENSE LOADER) ---
function openBatchExpensesModal() {
    const modal = document.getElementById('batch-expenses-modal');
    if (!modal) {
        console.error("Modal batch-expenses-modal no encontrado en el DOM.");
        return;
    }
    const today = new Date();
    const currentPeriod = today.toISOString().substring(0, 7);
    const monthInput = document.getElementById('batch-month-input');
    if (monthInput) {
        if (!monthInput.value) {
            monthInput.value = currentPeriod;
        }
        monthInput.onchange = () => populateBatchExpensesTable(monthInput.value);
    }
    
    // Mostrar modal mediante clase .active
    modal.classList.add('active');
    
    // Select all checkbox
    const selectAll = document.getElementById('batch-select-all');
    if (selectAll) {
        selectAll.checked = true;
        selectAll.onchange = () => {
            document.querySelectorAll('.batch-row-check').forEach(cb => { cb.checked = selectAll.checked; });
            updateBatchTotalSummary();
        };
    }
    
    populateBatchExpensesTable(monthInput ? monthInput.value : currentPeriod);
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

function closeBatchExpensesModal() {
    const modal = document.getElementById('batch-expenses-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

window.openBatchExpensesModal = openBatchExpensesModal;
window.closeBatchExpensesModal = closeBatchExpensesModal;
window.openModal = openModal;
window.closeModal = closeModal;

function getCategorySelectHtml(selectedVal = 'expense-rent') {
    const groups = {};
    CATEGORIES.expense.forEach(c => {
        const groupName = c.group || 'Otros Gastos';
        if (!groups[groupName]) groups[groupName] = [];
        groups[groupName].push(c);
    });

    let html = '';
    Object.keys(groups).forEach(groupName => {
        html += `<optgroup label="${groupName}">`;
        groups[groupName].forEach(c => {
            const isSel = c.value === selectedVal ? 'selected' : '';
            html += `<option value="${c.value}" ${isSel}>${c.label}</option>`;
        });
        html += `</optgroup>`;
    });
    return html;
}

function populateBatchExpensesTable(periodKey) {
    const todayPeriod = new Date().toISOString().substring(0, 7);
    const targetPeriod = periodKey || todayPeriod;
    const [targetYear, targetMonth] = targetPeriod.split('-').map(Number);
    const defaultPaymentDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-05`;

    // Filter expenses corresponding to the active profile (or without profile)
    const profileExpenses = transactions.filter(t => 
        t.type === 'expense' && 
        (t.profile === currentProfile || !t.profile)
    );

    // Get all distinct periods with expense records
    const periodsWithExpenses = Array.from(new Set(
        profileExpenses
            .map(t => t.period || (t.date ? t.date.substring(0, 7) : ''))
            .filter(Boolean)
    )).sort();

    // Find the latest period strictly prior to targetPeriod
    const priorPeriods = periodsWithExpenses.filter(p => p < targetPeriod);
    let sourcePeriod = null;

    if (priorPeriods.length > 0) {
        sourcePeriod = priorPeriods[priorPeriods.length - 1];
    } else if (periodsWithExpenses.length > 0) {
        // If there's no period before targetPeriod, use the latest period recorded in history
        sourcePeriod = periodsWithExpenses[periodsWithExpenses.length - 1];
    }

    const banner = document.getElementById('batch-source-banner');
    const bannerText = document.getElementById('batch-source-banner-text');
    const tbody = document.getElementById('batch-expenses-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let templateItems = [];

    if (sourcePeriod) {
        // Get all expenses from that source period
        const sourceTxs = profileExpenses.filter(t => 
            (t.period === sourcePeriod || (!t.period && t.date?.substring(0, 7) === sourcePeriod))
        );

        if (sourceTxs.length > 0) {
            templateItems = sourceTxs.map(t => {
                // Determine day of month from the original transaction
                let paymentDate = defaultPaymentDate;
                if (t.date && t.date.includes('-')) {
                    const parts = t.date.split('-');
                    if (parts.length >= 3) {
                        const dayNum = parseInt(parts[2], 10);
                        if (!isNaN(dayNum) && dayNum >= 1 && dayNum <= 31) {
                            const daysInTargetMonth = new Date(targetYear, targetMonth, 0).getDate();
                            const clampedDay = Math.min(dayNum, daysInTargetMonth);
                            paymentDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
                        }
                    }
                }

                return {
                    ref: t.reference || getCategoryLabel('expense', t.category) || 'Gasto General',
                    cat: t.category || 'expense-other',
                    amount: Math.abs(Number(t.amount)) || 0,
                    date: paymentDate,
                    status: t.status || 'paid'
                };
            });

            // Ordenar por prioridad de grupo (Servicios -> Sueldos -> Operaciones -> Marketing -> Impuestos -> Otros) y luego por nombre
            templateItems.sort((a, b) => {
                const orderA = getExpenseCategoryOrder(a.cat);
                const orderB = getExpenseCategoryOrder(b.cat);
                if (orderA !== orderB) {
                    return orderA - orderB;
                }
                return (a.ref || '').localeCompare(b.ref || '');
            });
        }
    }

    if (banner && bannerText) {
        banner.style.display = 'flex';
        if (sourcePeriod && templateItems.length > 0) {
            const formattedSource = formatPeriodString(sourcePeriod);
            const formattedTarget = formatPeriodString(targetPeriod);
            if (sourcePeriod === targetPeriod) {
                bannerText.innerHTML = `Mostrando los <strong>${templateItems.length} gastos</strong> registrados en <strong>${formattedTarget}</strong>. Puedes editarlos o agregar nuevos antes de guardar.`;
            } else {
                bannerText.innerHTML = `Gastos cargados automáticamente desde <strong>${formattedSource}</strong> (último mes con registros) para el período <strong>${formattedTarget}</strong>.`;
            }
        } else {
            bannerText.innerHTML = `No hay gastos registrados en meses anteriores. Puedes agregar tus gastos de <strong>${formatPeriodString(targetPeriod)}</strong> con el botón <strong>+ Agregar Fila</strong>.`;
        }
    }

    if (templateItems.length === 0) {
        const emptyTr = document.createElement('tr');
        emptyTr.id = 'batch-empty-row';
        emptyTr.innerHTML = `
            <td colspan="7" style="text-align: center; padding: 30px; color: var(--color-text-muted);">
                <i data-lucide="inbox" style="width: 32px; height: 32px; margin-bottom: 8px; opacity: 0.6;"></i>
                <p style="margin: 0; font-size: 0.88rem; font-weight: 500;">No hay gastos registrados en meses anteriores para replicar.</p>
                <button type="button" class="btn btn-secondary" id="btn-batch-add-first" style="margin-top: 10px; font-size: 0.8rem;">
                    <i data-lucide="plus"></i> Agregar Primer Gasto
                </button>
            </td>
        `;
        tbody.appendChild(emptyTr);
        const addFirstBtn = emptyTr.querySelector('#btn-batch-add-first');
        addFirstBtn?.addEventListener('click', addBatchExpenseRow);
    } else {
        let currentRenderGroup = null;
        templateItems.forEach(item => {
            const itemGroup = getExpenseCategoryGroup(item.cat);
            if (itemGroup !== currentRenderGroup) {
                currentRenderGroup = itemGroup;
                const groupTr = document.createElement('tr');
                groupTr.className = 'batch-group-header-row';
                groupTr.innerHTML = `
                    <td colspan="7" style="background: rgba(99, 102, 241, 0.08); padding: 7px 14px; font-size: 0.76rem; font-weight: 800; color: var(--color-primary); letter-spacing: 0.5px; border-top: 1px solid rgba(255,255,255,0.06); border-bottom: 1px solid rgba(255,255,255,0.06);">
                        <i data-lucide="folder" style="width: 12px; height: 12px; vertical-align: middle; margin-right: 6px;"></i>
                        <span style="vertical-align: middle;">${escapeHtml(itemGroup)}</span>
                    </td>
                `;
                tbody.appendChild(groupTr);
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="text-align: center;">
                    <input type="checkbox" class="batch-row-check" checked>
                </td>
                <td>
                    <input type="text" class="batch-table-input batch-ref-input" value="${escapeHtml(item.ref)}">
                </td>
                <td>
                    <select class="batch-table-input batch-cat-select">
                        ${getCategorySelectHtml(item.cat)}
                    </select>
                </td>
                <td>
                    <input type="number" class="batch-table-input batch-amount-input" value="${item.amount}" min="0" step="1000" style="text-align: right; font-weight: 700;">
                </td>
                <td>
                    <input type="date" class="batch-table-input batch-date-input" value="${item.date}">
                </td>
                <td>
                    <select class="batch-table-input batch-status-select">
                        <option value="paid" ${item.status === 'paid' ? 'selected' : ''}>Pagado</option>
                        <option value="pending" ${item.status === 'pending' ? 'selected' : ''}>Pendiente</option>
                    </select>
                </td>
                <td style="text-align: center;">
                    <button type="button" class="btn btn-danger btn-icon btn-remove-batch-row" title="Eliminar fila">
                        <i data-lucide="trash-2"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Live update listeners
    const inputs = tbody.querySelectorAll('.batch-amount-input, .batch-row-check');
    inputs.forEach(input => {
        input.addEventListener('input', updateBatchTotalSummary);
        input.addEventListener('change', updateBatchTotalSummary);
    });

    const delBtns = tbody.querySelectorAll('.btn-remove-batch-row');
    delBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('tr')?.remove();
            updateBatchTotalSummary();
            if (tbody.querySelectorAll('tr:not(#batch-empty-row):not(.batch-group-header-row)').length === 0) {
                populateBatchExpensesTable(targetPeriod);
            }
        });
    });

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }

    updateBatchTotalSummary();
}

function addBatchExpenseRow() {
    const tbody = document.getElementById('batch-expenses-tbody');
    if (!tbody) return;

    // Remove empty row placeholder if present
    const emptyRow = document.getElementById('batch-empty-row');
    if (emptyRow) emptyRow.remove();

    const monthInput = document.getElementById('batch-month-input');
    const periodKey = (monthInput && monthInput.value) ? monthInput.value : new Date().toISOString().substring(0, 7);
    const [year, month] = periodKey.split('-');
    const defaultPaymentDate = `${year}-${month}-05`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td style="text-align: center;">
            <input type="checkbox" class="batch-row-check" checked>
        </td>
        <td>
            <input type="text" class="batch-table-input batch-ref-input" placeholder="Nombre de proveedor / concepto...">
        </td>
        <td>
            <select class="batch-table-input batch-cat-select">
                ${getCategorySelectHtml('expense-other')}
            </select>
        </td>
        <td>
            <input type="number" class="batch-table-input batch-amount-input" value="0" min="0" step="1000" style="text-align: right; font-weight: 700;">
        </td>
        <td>
            <input type="date" class="batch-table-input batch-date-input" value="${defaultPaymentDate}">
        </td>
        <td>
            <select class="batch-table-input batch-status-select">
                <option value="paid">Pagado</option>
                <option value="pending">Pendiente</option>
            </select>
        </td>
        <td style="text-align: center;">
            <button type="button" class="btn btn-danger btn-icon btn-remove-batch-row" title="Eliminar fila">
                <i data-lucide="trash-2"></i>
            </button>
        </td>
    `;

    tbody.appendChild(tr);

    const inputs = tr.querySelectorAll('.batch-amount-input, .batch-row-check');
    inputs.forEach(input => {
        input.addEventListener('input', updateBatchTotalSummary);
        input.addEventListener('change', updateBatchTotalSummary);
    });

    const delBtn = tr.querySelector('.btn-remove-batch-row');
    delBtn?.addEventListener('click', () => {
        tr.remove();
        updateBatchTotalSummary();
    });

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }

    updateBatchTotalSummary();
}

function updateBatchTotalSummary() {
    let total = 0;
    let selectedCount = 0;
    const tbody = document.getElementById('batch-expenses-tbody');
    if (!tbody) return;
    const rows = tbody.querySelectorAll('tr:not(#batch-empty-row)');
    
    rows.forEach(tr => {
        const check = tr.querySelector('.batch-row-check');
        const amountInput = tr.querySelector('.batch-amount-input');
        
        if (check && check.checked && amountInput) {
            const val = parseFloat(amountInput.value) || 0;
            total += Math.abs(val);
            selectedCount++;
        }
    });

    const summaryLbl = document.getElementById('batch-total-summary');
    if (summaryLbl) {
        summaryLbl.textContent = `Total Gastos (${selectedCount}): ${formatCurrency(total)}`;
    }
}

function saveBatchExpenses() {
    if (!currentUser) {
        showToast('Debes iniciar sesión para registrar gastos.', 'error');
        return;
    }

    const monthInput = document.getElementById('batch-month-input');
    const periodKey = (monthInput && monthInput.value) ? monthInput.value : new Date().toISOString().substring(0, 7);
    const tbody = document.getElementById('batch-expenses-tbody');
    if (!tbody) return;
    const rows = tbody.querySelectorAll('tr:not(#batch-empty-row)');
    
    const itemsToSave = [];

    rows.forEach(tr => {
        const check = tr.querySelector('.batch-row-check');
        if (check && check.checked) {
            const refInput = tr.querySelector('.batch-ref-input');
            const catSelect = tr.querySelector('.batch-cat-select');
            const amountInput = tr.querySelector('.batch-amount-input');
            const dateInput = tr.querySelector('.batch-date-input');
            const statusSelect = tr.querySelector('.batch-status-select');

            const reference = refInput ? refInput.value.trim() : '';
            const category = catSelect ? catSelect.value : 'expense-other';
            const amount = amountInput ? Math.abs(parseFloat(amountInput.value) || 0) : 0;
            const date = dateInput ? dateInput.value : `${periodKey}-05`;
            const status = statusSelect ? statusSelect.value : 'paid';

            if (reference && amount > 0) {
                itemsToSave.push({
                    reference,
                    category,
                    amount,
                    date,
                    period: periodKey,
                    status
                });
            }
        }
    });

    if (itemsToSave.length === 0) {
        showToast('Por favor, selecciona al menos un gasto con monto mayor a 0 para guardar.', 'error');
        return;
    }

    const summaryLbl = document.getElementById('batch-total-summary');
    const totalText = summaryLbl ? summaryLbl.textContent : '';
    if (confirm(`Se registrarán ${itemsToSave.length} gastos en el período ${formatPeriodString(periodKey)} por un total de ${totalText.replace(/Total Gastos \(\d+\): /, '')}.\n\n¿Deseas continuar?`)) {
        const saveBtn = document.getElementById('btn-save-batch-expenses');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span>Guardando gastos...</span>';
        }

        const promises = itemsToSave.map(item => {
            const finalId = 'tx-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
            const txRef = doc(db, "transactions", finalId);
            return setDoc(txRef, {
                id: finalId,
                userId: currentUser.uid,
                profile: currentProfile,
                type: 'expense',
                category: item.category,
                date: item.date,
                period: item.period,
                reference: item.reference,
                amount: item.amount,
                status: item.status,
                notes: 'Carga masiva mensual',
                attachment: null
            });
        });

        Promise.all(promises)
            .then(() => {
                showToast(`¡Se registraron ${itemsToSave.length} gastos exitosamente en ${formatPeriodString(periodKey)}!`);
                closeBatchExpensesModal();
            })
            .catch(err => {
                showToast('Error al guardar gastos masivos en la nube.', 'error');
                console.error(err);
            })
            .finally(() => {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = '<i data-lucide="check-circle"></i><span>Guardar Todos los Gastos</span>';
                    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
                }
            });
    }
}

// --- 13. CARGA MASIVA DE INGRESOS (BATCH INCOME LOADER) ---
function openBatchIncomesModal() {
    const modal = document.getElementById('batch-incomes-modal');
    if (!modal) {
        console.error("Modal batch-incomes-modal no encontrado en el DOM.");
        return;
    }
    const today = new Date();
    const currentPeriod = today.toISOString().substring(0, 7);
    const monthInput = document.getElementById('batch-income-month-input');
    if (monthInput) {
        if (!monthInput.value) {
            monthInput.value = currentPeriod;
        }
        monthInput.onchange = () => populateBatchIncomesTable(monthInput.value);
    }
    
    modal.classList.add('active');
    
    const selectAll = document.getElementById('batch-income-select-all');
    if (selectAll) {
        selectAll.checked = true;
        selectAll.onchange = () => {
            document.querySelectorAll('.batch-income-row-check').forEach(cb => { cb.checked = selectAll.checked; });
            updateBatchIncomeTotalSummary();
        };
    }
    
    populateBatchIncomesTable(monthInput ? monthInput.value : currentPeriod);
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

function closeBatchIncomesModal() {
    const modal = document.getElementById('batch-incomes-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

window.openBatchIncomesModal = openBatchIncomesModal;
window.closeBatchIncomesModal = closeBatchIncomesModal;

function getIncomeCategorySelectHtml(selectedVal = 'brokerage-administration') {
    const groups = {};
    CATEGORIES.income.forEach(c => {
        const groupName = c.group || 'Ingresos';
        if (!groups[groupName]) groups[groupName] = [];
        groups[groupName].push(c);
    });

    let html = '';
    Object.keys(groups).forEach(groupName => {
        html += `<optgroup label="${groupName}">`;
        groups[groupName].forEach(c => {
            const isSel = c.value === selectedVal ? 'selected' : '';
            html += `<option value="${c.value}" ${isSel}>${c.label}</option>`;
        });
        html += `</optgroup>`;
    });
    return html;
}

function populateBatchIncomesTable(periodKey) {
    const todayPeriod = new Date().toISOString().substring(0, 7);
    const targetPeriod = periodKey || todayPeriod;
    const [targetYear, targetMonth] = targetPeriod.split('-').map(Number);
    const defaultPaymentDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-05`;

    // Filter incomes corresponding to the active profile (or without profile)
    const profileIncomes = transactions.filter(t => 
        t.type === 'income' && 
        (t.profile === currentProfile || !t.profile)
    );

    // Get all distinct periods with income records
    const periodsWithIncome = Array.from(new Set(
        profileIncomes
            .map(t => t.period || (t.date ? t.date.substring(0, 7) : ''))
            .filter(Boolean)
    )).sort();

    // Find the latest period strictly prior to targetPeriod
    const priorPeriods = periodsWithIncome.filter(p => p < targetPeriod);
    let sourcePeriod = null;

    if (priorPeriods.length > 0) {
        sourcePeriod = priorPeriods[priorPeriods.length - 1];
    } else if (periodsWithIncome.length > 0) {
        sourcePeriod = periodsWithIncome[periodsWithIncome.length - 1];
    }

    const banner = document.getElementById('batch-income-source-banner');
    const bannerText = document.getElementById('batch-income-source-banner-text');
    const tbody = document.getElementById('batch-incomes-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let templateItems = [];

    if (sourcePeriod) {
        const sourceTxs = profileIncomes.filter(t => 
            (t.period === sourcePeriod || (!t.period && t.date?.substring(0, 7) === sourcePeriod))
        );

        if (sourceTxs.length > 0) {
            templateItems = sourceTxs.map(t => {
                let paymentDate = defaultPaymentDate;
                if (t.date && t.date.includes('-')) {
                    const parts = t.date.split('-');
                    if (parts.length >= 3) {
                        const dayNum = parseInt(parts[2], 10);
                        if (!isNaN(dayNum) && dayNum >= 1 && dayNum <= 31) {
                            const daysInTargetMonth = new Date(targetYear, targetMonth, 0).getDate();
                            const clampedDay = Math.min(dayNum, daysInTargetMonth);
                            paymentDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
                        }
                    }
                }

                return {
                    ref: t.reference || getCategoryLabel('income', t.category) || 'Ingreso General',
                    cat: t.category || 'brokerage-administration',
                    amount: Math.abs(Number(t.amount)) || 0,
                    date: paymentDate,
                    status: t.status || 'paid'
                };
            });

            // Ordenar por prioridad de grupo de ingresos y luego por nombre
            templateItems.sort((a, b) => {
                const orderA = getIncomeCategoryOrder(a.cat);
                const orderB = getIncomeCategoryOrder(b.cat);
                if (orderA !== orderB) {
                    return orderA - orderB;
                }
                return (a.ref || '').localeCompare(b.ref || '');
            });
        }
    }

    if (banner && bannerText) {
        banner.style.display = 'flex';
        if (sourcePeriod && templateItems.length > 0) {
            const formattedSource = formatPeriodString(sourcePeriod);
            const formattedTarget = formatPeriodString(targetPeriod);
            if (sourcePeriod === targetPeriod) {
                bannerText.innerHTML = `Mostrando los <strong>${templateItems.length} ingresos</strong> registrados en <strong>${formattedTarget}</strong>. Puedes editarlos o agregar nuevos antes de guardar.`;
            } else {
                bannerText.innerHTML = `Ingresos cargados automáticamente desde <strong>${formattedSource}</strong> (último mes con registros) para el período <strong>${formattedTarget}</strong>.`;
            }
        } else {
            bannerText.innerHTML = `No hay ingresos registrados en meses anteriores. Puedes agregar tus ingresos de <strong>${formatPeriodString(targetPeriod)}</strong> con el botón <strong>+ Agregar Fila</strong>.`;
        }
    }

    if (templateItems.length === 0) {
        const emptyTr = document.createElement('tr');
        emptyTr.id = 'batch-income-empty-row';
        emptyTr.innerHTML = `
            <td colspan="7" style="text-align: center; padding: 30px; color: var(--color-text-muted);">
                <i data-lucide="inbox" style="width: 32px; height: 32px; margin-bottom: 8px; opacity: 0.6;"></i>
                <p style="margin: 0; font-size: 0.88rem; font-weight: 500;">No hay ingresos registrados en meses anteriores para replicar.</p>
                <button type="button" class="btn btn-secondary" id="btn-batch-income-add-first" style="margin-top: 10px; font-size: 0.8rem;">
                    <i data-lucide="plus"></i> Agregar Primer Ingreso
                </button>
            </td>
        `;
        tbody.appendChild(emptyTr);
        const addFirstBtn = emptyTr.querySelector('#btn-batch-income-add-first');
        addFirstBtn?.addEventListener('click', addBatchIncomeRow);
    } else {
        let currentRenderGroup = null;
        templateItems.forEach(item => {
            const itemGroup = getIncomeCategoryGroup(item.cat);
            if (itemGroup !== currentRenderGroup) {
                currentRenderGroup = itemGroup;
                const groupTr = document.createElement('tr');
                groupTr.className = 'batch-group-header-row';
                groupTr.innerHTML = `
                    <td colspan="7" style="background: rgba(16, 185, 129, 0.08); padding: 7px 14px; font-size: 0.76rem; font-weight: 800; color: var(--color-income); letter-spacing: 0.5px; border-top: 1px solid rgba(255,255,255,0.06); border-bottom: 1px solid rgba(255,255,255,0.06);">
                        <i data-lucide="folder" style="width: 12px; height: 12px; vertical-align: middle; margin-right: 6px;"></i>
                        <span style="vertical-align: middle;">${escapeHtml(itemGroup)}</span>
                    </td>
                `;
                tbody.appendChild(groupTr);
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="text-align: center;">
                    <input type="checkbox" class="batch-income-row-check" checked>
                </td>
                <td>
                    <input type="text" class="batch-table-input batch-ref-input" value="${escapeHtml(item.ref)}">
                </td>
                <td>
                    <select class="batch-table-input batch-cat-select">
                        ${getIncomeCategorySelectHtml(item.cat)}
                    </select>
                </td>
                <td>
                    <input type="number" class="batch-table-input batch-amount-input" value="${item.amount}" min="0" step="1000" style="text-align: right; font-weight: 700; color: var(--color-income);">
                </td>
                <td>
                    <input type="date" class="batch-table-input batch-date-input" value="${item.date}">
                </td>
                <td>
                    <select class="batch-table-input batch-status-select">
                        <option value="paid" ${item.status === 'paid' ? 'selected' : ''}>Pagado</option>
                        <option value="pending" ${item.status === 'pending' ? 'selected' : ''}>Pendiente</option>
                    </select>
                </td>
                <td style="text-align: center;">
                    <button type="button" class="btn btn-danger btn-icon btn-remove-batch-income-row" title="Eliminar fila">
                        <i data-lucide="trash-2"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    const inputs = tbody.querySelectorAll('.batch-amount-input, .batch-income-row-check');
    inputs.forEach(input => {
        input.addEventListener('input', updateBatchIncomeTotalSummary);
        input.addEventListener('change', updateBatchIncomeTotalSummary);
    });

    const delBtns = tbody.querySelectorAll('.btn-remove-batch-income-row');
    delBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('tr')?.remove();
            updateBatchIncomeTotalSummary();
            if (tbody.querySelectorAll('tr:not(#batch-income-empty-row):not(.batch-group-header-row)').length === 0) {
                populateBatchIncomesTable(targetPeriod);
            }
        });
    });

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }

    updateBatchIncomeTotalSummary();
}

function addBatchIncomeRow() {
    const tbody = document.getElementById('batch-incomes-tbody');
    if (!tbody) return;

    const emptyRow = document.getElementById('batch-income-empty-row');
    if (emptyRow) emptyRow.remove();

    const monthInput = document.getElementById('batch-income-month-input');
    const periodKey = (monthInput && monthInput.value) ? monthInput.value : new Date().toISOString().substring(0, 7);
    const [year, month] = periodKey.split('-');
    const defaultPaymentDate = `${year}-${month}-05`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td style="text-align: center;">
            <input type="checkbox" class="batch-income-row-check" checked>
        </td>
        <td>
            <input type="text" class="batch-table-input batch-ref-input" placeholder="Nombre de cliente / propiedad / causa...">
        </td>
        <td>
            <select class="batch-table-input batch-cat-select">
                ${getIncomeCategorySelectHtml('brokerage-administration')}
            </select>
        </td>
        <td>
            <input type="number" class="batch-table-input batch-amount-input" value="0" min="0" step="1000" style="text-align: right; font-weight: 700; color: var(--color-income);">
        </td>
        <td>
            <input type="date" class="batch-table-input batch-date-input" value="${defaultPaymentDate}">
        </td>
        <td>
            <select class="batch-table-input batch-status-select">
                <option value="paid">Pagado</option>
                <option value="pending">Pendiente</option>
            </select>
        </td>
        <td style="text-align: center;">
            <button type="button" class="btn btn-danger btn-icon btn-remove-batch-income-row" title="Eliminar fila">
                <i data-lucide="trash-2"></i>
            </button>
        </td>
    `;

    tbody.appendChild(tr);

    const inputs = tr.querySelectorAll('.batch-amount-input, .batch-income-row-check');
    inputs.forEach(input => {
        input.addEventListener('input', updateBatchIncomeTotalSummary);
        input.addEventListener('change', updateBatchIncomeTotalSummary);
    });

    const delBtn = tr.querySelector('.btn-remove-batch-income-row');
    delBtn?.addEventListener('click', () => {
        tr.remove();
        updateBatchIncomeTotalSummary();
    });

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }

    updateBatchIncomeTotalSummary();
}

function updateBatchIncomeTotalSummary() {
    let total = 0;
    let selectedCount = 0;
    const tbody = document.getElementById('batch-incomes-tbody');
    if (!tbody) return;
    const rows = tbody.querySelectorAll('tr:not(#batch-income-empty-row):not(.batch-group-header-row)');
    
    rows.forEach(tr => {
        const check = tr.querySelector('.batch-income-row-check');
        const amountInput = tr.querySelector('.batch-amount-input');
        
        if (check && check.checked && amountInput) {
            const val = parseFloat(amountInput.value) || 0;
            total += Math.abs(val);
            selectedCount++;
        }
    });

    const summaryLbl = document.getElementById('batch-income-total-summary');
    if (summaryLbl) {
        summaryLbl.textContent = `Total Ingresos (${selectedCount}): ${formatCurrency(total)}`;
    }
}

function saveBatchIncomes() {
    if (!currentUser) {
        showToast('Debes iniciar sesión para registrar ingresos.', 'error');
        return;
    }

    const monthInput = document.getElementById('batch-income-month-input');
    const periodKey = (monthInput && monthInput.value) ? monthInput.value : new Date().toISOString().substring(0, 7);
    const tbody = document.getElementById('batch-incomes-tbody');
    if (!tbody) return;
    const rows = tbody.querySelectorAll('tr:not(#batch-income-empty-row):not(.batch-group-header-row)');
    
    const itemsToSave = [];

    rows.forEach(tr => {
        const check = tr.querySelector('.batch-income-row-check');
        if (check && check.checked) {
            const refInput = tr.querySelector('.batch-ref-input');
            const catSelect = tr.querySelector('.batch-cat-select');
            const amountInput = tr.querySelector('.batch-amount-input');
            const dateInput = tr.querySelector('.batch-date-input');
            const statusSelect = tr.querySelector('.batch-status-select');

            const reference = refInput ? refInput.value.trim() : '';
            const category = catSelect ? catSelect.value : 'brokerage-administration';
            const amount = amountInput ? Math.abs(parseFloat(amountInput.value) || 0) : 0;
            const date = dateInput ? dateInput.value : `${periodKey}-05`;
            const status = statusSelect ? statusSelect.value : 'paid';

            if (reference && amount > 0) {
                itemsToSave.push({
                    reference,
                    category,
                    amount,
                    date,
                    period: periodKey,
                    status
                });
            }
        }
    });

    if (itemsToSave.length === 0) {
        showToast('Por favor, selecciona al menos un ingreso con monto mayor a 0 para guardar.', 'error');
        return;
    }

    const summaryLbl = document.getElementById('batch-income-total-summary');
    const totalText = summaryLbl ? summaryLbl.textContent : '';
    if (confirm(`Se registrarán ${itemsToSave.length} ingresos en el período ${formatPeriodString(periodKey)} por un total de ${totalText.replace(/Total Ingresos \(\d+\): /, '')}.\n\n¿Deseas continuar?`)) {
        const saveBtn = document.getElementById('btn-save-batch-incomes');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span>Guardando ingresos...</span>';
        }

        const promises = itemsToSave.map(item => {
            const finalId = 'tx-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
            const txRef = doc(db, "transactions", finalId);
            return setDoc(txRef, {
                id: finalId,
                userId: currentUser.uid,
                profile: currentProfile,
                type: 'income',
                category: item.category,
                date: item.date,
                period: item.period,
                reference: item.reference,
                amount: item.amount,
                status: item.status,
                notes: 'Carga masiva mensual de ingresos',
                attachment: null
            });
        });

        Promise.all(promises)
            .then(() => {
                showToast(`¡Se registraron ${itemsToSave.length} ingresos exitosamente en ${formatPeriodString(periodKey)}!`);
                closeBatchIncomesModal();
            })
            .catch(err => {
                showToast('Error al guardar ingresos masivos en la nube.', 'error');
                console.error(err);
            })
            .finally(() => {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = '<i data-lucide="check-circle"></i><span>Guardar Todos los Ingresos</span>';
                    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
                }
            });
    }
}

function exportToExcel() {
    if (typeof XLSX === 'undefined') {
        showToast('La biblioteca para exportar a Excel no se ha cargado aún.', 'error');
        return;
    }
    if (transactions.length === 0) {
        showToast('No hay transacciones registradas para exportar.', 'error');
        return;
    }

    const wb = XLSX.utils.book_new();

    // Helper to autofit column widths so text is never truncated
    const autofitCols = (data) => {
        if (!data || data.length === 0) return [];
        const keys = Object.keys(data[0]);
        return keys.map(key => {
            let maxLen = key.toString().length;
            data.forEach(row => {
                const val = row[key];
                if (val !== null && val !== undefined) {
                    const len = val.toString().length;
                    if (len > maxLen) maxLen = len;
                }
            });
            return { wch: Math.max(maxLen + 4, 14) };
        });
    };

    // --- HOJA 1: Resumen Mensual Consolidado ---
    const monthlySummary = {};
    let totalJudicial = 0;
    let totalBrokerage = 0;
    let totalExpensesAll = 0;

    transactions.forEach(tx => {
        const monthKey = tx.period;
        if (!monthlySummary[monthKey]) {
            monthlySummary[monthKey] = { judicial: 0, brokerage: 0, expenses: 0 };
        }
        const amt = Number(tx.amount);
        if (tx.type === 'income') {
            if (tx.category.startsWith('judicial')) {
                monthlySummary[monthKey].judicial += amt;
                totalJudicial += amt;
            } else {
                monthlySummary[monthKey].brokerage += amt;
                totalBrokerage += amt;
            }
        } else if (tx.type === 'expense') {
            monthlySummary[monthKey].expenses += amt;
            totalExpensesAll += amt;
        }
    });

    const summaryData = Object.keys(monthlySummary).sort().reverse().map(monthKey => {
        const item = monthlySummary[monthKey];
        const totalInc = item.judicial + item.brokerage;
        const netResult = totalInc - item.expenses;
        const margin = totalInc > 0 ? ((netResult / totalInc) * 100).toFixed(1) + '%' : '0%';
        return {
            'Período Imputación': formatPeriodString(monthKey),
            'Ingresos Judiciales ($)': item.judicial,
            'Ingresos Corretaje ($)': item.brokerage,
            'Ingresos Totales ($)': totalInc,
            'Gastos Totales ($)': item.expenses,
            'Resultado Neto ($)': netResult,
            'Margen de Rentabilidad': margin
        };
    });

    // Grand Total Row
    const grandInc = totalJudicial + totalBrokerage;
    const grandNet = grandInc - totalExpensesAll;
    const grandMargin = grandInc > 0 ? ((grandNet / grandInc) * 100).toFixed(1) + '%' : '0%';

    summaryData.push({
        'Período Imputación': 'TOTAL ACUMULADO HISTÓRICO',
        'Ingresos Judiciales ($)': totalJudicial,
        'Ingresos Corretaje ($)': totalBrokerage,
        'Ingresos Totales ($)': grandInc,
        'Gastos Totales ($)': totalExpensesAll,
        'Resultado Neto ($)': grandNet,
        'Margen de Rentabilidad': grandMargin
    });

    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    wsSummary['!cols'] = autofitCols(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen Mensual");

    // --- HOJA 2: Gastos por Mes (Ordenados de mayor a menor gasto) ---
    const expenseTxs = transactions.filter(tx => tx.type === 'expense');
    expenseTxs.sort((a, b) => {
        if (b.period !== a.period) return b.period.localeCompare(a.period);
        return Number(b.amount) - Number(a.amount);
    });

    const expensesData = expenseTxs.map(tx => ({
        'Período Imputación': formatPeriodString(tx.period),
        'Fecha Pago/Gasto': tx.date,
        'Categoría Gasto': getCategoryLabel(tx.type, tx.category),
        'Proveedor / Concepto Gasto': tx.reference,
        'Monto Gasto ($)': Number(tx.amount),
        'Estado de Pago': tx.status === 'paid' ? 'Pagado' : 'Pendiente',
        'Notas / Observaciones': tx.notes || ''
    }));

    const wsExpenses = XLSX.utils.json_to_sheet(expensesData);
    wsExpenses['!cols'] = autofitCols(expensesData);
    XLSX.utils.book_append_sheet(wb, wsExpenses, "Gastos Ordenados por Mes");

    // --- HOJA 3: Historial Completo de Transacciones ---
    const allData = transactions.map(tx => ({
        'ID Transacción': tx.id,
        'Fecha Imputación': tx.date,
        'Período Contable': formatPeriodString(tx.period),
        'Tipo Operación': tx.type === 'income' ? 'Ingreso' : 'Gasto',
        'Categoría Detallada': getCategoryLabel(tx.type, tx.category),
        'Cliente / Proveedor / Concepto': tx.reference,
        'Monto Operación ($)': Number(tx.amount),
        'Estado Transacción': tx.status === 'paid' ? 'Cobrado / Pagado' : 'Pendiente',
        'Notas / Observaciones': tx.notes || ''
    }));

    const wsAll = XLSX.utils.json_to_sheet(allData);
    wsAll['!cols'] = autofitCols(allData);
    XLSX.utils.book_append_sheet(wb, wsAll, "Historial Completo");

    const filename = `Caro_Sebastiani_Finanzas_${new Date().toISOString().substring(0,10)}.xlsx`;
    XLSX.writeFile(wb, filename);

    showToast('¡Reporte en Excel (.xlsx) exportado con columnas justificadas y totales!');
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
    elements.btnCloseReminder?.addEventListener('click', closeExportReminderModal);
    elements.btnCloseReminderFoot?.addEventListener('click', closeExportReminderModal);
    elements.btnReminderEmail?.addEventListener('click', handleReminderEmail);
    elements.btnReminderCopy?.addEventListener('click', handleReminderCopy);
    elements.exportReminderModal?.addEventListener('click', (e) => {
        if (e.target === elements.exportReminderModal) closeExportReminderModal();
    });
}

function setupAuthControls() {
    // Handle Login Form Submit
    elements.loginForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = elements.loginEmail?.value?.trim();
        const password = elements.loginPassword;
        if (!email || !password) return;
        
        if (elements.loginErrorMsg) elements.loginErrorMsg.textContent = 'Autenticando...';
        
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
                if (elements.loginErrorMsg) elements.loginErrorMsg.textContent = message;
            });
    });
    
    // Handle Logout Click
    elements.btnLogout?.addEventListener('click', (e) => {
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
    elements.profileSwitchEmpresa?.addEventListener('click', () => switchProfile('empresa'));
    elements.profileSwitchPersonal?.addEventListener('click', () => switchProfile('personal'));
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
        elements.mobileDrawer?.classList.add('active');
    };
    
    const closeDrawer = () => {
        elements.mobileDrawer?.classList.remove('active');
    };
    
    // Toggle menu button opens drawer
    elements.btnMenuToggle?.addEventListener('click', openDrawer);
    
    // Close button and overlay close drawer
    elements.btnCloseDrawer?.addEventListener('click', closeDrawer);
    elements.mobileDrawerOverlay?.addEventListener('click', closeDrawer);
    
    // Floating Add button on mobile opens transaction modal
    elements.btnMobileAdd?.addEventListener('click', () => {
        openModal(false);
    });
    
    // Profile Switchers inside Drawer
    elements.drawerSwitchEmpresa?.addEventListener('click', () => {
        switchProfile('empresa');
        closeDrawer();
    });
    elements.drawerSwitchPersonal?.addEventListener('click', () => {
        switchProfile('personal');
        closeDrawer();
    });
    
    // Drawer Batch Incomes button
    document.getElementById('drawer-btn-batch-incomes')?.addEventListener('click', () => {
        closeDrawer();
        openBatchIncomesModal();
    });

    // Drawer Batch Expenses button
    document.getElementById('drawer-btn-batch-expenses')?.addEventListener('click', () => {
        closeDrawer();
        openBatchExpensesModal();
    });
    
    // Drawer Logout button
    elements.btnDrawerLogout?.addEventListener('click', (e) => {
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

// Global Exports
window.openBatchIncomesModal = openBatchIncomesModal;
window.closeBatchIncomesModal = closeBatchIncomesModal;
window.updateBatchIncomeTotalSummary = updateBatchIncomeTotalSummary;
window.openBatchExpensesModal = openBatchExpensesModal;
window.closeBatchExpensesModal = closeBatchExpensesModal;
window.openModal = openModal;
window.closeModal = closeModal;
window.switchView = switchView;
window.updateBatchTotalSummary = updateBatchTotalSummary;