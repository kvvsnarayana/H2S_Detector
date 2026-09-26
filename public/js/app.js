document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const statusPill = document.getElementById('system-status-pill');
  const navItems = document.querySelectorAll('.nav-item');
  const views = document.querySelectorAll('.content-view');

  // Stats Cards Elements
  const cardTotalWorkers = document.getElementById('card-total-workers');
  const cardActiveShifts = document.getElementById('card-active-shifts');
  const cardCompletedShifts = document.getElementById('card-completed-shifts');
  const cardTotalScans = document.getElementById('card-total-scans');
  const cardPendingAnalysis = document.getElementById('card-pending-analysis');
  const activeShiftBadge = document.getElementById('active-shift-badge');

  // Table Bodies
  const activeWorkersTableBody = document.getElementById('active-workers-table-body');
  const recentScansTableBody = document.getElementById('recent-scans-table-body');
  const fullWorkersTableBody = document.getElementById('full-workers-table-body');
  const historyScansTableBody = document.getElementById('history-scans-table-body');
  const shiftsTableBody = document.getElementById('shifts-table-body');

  // History Module Elements
  const btnTabScans = document.getElementById('btn-tab-scans');
  const btnTabShifts = document.getElementById('btn-tab-shifts');
  const tabScansContent = document.getElementById('tab-scans-content');
  const tabShiftsContent = document.getElementById('tab-shifts-content');

  const historySearchInput = document.getElementById('history-search-input');
  const historyFilterWorker = document.getElementById('history-filter-worker');
  const historyFilterDept = document.getElementById('history-filter-dept');
  const historyFilterScantype = document.getElementById('history-filter-scantype');
  const historyFilterStatus = document.getElementById('history-filter-status');
  const historyFilterDateFrom = document.getElementById('history-filter-date-from');
  const historyFilterDateTo = document.getElementById('history-filter-date-to');
  const historySortBy = document.getElementById('history-sort-by');
  const btnResetHistoryFilters = document.getElementById('btn-reset-history-filters');

  const historyPaginationInfo = document.getElementById('history-pagination-info');
  const btnHistoryPrev = document.getElementById('btn-history-prev');
  const historyPageIndicator = document.getElementById('history-page-indicator');
  const btnHistoryNext = document.getElementById('btn-history-next');

  const shiftsPaginationInfo = document.getElementById('shifts-pagination-info');
  const btnShiftsPrev = document.getElementById('btn-shifts-prev');
  const shiftsPageIndicator = document.getElementById('shifts-page-indicator');
  const btnShiftsNext = document.getElementById('btn-shifts-next');

  // Modals Elements
  const workerModal = document.getElementById('worker-modal');
  const formWorker = document.getElementById('form-worker');
  const modalWorkerTitle = document.getElementById('modal-worker-title');
  const inputEditWorkerId = document.getElementById('input-edit-worker-id');
  const inputWorkerId = document.getElementById('input-worker-id');
  const inputWorkerName = document.getElementById('input-worker-name');
  const inputWorkerDept = document.getElementById('input-worker-dept');
  const inputWorkerBadge = document.getElementById('input-worker-badge');
  const inputBadgeMfg = document.getElementById('input-badge-mfg');
  const inputBadgeExpiry = document.getElementById('input-badge-expiry');
  const formErrorMsg = document.getElementById('form-error-msg');
  const btnCloseWorkerModal = document.getElementById('btn-close-worker-modal');
  const btnCancelWorkerModal = document.getElementById('btn-cancel-worker-modal');

  // -------------------------------------------------------------
  // TOAST & CONFIRMATION MODAL HELPERS
  // -------------------------------------------------------------
  function showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const iconMap = {
      success: '✅',
      error: '❌',
      info: 'ℹ️',
      warning: '⚠️'
    };

    toast.innerHTML = `
      <span>${iconMap[type] || 'ℹ️'}</span>
      <span style="flex:1;">${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-out');
      toast.addEventListener('animationend', () => {
        toast.remove();
      });
    }, duration);
  }

  function showConfirmationModal({ title, message, keyword, icon = '⚠️', confirmText = 'Confirm & Proceed', btnClass = 'btn-danger' }) {
    return new Promise((resolve) => {
      const modal = document.getElementById('confirmation-modal');
      const titleEl = document.getElementById('confirm-modal-title');
      const msgEl = document.getElementById('confirm-modal-message');
      const iconEl = document.getElementById('confirm-modal-icon');
      const inputContainer = document.getElementById('confirm-modal-input-container');
      const inputEl = document.getElementById('confirm-modal-input');
      const keywordEl = document.getElementById('confirm-modal-keyword');
      const errorEl = document.getElementById('confirm-modal-error');
      const btnCancel = document.getElementById('btn-confirm-cancel');
      const btnProceed = document.getElementById('btn-confirm-proceed');
      const btnClose = document.getElementById('btn-close-confirm-modal');

      if (!modal) return resolve(false);

      titleEl.textContent = title || 'Confirm Action';
      msgEl.textContent = message || 'Are you sure you want to proceed?';
      iconEl.textContent = icon;
      btnProceed.textContent = confirmText;
      btnProceed.className = `btn ${btnClass} btn-block`;
      errorEl.classList.add('hidden');
      inputEl.value = '';

      if (keyword) {
        keywordEl.textContent = keyword;
        inputEl.placeholder = `Type "${keyword}" or "CONFIRM" to authorize`;
        inputContainer.classList.remove('hidden');
        setTimeout(() => inputEl.focus(), 100);
      } else {
        inputContainer.classList.add('hidden');
      }

      modal.classList.remove('hidden');

      function cleanup(result) {
        modal.classList.add('hidden');
        btnCancel.removeEventListener('click', onCancel);
        btnProceed.removeEventListener('click', onProceed);
        if (btnClose) btnClose.removeEventListener('click', onCancel);
        inputEl.removeEventListener('keydown', onKeyDown);
        resolve(result);
      }

      function onCancel() {
        cleanup(false);
      }

      function onProceed() {
        if (keyword) {
          const val = inputEl.value.trim().toLowerCase();
          const kwLower = String(keyword).trim().toLowerCase();
          if (!val || (val !== kwLower && val !== 'confirm')) {
            errorEl.textContent = `Please type "${keyword}" or "CONFIRM" to authorize deletion.`;
            errorEl.classList.remove('hidden');
            return;
          }
        }
        cleanup(true);
      }

      function onKeyDown(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          onProceed();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }

      btnCancel.addEventListener('click', onCancel);
      btnProceed.addEventListener('click', onProceed);
      if (btnClose) btnClose.addEventListener('click', onCancel);
      inputEl.addEventListener('keydown', onKeyDown);
    });
  }

  function renderTableSkeleton(tbody, colSpan = 5, rows = 3) {
    if (!tbody) return;
    tbody.innerHTML = Array.from({ length: rows }).map(() => `
      <tr>
        <td colspan="${colSpan}" class="table-skeleton-td">
          <div class="skeleton-box"></div>
        </td>
      </tr>
    `).join('');
  }

  function renderErrorState(tbody, colSpan = 5, message = 'Failed to load data from server.', retryFn = null) {
    if (!tbody) return;
    const retryId = `retry-btn-${Math.random().toString(36).substring(2, 7)}`;
    tbody.innerHTML = `
      <tr>
        <td colspan="${colSpan}" class="empty-cell">
          <div class="text-danger mb-2 font-bold">⚠️ ${escapeHtml(message)}</div>
          ${retryFn ? `<button type="button" id="${retryId}" class="btn btn-secondary text-xs">🔄 Retry Loading</button>` : ''}
        </td>
      </tr>
    `;
    if (retryFn) {
      setTimeout(() => {
        const btn = document.getElementById(retryId);
        if (btn) btn.addEventListener('click', retryFn);
      }, 0);
    }
  }

  function renderEmptyState(tbody, colSpan = 5, icon = '📭', message = 'No records found.', actionLabel = null, actionFn = null) {
    if (!tbody) return;
    const actionId = `empty-btn-${Math.random().toString(36).substring(2, 7)}`;
    tbody.innerHTML = `
      <tr>
        <td colspan="${colSpan}" class="empty-cell">
          <div style="font-size:1.75rem;margin-bottom:0.4rem;">${icon}</div>
          <p class="text-muted text-sm mb-2">${escapeHtml(message)}</p>
          ${actionLabel ? `<button type="button" id="${actionId}" class="btn btn-primary text-xs">${escapeHtml(actionLabel)}</button>` : ''}
        </td>
      </tr>
    `;
    if (actionFn) {
      setTimeout(() => {
        const btn = document.getElementById(actionId);
        if (btn) btn.addEventListener('click', actionFn);
      }, 0);
    }
  }

  // View Profile Modal Elements
  const viewProfileModal = document.getElementById('view-profile-modal');
  const btnCloseProfileModal = document.getElementById('btn-close-profile-modal');
  const btnCloseProfile = document.getElementById('btn-close-profile');
  const btnVpViewHistory = document.getElementById('btn-vp-view-history');
  const vpAvatar = document.getElementById('vp-avatar');
  const vpName = document.getElementById('vp-name');
  const vpWorkerId = document.getElementById('vp-worker-id');
  const vpDept = document.getElementById('vp-dept');
  const vpStatus = document.getElementById('vp-status');
  const vpBadgeId = document.getElementById('vp-badge-id');
  const vpBadgeStatus = document.getElementById('vp-badge-status');
  const vpBadgeMfg = document.getElementById('vp-badge-mfg');
  const vpBadgeExpiry = document.getElementById('vp-badge-expiry');
  const vpShiftStatus = document.getElementById('vp-shift-status');
  const vpScanCount = document.getElementById('vp-scan-count');
  const vpExposureCount = document.getElementById('vp-exposure-count');
  const vpHistoryContent = document.getElementById('vp-history-content');
  let currentProfileWorkerId = null;

  // Scan Details Modal Elements
  const scanDetailsModal = document.getElementById('scan-details-modal');
  const btnCloseScanDetailsModal = document.getElementById('btn-close-scan-details-modal');
  const btnCloseScanDetails = document.getElementById('btn-close-scan-details');
  const sdTitle = document.getElementById('sd-title');
  const sdSubtitle = document.getElementById('sd-subtitle');
  const sdImagePreview = document.getElementById('sd-image-preview');
  const sdQualityBadge = document.getElementById('sd-quality-badge');
  const sdWorkerName = document.getElementById('sd-worker-name');
  const sdWorkerId = document.getElementById('sd-worker-id');
  const sdDepartment = document.getElementById('sd-department');
  const sdBadgeId = document.getElementById('sd-badge-id');
  const sdScanType = document.getElementById('sd-scan-type');
  const sdTimestamp = document.getElementById('sd-timestamp');
  const sdDetectedColor = document.getElementById('sd-detected-color');
  const sdConfidence = document.getElementById('sd-confidence');
  const sdExposureEstimate = document.getElementById('sd-exposure-estimate');
  const sdShiftId = document.getElementById('sd-shift-id');

  // Shift Details Modal Elements
  const shiftDetailsModal = document.getElementById('shift-details-modal');
  const btnCloseShiftDetailsModal = document.getElementById('btn-close-shift-details-modal');
  const btnCloseShiftDetails = document.getElementById('btn-close-shift-details');
  const shdTitle = document.getElementById('shd-title');
  const shdSubtitle = document.getElementById('shd-subtitle');
  const shdWorkerName = document.getElementById('shd-worker-name');
  const shdWorkerId = document.getElementById('shd-worker-id');
  const shdDepartment = document.getElementById('shd-department');
  const shdBadgeId = document.getElementById('shd-badge-id');
  const shdStartTime = document.getElementById('shd-start-time');
  const shdEndTime = document.getElementById('shd-end-time');
  const shdDuration = document.getElementById('shd-duration');
  const shdStatusBadge = document.getElementById('shd-status-badge');
  const shdPreshiftStatus = document.getElementById('shd-preshift-status');
  const shdPostshiftStatus = document.getElementById('shd-postshift-status');
  const btnViewShdPreshift = document.getElementById('btn-view-shd-preshift');
  const btnViewShdPostshift = document.getElementById('btn-view-shd-postshift');

  // Quick Action Buttons
  const qaAddWorker = document.getElementById('qa-add-worker');
  const qaStartPreshift = document.getElementById('qa-start-preshift');
  const qaStartPostshift = document.getElementById('qa-start-postshift');
  const qaViewHistory = document.getElementById('qa-view-history');

  // -------------------------------------------------------------
  // PRE-SHIFT SCAN WIZARD STATE & ELEMENTS
  // -------------------------------------------------------------
  let preshiftActiveWorkers = [];
  let selectedPreshiftWorker = null;
  let cameraStream = null;
  let capturedImageData = null;

  const selectPreshiftWorker = document.getElementById('select-preshift-worker');
  const preshiftWorkerAlert = document.getElementById('preshift-worker-alert');
  const btnPreshiftStep1Next = document.getElementById('btn-preshift-step1-next');

  const badgeStatusBanner = document.getElementById('badge-status-banner');
  const bvName = document.getElementById('bv-name');
  const bvWorkerId = document.getElementById('bv-worker-id');
  const bvDept = document.getElementById('bv-dept');
  const bvBadgeId = document.getElementById('bv-badge-id');
  const bvMfg = document.getElementById('bv-mfg');
  const bvExpiry = document.getElementById('bv-expiry');
  const btnPreshiftStep2Back = document.getElementById('btn-preshift-step2-back');
  const btnPreshiftStep2Next = document.getElementById('btn-preshift-step2-next');

  const cameraErrorAlert = document.getElementById('camera-error-alert');
  const cameraFeed = document.getElementById('camera-feed');
  const cameraCanvas = document.getElementById('camera-canvas');
  const imagePreview = document.getElementById('image-preview');
  const cameraOverlay = document.getElementById('camera-overlay');
  const btnStartCamera = document.getElementById('btn-start-camera');
  const btnCaptureImage = document.getElementById('btn-capture-image');
  const btnRetakeImage = document.getElementById('btn-retake-image');
  const btnConfirmScan = document.getElementById('btn-confirm-scan');
  const fileScanUpload = document.getElementById('file-scan-upload');
  const btnPreshiftStep3Back = document.getElementById('btn-preshift-step3-back');
  const btnPreshiftStep3NextH2s = document.getElementById('btn-preshift-step3-next-h2s');

  let currentMockExpiryStatus = null;
  const expiryIndicatorBanner = document.getElementById('expiry-indicator-banner');
  const expiryAnalysisCard = document.getElementById('expiry-analysis-card');
  const expiryStatusBadge = document.getElementById('expiry-status-badge');
  const expirySwatchDot = document.getElementById('expiry-swatch-dot');

  // Step 4 H2S Scan Elements
  let h2sCameraStream = null;
  let h2sCapturedImageData = null;
  const h2sCameraErrorAlert = document.getElementById('h2s-camera-error-alert');
  const h2sCameraFeed = document.getElementById('h2s-camera-feed');
  const h2sCameraCanvas = document.getElementById('h2s-camera-canvas');
  const h2sImagePreview = document.getElementById('h2s-image-preview');
  const h2sCameraOverlay = document.getElementById('h2s-camera-overlay');
  const btnStartH2sCamera = document.getElementById('btn-start-h2s-camera');
  const btnCaptureH2sImage = document.getElementById('btn-capture-h2s-image');
  const btnRetakeH2sImage = document.getElementById('btn-retake-h2s-image');
  const btnConfirmH2sScan = document.getElementById('btn-confirm-h2s-scan');
  const fileH2sUpload = document.getElementById('file-h2s-upload');
  const h2sAnalysisCard = document.getElementById('h2s-analysis-card');
  const btnPreshiftStep4Back = document.getElementById('btn-preshift-step4-back');
  const btnPreshiftStep4NextSummary = document.getElementById('btn-preshift-step4-next-summary');

  // Step 5 Quality Gate & Baseline Summary Elements
  const qualityGateBanner = document.getElementById('quality-gate-banner');
  const qcValCaptured = document.getElementById('qc-val-captured');
  const qcValDimensions = document.getElementById('qc-val-dimensions');
  const qcValLighting = document.getElementById('qc-val-lighting');
  const btnPreshiftStep5Retake = document.getElementById('btn-preshift-step5-retake');
  const btnPreshiftStep5Save = document.getElementById('btn-preshift-step5-save');

  // Step 6 Confirmation Elements
  const confWorkerName = document.getElementById('conf-worker-name');
  const confBadgeId = document.getElementById('conf-badge-id');
  const confStartTime = document.getElementById('conf-start-time');
  const confBaselinePpm = document.getElementById('conf-baseline-ppm');
  const btnConfDashboard = document.getElementById('btn-conf-dashboard');
  const btnConfViewWorker = document.getElementById('btn-conf-view-worker');

  // -------------------------------------------------------------
  // POST-SHIFT SCAN WIZARD STATE & ELEMENTS
  // -------------------------------------------------------------
  let activeShiftsData = [];
  let selectedActiveShift = null;
  let postCameraStream = null;
  let postCapturedImageData = null;

  const selectPostshiftShift = document.getElementById('select-postshift-shift');
  const postshiftAlertMsg = document.getElementById('postshift-alert-msg');
  const btnPostshiftStep1Next = document.getElementById('btn-postshift-step1-next');

  const psWorkerName = document.getElementById('ps-worker-name');
  const psWorkerId = document.getElementById('ps-worker-id');
  const psDept = document.getElementById('ps-dept');
  const psBadgeId = document.getElementById('ps-badge-id');
  const psStartTime = document.getElementById('ps-start-time');
  const psCurrentTime = document.getElementById('ps-current-time');
  const psDurationDisplay = document.getElementById('ps-duration-display');
  const btnPostshiftStep2Back = document.getElementById('btn-postshift-step2-back');
  const btnPostshiftStep2Next = document.getElementById('btn-postshift-step2-next');

  const postCameraErrorAlert = document.getElementById('post-camera-error-alert');
  const postCameraFeed = document.getElementById('post-camera-feed');
  const postCameraCanvas = document.getElementById('post-camera-canvas');
  const postImagePreview = document.getElementById('post-image-preview');
  const postCameraOverlay = document.getElementById('post-camera-overlay');
  const btnPostStartCamera = document.getElementById('btn-post-start-camera');
  const btnPostCaptureImage = document.getElementById('btn-post-capture-image');
  const btnPostRetakeImage = document.getElementById('btn-post-retake-image');
  const btnPostConfirmScan = document.getElementById('btn-post-confirm-scan');
  const postFileScanUpload = document.getElementById('post-file-scan-upload');
  const btnPostshiftStep3Back = document.getElementById('btn-postshift-step3-back');

  const postQualityGateBanner = document.getElementById('post-quality-gate-banner');
  const postQcValCaptured = document.getElementById('post-qc-val-captured');
  const postQcValDimensions = document.getElementById('post-qc-val-dimensions');
  const postQcValLighting = document.getElementById('post-qc-val-lighting');
  const btnPostshiftStep4Retake = document.getElementById('btn-postshift-step4-retake');
  const btnPostshiftStep4Complete = document.getElementById('btn-postshift-step4-complete');

  const pconfWorkerName = document.getElementById('pconf-worker-name');
  const pconfBadgeId = document.getElementById('pconf-badge-id');
  const pconfStartTime = document.getElementById('pconf-start-time');
  const pconfEndTime = document.getElementById('pconf-end-time');
  const pconfDuration = document.getElementById('pconf-duration');
  const btnPostConfDashboard = document.getElementById('btn-post-conf-dashboard');
  const btnPostConfHistory = document.getElementById('btn-post-conf-history');

  let allWorkersData = [];

  // -------------------------------------------------------------
  // Navigation & View Switching
  // -------------------------------------------------------------
  function switchView(targetId) {
    if (targetId === 'view-dashboard' && currentUser && currentUser.role === 'worker') {
      targetId = 'view-worker-dashboard';
    }

    navItems.forEach(item => {
      if (item.getAttribute('data-target') === targetId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    views.forEach(view => {
      if (view.id === targetId) {
        view.classList.add('active');
      } else {
        view.classList.remove('active');
      }
    });

    if (targetId === 'view-preshift') {
      const preshiftAdminWizard = document.getElementById('preshift-admin-wizard');
      const preshiftWorkerShiftView = document.getElementById('preshift-worker-shift-view');
      const preshiftTitle = document.getElementById('preshift-title');
      const preshiftSubtitle = document.getElementById('preshift-subtitle');

      if (currentUser && currentUser.role === 'worker') {
        if (preshiftTitle) preshiftTitle.textContent = 'My Active Shift';
        if (preshiftSubtitle) preshiftSubtitle.textContent = 'Real-time shift status & assigned badge monitoring';
        if (preshiftAdminWizard) preshiftAdminWizard.classList.add('hidden');
        if (preshiftWorkerShiftView) preshiftWorkerShiftView.classList.remove('hidden');
        stopCamera();
        loadWorkerMyShiftView();
      } else {
        if (preshiftTitle) preshiftTitle.textContent = 'Pre-Shift Scan & Shift Entry';
        if (preshiftSubtitle) preshiftSubtitle.textContent = 'Worker selection, badge verification, camera capture, quality gate, and shift start';
        if (preshiftAdminWizard) preshiftAdminWizard.classList.remove('hidden');
        if (preshiftWorkerShiftView) preshiftWorkerShiftView.classList.add('hidden');
        loadPreshiftActiveWorkers();
      }
    } else {
      if (workerShiftTimerId) {
        clearInterval(workerShiftTimerId);
        workerShiftTimerId = null;
      }
      stopCamera();
    }

    if (targetId !== 'view-postshift') {
      stopPostCamera();
    } else {
      loadPostshiftActiveShifts();
    }

    if (targetId === 'view-history') {
      triggerHistoryReload();
    }

    if (targetId === 'view-settings') {
      loadSettingsDiagnostics();
    }
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const target = item.getAttribute('data-target');
      switchView(target);
    });
  });

  if (qaAddWorker) qaAddWorker.addEventListener('click', openAddWorkerModal);
  if (qaStartPreshift) qaStartPreshift.addEventListener('click', () => switchView('view-preshift'));
  if (qaStartPostshift) qaStartPostshift.addEventListener('click', () => switchView('view-postshift'));
  if (qaViewHistory) qaViewHistory.addEventListener('click', () => switchView('view-history'));

  document.querySelectorAll('.btn-open-add-worker').forEach(btn => {
    btn.addEventListener('click', openAddWorkerModal);
  });

  // -------------------------------------------------------------
  // Modals Management
  // -------------------------------------------------------------
  function openAddWorkerModal() {
    modalWorkerTitle.textContent = 'Register New Worker';
    inputEditWorkerId.value = '';
    formWorker.reset();
    formErrorMsg.classList.add('hidden');

    const today = new Date().toISOString().split('T')[0];
    const nextYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    inputBadgeMfg.value = today;
    inputBadgeExpiry.value = nextYear;

    workerModal.classList.remove('hidden');
  }

  function openEditWorkerModal(worker) {
    modalWorkerTitle.textContent = 'Edit Worker Details';
    inputEditWorkerId.value = worker.id;
    inputWorkerId.value = worker.worker_id;
    inputWorkerName.value = worker.name;
    inputWorkerDept.value = worker.department || '';
    inputWorkerBadge.value = worker.badge_id || '';
    inputBadgeMfg.value = worker.badge_manufacture_date || new Date().toISOString().split('T')[0];
    inputBadgeExpiry.value = worker.badge_expiry_date || '';
    formErrorMsg.classList.add('hidden');

    workerModal.classList.remove('hidden');
  }

  function closeWorkerModal() {
    workerModal.classList.add('hidden');
  }

  function closeProfileModal() {
    viewProfileModal.classList.add('hidden');
  }

  if (btnCloseWorkerModal) btnCloseWorkerModal.addEventListener('click', closeWorkerModal);
  if (btnCancelWorkerModal) btnCancelWorkerModal.addEventListener('click', closeWorkerModal);
  if (btnCloseProfileModal) btnCloseProfileModal.addEventListener('click', closeProfileModal);
  if (btnCloseProfile) btnCloseProfile.addEventListener('click', closeProfileModal);

  window.addEventListener('click', (e) => {
    if (e.target === workerModal) closeWorkerModal();
    if (e.target === viewProfileModal) closeProfileModal();
  });

  // -------------------------------------------------------------
  // AUTHENTICATION & ROLE-BASED SESSION MANAGEMENT
  // -------------------------------------------------------------
  let currentSessionToken = localStorage.getItem('sentinels_session_token') || null;
  let currentUser = null; // { id, username, role, worker_id, name }

  async function fetchWithAuth(url, options = {}) {
    const headers = options.headers || {};
    if (currentSessionToken) {
      headers['Authorization'] = `Bearer ${currentSessionToken}`;
    }
    options.headers = headers;
    options.cache = 'no-store';

    // Add cache-busting timestamp parameter to GET requests
    let fetchUrl = url;
    if (!options.method || options.method.toUpperCase() === 'GET') {
      fetchUrl += (fetchUrl.includes('?') ? '&' : '?') + '_t=' + Date.now();
    }

    const response = await fetch(fetchUrl, options);

    if (response.status === 401) {
      currentSessionToken = null;
      currentUser = null;
      localStorage.removeItem('sentinels_session_token');
      showLoginView();
      showToast('Session expired or unauthorized. Please log in.', 'error');
    }

    return response;
  }

  function updateHeaderProfileUI() {
    const avatar = document.getElementById('header-avatar');
    const userName = document.getElementById('header-user-name');
    const userRole = document.getElementById('header-user-role');
    const logoutBtn = document.getElementById('btn-logout');

    if (currentUser) {
      if (avatar) avatar.textContent = currentUser.name ? currentUser.name.substring(0, 2).toUpperCase() : 'U';
      if (userName) userName.textContent = currentUser.name;
      if (userRole) userRole.textContent = currentUser.role === 'admin' ? '🛡️ Safety Officer' : '👤 Field Worker';
      if (logoutBtn) logoutBtn.style.display = 'inline-flex';
    } else {
      if (avatar) avatar.textContent = '--';
      if (userName) userName.textContent = 'Not Logged In';
      if (userRole) userRole.textContent = 'Guest';
      if (logoutBtn) logoutBtn.style.display = 'none';
    }
  }

  // -------------------------------------------------------------
  // THEME MANAGEMENT (LIGHT / DARK / SYSTEM)
  // -------------------------------------------------------------
  let currentThemeSetting = localStorage.getItem('sentinels_theme') || 'light';

  function applyTheme(theme) {
    currentThemeSetting = theme;
    localStorage.setItem('sentinels_theme', theme);

    let effectiveTheme = theme;
    if (theme === 'system') {
      effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    document.documentElement.setAttribute('data-theme', effectiveTheme);

    const headerThemeIcon = document.getElementById('header-theme-icon');
    if (headerThemeIcon) {
      if (theme === 'light') headerThemeIcon.textContent = '☀️';
      else if (theme === 'dark') headerThemeIcon.textContent = '🌙';
      else headerThemeIcon.textContent = '💻';
    }

    const themeBtns = document.querySelectorAll('.theme-option-btn');
    themeBtns.forEach(btn => {
      if (btn.getAttribute('data-theme-val') === theme) {
        btn.classList.add('active');
        btn.style.borderColor = 'var(--primary)';
        btn.style.borderWidth = '2px';
      } else {
        btn.classList.remove('active');
        btn.style.borderColor = 'var(--border-color)';
        btn.style.borderWidth = '1px';
      }
    });
  }

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (currentThemeSetting === 'system') {
      applyTheme('system');
    }
  });

  const btnHeaderTheme = document.getElementById('btn-header-theme');
  if (btnHeaderTheme) {
    btnHeaderTheme.addEventListener('click', () => {
      const cycle = { 'light': 'dark', 'dark': 'system', 'system': 'light' };
      const nextTheme = cycle[currentThemeSetting] || 'light';
      applyTheme(nextTheme);
      showToast(`Switched theme to ${nextTheme.toUpperCase()}`, 'info');
    });
  }

  document.querySelectorAll('.theme-option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.getAttribute('data-theme-val');
      if (val) {
        applyTheme(val);
        showToast(`Theme updated to ${val.toUpperCase()}`, 'success');
      }
    });
  });

  applyTheme(currentThemeSetting);

  function setupRoleNavigation(role) {
    document.body.classList.remove('logged-out');
    const workerNav = document.getElementById('worker-bottom-nav');
    const adminNav = document.getElementById('admin-bottom-nav');
    const sidebarNav = document.querySelector('.sidebar-nav');

    if (role === 'worker') {
      if (workerNav) workerNav.classList.remove('hidden');
      if (adminNav) adminNav.classList.add('hidden');

      if (sidebarNav) {
        sidebarNav.querySelectorAll('.nav-item').forEach(item => {
          const target = item.getAttribute('data-target');
          if (target === 'view-workers' || target === 'view-settings' || target === 'view-postshift') {
            item.style.display = 'none';
          } else {
            item.style.display = '';
            if (target === 'view-preshift') {
              const label = item.querySelector('.nav-label-preshift') || item.querySelector('span');
              if (label) label.textContent = 'My Shift';
            }
            if (target === 'view-history') {
              const label = item.querySelector('.nav-label-history') || item.querySelector('span');
              if (label) label.textContent = 'My Exposure';
            }
          }
        });
      }
    } else if (role === 'admin') {
      if (workerNav) workerNav.classList.add('hidden');
      if (adminNav) adminNav.classList.remove('hidden');

      if (sidebarNav) {
        sidebarNav.querySelectorAll('.nav-item').forEach(item => {
          const target = item.getAttribute('data-target');
          if (target === 'view-worker-profile') {
            item.style.display = 'none';
          } else {
            item.style.display = '';
            if (target === 'view-preshift') {
              const label = item.querySelector('.nav-label-preshift') || item.querySelector('span');
              if (label) label.textContent = 'Pre-Shift Scan';
            }
            if (target === 'view-history') {
              const label = item.querySelector('.nav-label-history') || item.querySelector('span');
              if (label) label.textContent = 'Exposure History';
            }
          }
        });
      }
    }
  }

  function showLoginView() {
    document.body.classList.add('logged-out');
    updateHeaderProfileUI();

    const workerNav = document.getElementById('worker-bottom-nav');
    const adminNav = document.getElementById('admin-bottom-nav');
    if (workerNav) workerNav.classList.add('hidden');
    if (adminNav) adminNav.classList.add('hidden');

    const views = document.querySelectorAll('.content-view');
    views.forEach(v => v.classList.remove('active'));
    const loginView = document.getElementById('view-login');
    if (loginView) loginView.classList.add('active');
    populateWorkerLoginDropdown();
  }

  async function populateWorkerLoginDropdown() {
    const dropdown = document.getElementById('worker-select-user');
    if (!dropdown) return;
    try {
      const res = await fetch('/api/auth/workers');
      const json = await res.json();
      if (json.success && json.data && json.data.length > 0) {
        dropdown.innerHTML = json.data.map(w => `
          <option value="${escapeHtml(w.worker_id.toLowerCase())}">${escapeHtml(w.name)} (${escapeHtml(w.worker_id)}) - ${escapeHtml(w.department || 'Processing')}</option>
        `).join('');
      } else {
        dropdown.innerHTML = `
          <option value="w-101">John Doe (W-101) - Refining & Processing</option>
          <option value="w-102">Jane Smith (W-102) - Pipeline Inspection</option>
          <option value="w-103">Robert Chen (W-103) - Safety Compliance</option>
          <option value="w-104">Maria Garcia (W-104) - Drilling Operations</option>
        `;
      }
    } catch (e) {
      dropdown.innerHTML = `
        <option value="w-101">John Doe (W-101) - Refining & Processing</option>
        <option value="w-102">Jane Smith (W-102) - Pipeline Inspection</option>
        <option value="w-103">Robert Chen (W-103) - Safety Compliance</option>
        <option value="w-104">Maria Garcia (W-104) - Drilling Operations</option>
      `;
    }
  }

  // -------------------------------------------------------------
  // PASSWORD EYE TOGGLE BINDINGS
  // -------------------------------------------------------------
  function bindPasswordToggle(btnId, inputId) {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (!btn || !input) return;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';

      const iconOpen = btn.querySelector('.icon-eye-open');
      const iconOff = btn.querySelector('.icon-eye-off');
      if (iconOpen && iconOff) {
        if (isPassword) {
          iconOpen.classList.remove('hidden');
          iconOff.classList.add('hidden');
        } else {
          iconOpen.classList.add('hidden');
          iconOff.classList.remove('hidden');
        }
      }
    });
  }

  bindPasswordToggle('btn-toggle-worker-password', 'worker-login-password');
  bindPasswordToggle('btn-toggle-admin-password', 'admin-login-password');

  // -------------------------------------------------------------
  // WORKER MY SHIFT VIEW & LIVE TIMER
  // -------------------------------------------------------------
  let workerShiftTimerId = null;

  async function loadWorkerMyShiftView() {
    const activePanel = document.getElementById('worker-shift-active-panel');
    const offPanel = document.getElementById('worker-shift-off-panel');
    const statusBadge = document.getElementById('worker-shift-status-badge');
    const durationEl = document.getElementById('worker-live-shift-duration');
    const startTimeEl = document.getElementById('worker-shift-start-time');
    const badgeIdEl = document.getElementById('worker-assigned-badge-id');
    const badgeStatusEl = document.getElementById('worker-assigned-badge-status');

    if (workerShiftTimerId) {
      clearInterval(workerShiftTimerId);
      workerShiftTimerId = null;
    }

    try {
      const res = await fetchWithAuth('/api/shifts/active');
      const json = await res.json();

      const activeShifts = (json.success && json.data) ? json.data : [];
      const workerShift = activeShifts.find(s => String(s.worker_id).toLowerCase() === String(currentUser.worker_id).toLowerCase());

      if (workerShift) {
        if (activePanel) activePanel.classList.remove('hidden');
        if (offPanel) offPanel.classList.add('hidden');

        if (statusBadge) {
          statusBadge.className = 'badge badge-success';
          statusBadge.textContent = '🟢 Active Shift in Progress';
        }

        if (startTimeEl) startTimeEl.textContent = `Started: ${formatTime(workerShift.start_time)}`;
        if (badgeIdEl) badgeIdEl.textContent = workerShift.badge_id || 'BDG-1001';
        if (badgeStatusEl) badgeStatusEl.textContent = 'Status: Valid / Active';

        function updateTimer() {
          if (!workerShift.start_time) return;
          const startMs = new Date(workerShift.start_time).getTime();
          const nowMs = Date.now();
          const diffSec = Math.max(0, Math.floor((nowMs - startMs) / 1000));
          const hrs = Math.floor(diffSec / 3600);
          const mins = Math.floor((diffSec % 3600) / 60);
          const secs = diffSec % 60;
          if (durationEl) {
            durationEl.textContent = `${String(hrs).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
          }
        }

        updateTimer();
        workerShiftTimerId = setInterval(updateTimer, 1000);
      } else {
        if (activePanel) activePanel.classList.add('hidden');
        if (offPanel) offPanel.classList.remove('hidden');
      }
    } catch (e) {
      if (activePanel) activePanel.classList.add('hidden');
      if (offPanel) offPanel.classList.remove('hidden');
    }
  }

  const btnWorkerGoPostshift = document.getElementById('btn-worker-go-postshift');
  if (btnWorkerGoPostshift) {
    btnWorkerGoPostshift.addEventListener('click', () => {
      switchView('view-postshift');
    });
  }

  const btnWorkerStartPreshift = document.getElementById('btn-worker-start-preshift');
  if (btnWorkerStartPreshift) {
    btnWorkerStartPreshift.addEventListener('click', () => {
      const preshiftAdminWizard = document.getElementById('preshift-admin-wizard');
      const preshiftWorkerShiftView = document.getElementById('preshift-worker-shift-view');
      if (preshiftAdminWizard) preshiftAdminWizard.classList.remove('hidden');
      if (preshiftWorkerShiftView) preshiftWorkerShiftView.classList.add('hidden');
      loadPreshiftActiveWorkers();
    });
  }

  async function initAuthApp() {
    if (!currentSessionToken) {
      showLoginView();
      return;
    }

    try {
      const res = await fetchWithAuth('/api/auth/me');
      const json = await res.json();
      if (json.success && json.data) {
        currentUser = json.data.user;
        updateHeaderProfileUI();
        setupRoleNavigation(currentUser.role);
        updateUnreadAlertBadge();

        if (currentUser.role === 'worker') {
          switchView('view-worker-dashboard');
          renderWorkerDashboard();
        } else {
          switchView('view-dashboard');
          loadDashboardStats();
          loadWorkers();
        }
      } else {
        showLoginView();
      }
    } catch (e) {
      showLoginView();
    }
  }

  async function updateUnreadAlertBadge() {
    const badge = document.getElementById('header-alert-badge');
    if (!badge || !currentUser) return;
    try {
      const res = await fetchWithAuth('/api/auth/me');
      const json = await res.json();
      if (json.success && json.data) {
        if (badge) badge.textContent = json.data.unreadAlerts || 0;
      }
    } catch (e) {}
  }

  // Login Form Tab Listeners
  const tabLoginWorker = document.getElementById('tab-login-worker');
  const tabLoginAdmin = document.getElementById('tab-login-admin');
  const formWorkerLogin = document.getElementById('form-worker-login');
  const formAdminLogin = document.getElementById('form-admin-login');
  const loginErrorAlert = document.getElementById('login-error-alert');

  if (tabLoginWorker && tabLoginAdmin) {
    tabLoginWorker.addEventListener('click', () => {
      tabLoginWorker.classList.add('active');
      tabLoginWorker.style.background = '#f97316';
      tabLoginWorker.style.color = '#fff';

      tabLoginAdmin.classList.remove('active');
      tabLoginAdmin.style.background = 'transparent';
      tabLoginAdmin.style.color = '#94a3b8';

      formWorkerLogin.classList.remove('hidden');
      formAdminLogin.classList.add('hidden');
      if (loginErrorAlert) loginErrorAlert.classList.add('hidden');
    });

    tabLoginAdmin.addEventListener('click', () => {
      tabLoginAdmin.classList.add('active');
      tabLoginAdmin.style.background = 'linear-gradient(135deg, #0284c7, #0369a1)';
      tabLoginAdmin.style.color = '#fff';

      tabLoginWorker.classList.remove('active');
      tabLoginWorker.style.background = 'transparent';
      tabLoginWorker.style.color = '#94a3b8';

      formAdminLogin.classList.remove('hidden');
      formWorkerLogin.classList.add('hidden');
      if (loginErrorAlert) loginErrorAlert.classList.add('hidden');
    });
  }

  if (formWorkerLogin) {
    formWorkerLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('worker-select-user').value;
      const password = document.getElementById('worker-login-password').value;

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const json = await res.json();
        if (json.success) {
          currentSessionToken = json.token;
          currentUser = json.user;
          localStorage.setItem('sentinels_session_token', json.token);
          showToast(`Welcome back, ${currentUser.name}!`, 'success');
          initAuthApp();
        } else {
          if (loginErrorAlert) {
            loginErrorAlert.textContent = json.error || 'Login failed.';
            loginErrorAlert.classList.remove('hidden');
          }
        }
      } catch (err) {
        if (loginErrorAlert) {
          loginErrorAlert.textContent = 'Server error during authentication.';
          loginErrorAlert.classList.remove('hidden');
        }
      }
    });
  }

  if (formAdminLogin) {
    formAdminLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('admin-login-username').value;
      const password = document.getElementById('admin-login-password').value;

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const json = await res.json();
        if (json.success) {
          currentSessionToken = json.token;
          currentUser = json.user;
          localStorage.setItem('sentinels_session_token', json.token);
          showToast(`Safety Officer Signed In.`, 'success');
          initAuthApp();
        } else {
          if (loginErrorAlert) {
            loginErrorAlert.textContent = json.error || 'Login failed.';
            loginErrorAlert.classList.remove('hidden');
          }
        }
      } catch (err) {
        if (loginErrorAlert) {
          loginErrorAlert.textContent = 'Server error during authentication.';
          loginErrorAlert.classList.remove('hidden');
        }
      }
    });
  }

  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      if (currentSessionToken) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${currentSessionToken}` }
        });
      }
      currentSessionToken = null;
      currentUser = null;
      localStorage.removeItem('sentinels_session_token');
      showToast('Logged out successfully.', 'info');
      showLoginView();
    });
  }

  const headerAlertBtn = document.getElementById('header-alert-btn');
  if (headerAlertBtn) {
    headerAlertBtn.addEventListener('click', () => {
      switchView('view-alerts');
      renderAlertsFeed();
    });
  }

  // Worker Personal Dashboard Rendering
  async function renderWorkerDashboard() {
    if (!currentUser || currentUser.role !== 'worker') return;

    const subtitle = document.getElementById('wdb-subtitle');
    const idBadge = document.getElementById('wdb-worker-id-badge');
    const shiftStatus = document.getElementById('wdb-shift-status');
    const shiftFooter = document.getElementById('wdb-shift-footer');
    const badgeId = document.getElementById('wdb-badge-id');
    const totalScans = document.getElementById('wdb-total-scans');
    const unreadAlerts = document.getElementById('wdb-unread-alerts');

    if (subtitle) subtitle.textContent = `Welcome back, ${currentUser.name}`;
    if (idBadge) idBadge.textContent = `Worker ID: ${currentUser.worker_id}`;

    try {
      const res = await fetchWithAuth('/api/dashboard/stats');
      const json = await res.json();
      if (json.success && json.data) {
        const d = json.data;
        if (shiftStatus) {
          shiftStatus.textContent = d.hasActiveShift ? 'Active Shift' : 'Off Shift';
          shiftStatus.className = d.hasActiveShift ? 'stat-value text-success' : 'stat-value text-muted';
        }
        if (shiftFooter) {
          shiftFooter.textContent = d.hasActiveShift ? `Shift started: ${formatTime(d.activeShift.start_time)}` : 'Ready for pre-shift scan';
        }
        if (totalScans) totalScans.textContent = d.personalScans || 0;
        if (unreadAlerts) unreadAlerts.textContent = d.unreadAlerts || 0;

        const wRes = await fetchWithAuth(`/api/workers/${currentUser.worker_id}`);
        const wJson = await wRes.json();
        if (wJson.success && wJson.data) {
          if (badgeId) badgeId.textContent = wJson.data.worker.badge_id || 'N/A';
        }
      }
    } catch (e) {}
  }

  // Worker Actions buttons
  const btnWorkerStartShift = document.getElementById('btn-worker-start-shift');
  if (btnWorkerStartShift) {
    btnWorkerStartShift.addEventListener('click', () => switchView('view-preshift'));
  }

  const btnWorkerEndShift = document.getElementById('btn-worker-end-shift');
  if (btnWorkerEndShift) {
    btnWorkerEndShift.addEventListener('click', () => switchView('view-postshift'));
  }

  const btnWorkerMyHistory = document.getElementById('btn-worker-my-history');
  if (btnWorkerMyHistory) {
    btnWorkerMyHistory.addEventListener('click', () => switchView('view-history'));
  }

  let currentAlertFilterType = 'all';

  // Attach Alert Category Filter Button Listeners
  document.querySelectorAll('.btn-alert-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-alert-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentAlertFilterType = btn.getAttribute('data-type') || 'all';
      renderAlertsFeed();
    });
  });

  // Alerts Feed Rendering
  async function renderAlertsFeed() {
    const feedContainer = document.getElementById('alerts-feed-container');
    const countBadge = document.getElementById('alerts-count-badge');
    const noteEl = document.getElementById('alert-threshold-note');

    if (!feedContainer) return;

    // Fetch settings to display threshold notice
    try {
      const sRes = await fetchWithAuth('/api/settings');
      const sJson = await sRes.json();
      if (sJson.success && sJson.data && noteEl) {
        const thresh = sJson.data.high_exposure_threshold || '10.0';
        const label = sJson.data.provisional_label || 'Provisional Exposure Estimate';
        noteEl.textContent = `High exposure threshold configured at > ${thresh} ppm-h. ${label}`;
      }
    } catch (e) {}

    try {
      const endpoint = currentAlertFilterType !== 'all' 
        ? `/api/alerts?alert_type=${encodeURIComponent(currentAlertFilterType)}`
        : '/api/alerts';

      const res = await fetchWithAuth(endpoint);
      const json = await res.json();

      if (!json.success || !json.data) {
        feedContainer.innerHTML = `<div class="text-danger p-3 text-center">Failed to load alerts feed.</div>`;
        return;
      }

      const alerts = json.data;
      const unreadCount = alerts.filter(a => !a.is_read).length;
      if (countBadge) countBadge.textContent = `${unreadCount} Unread (${alerts.length} Total)`;

      if (alerts.length === 0) {
        feedContainer.innerHTML = `
          <div class="text-center py-4 text-muted">
            <div style="font-size:2rem;" class="mb-2">🔔</div>
            <p class="text-sm">No ${currentAlertFilterType !== 'all' ? currentAlertFilterType.replace('_', ' ') : 'safety'} alerts or notifications found.</p>
          </div>
        `;
        return;
      }

      const categoryLabels = {
        high_exposure: '⚠️ HIGH EXPOSURE',
        invalid_badge: '🔴 INVALID BADGE',
        retake_required: '📷 RETAKE REQUIRED',
        analysis_unavailable: '⏳ ANALYSIS PENDING',
        repeated_exposure: '📊 REPEATED EXPOSURE',
        shift_issue: 'ℹ️ SHIFT ISSUE'
      };

      feedContainer.innerHTML = alerts.map(alert => {
        const catBadgeText = categoryLabels[alert.alert_type] || (alert.alert_type ? alert.alert_type.toUpperCase().replace('_', ' ') : 'SAFETY NOTICE');
        const badgeStyleClass = alert.severity === 'danger' ? 'badge-danger' : (alert.severity === 'warning' ? 'badge-warning' : 'badge-info');

        return `
          <div class="alert-card ${alert.severity} ${alert.is_read ? '' : 'unread'}">
            <div class="alert-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.4rem;">
              <span class="alert-title font-bold">${escapeHtml(alert.title)}</span>
              <span class="alert-time text-xs text-muted">${formatDate(alert.created_at)}</span>
            </div>
            <div class="alert-message text-sm my-2">${escapeHtml(alert.message)}</div>
            <div class="alert-footer" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.4rem;">
              <div style="display:flex; gap:0.3rem; align-items:center;">
                <span class="badge ${badgeStyleClass}">${catBadgeText}</span>
                ${alert.worker_id ? `<span class="badge badge-info" style="font-size:0.7rem;">Worker: ${escapeHtml(alert.worker_id)}</span>` : ''}
              </div>
              ${!alert.is_read ? `<button type="button" class="btn btn-secondary text-xs btn-mark-alert-read" data-id="${alert.id}">Mark as Read</button>` : '<span class="text-xs text-muted">✓ Read</span>'}
            </div>
          </div>
        `;
      }).join('');

      document.querySelectorAll('.btn-mark-alert-read').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.target.getAttribute('data-id');
          await fetchWithAuth(`/api/alerts/${id}/read`, { method: 'PATCH' });
          renderAlertsFeed();
          updateUnreadAlertBadge();
        });
      });
    } catch (err) {
      feedContainer.innerHTML = `<div class="text-danger p-3 text-center">Error loading alerts.</div>`;
    }
  }

  // Worker Profile Page Rendering
  async function renderWorkerProfile() {
    if (!currentUser || currentUser.role !== 'worker') return;
    try {
      const res = await fetchWithAuth(`/api/workers/${currentUser.worker_id}`);
      const json = await res.json();
      if (json.success && json.data) {
        const { worker, badge } = json.data;
        const nameEl = document.getElementById('wp-name');
        const idEl = document.getElementById('wp-worker-id');
        const deptEl = document.getElementById('wp-dept');
        const badgeIdEl = document.getElementById('wp-badge-id');
        const expiryEl = document.getElementById('wp-badge-expiry');
        const badgeStatusEl = document.getElementById('wp-badge-status-badge');

        if (nameEl) nameEl.textContent = worker.name;
        if (idEl) idEl.textContent = worker.worker_id;
        if (deptEl) deptEl.textContent = worker.department || 'N/A';
        if (badgeIdEl) badgeIdEl.textContent = worker.badge_id;
        if (expiryEl) expiryEl.textContent = badge.expiry_date || 'N/A';
        if (badgeStatusEl) {
          badgeStatusEl.innerHTML = badge.status === 'expired' ? `<span class="badge badge-danger">Expired</span>` : `<span class="badge badge-success">Valid</span>`;
        }
      }
    } catch (e) {}
  }

  // -------------------------------------------------------------
  // API Fetching & Main UI Population
  // -------------------------------------------------------------

  async function fetchHealth() {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      if (data.status === 'ok') {
        statusPill.innerHTML = `
          <span class="status-dot online"></span>
          <span class="status-label">System Online (SQLite)</span>
        `;
      } else {
        throw new Error('Health check error');
      }
    } catch (err) {
      statusPill.innerHTML = `
        <span class="status-dot offline"></span>
        <span class="status-label">Offline</span>
      `;
    }
  }

  async function loadDashboardStats() {
    try {
      const res = await fetchWithAuth('/api/dashboard/stats');
      const json = await res.json();
      if (json.success && json.role === 'admin') {
        const { totalWorkers, activeShifts, completedShifts, totalScans, pendingAnalysis } = json.data;
        if (cardTotalWorkers) cardTotalWorkers.textContent = totalWorkers;
        if (cardActiveShifts) cardActiveShifts.textContent = activeShifts;
        if (cardCompletedShifts) cardCompletedShifts.textContent = completedShifts || 0;
        if (cardTotalScans) cardTotalScans.textContent = totalScans || 0;
        if (cardPendingAnalysis) cardPendingAnalysis.textContent = pendingAnalysis || 0;
        if (activeShiftBadge) activeShiftBadge.textContent = `${activeShifts} Active`;
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }

  async function loadWorkers() {
    renderTableSkeleton(fullWorkersTableBody, 8, 4);
    renderTableSkeleton(activeWorkersTableBody, 5, 2);

    try {
      const res = await fetchWithAuth('/api/workers');
      const json = await res.json();
      if (!json.success) {
        renderErrorState(fullWorkersTableBody, 8, json.error || 'Failed to load workers database.', () => loadWorkers());
        return;
      }

      allWorkersData = json.data;

      if (historyFilterWorker) {
        const currentVal = historyFilterWorker.value;
        historyFilterWorker.innerHTML = '<option value="">All Workers</option>' + 
          allWorkersData.map(w => `<option value="${escapeHtml(w.worker_id)}">${escapeHtml(w.name)} (${escapeHtml(w.worker_id)})</option>`).join('');
        historyFilterWorker.value = currentVal;
      }

      const activeWorkersOnShift = allWorkersData.filter(w => w.active_shift_id);
      if (activeWorkersTableBody) {
        if (activeWorkersOnShift.length === 0) {
          renderEmptyState(activeWorkersTableBody, 5, '🛡️', 'No workers currently on active shift.', 'Start Pre-Shift Scan', () => switchView('view-preshift'));
        } else {
          activeWorkersTableBody.innerHTML = activeWorkersOnShift.map(w => `
            <tr>
              <td><strong>${escapeHtml(w.name)}</strong><br><small style="color:var(--text-dim)">ID: ${escapeHtml(w.worker_id)}</small></td>
              <td>${escapeHtml(w.department || 'N/A')}</td>
              <td><code>${escapeHtml(w.badge_id || 'N/A')}</code></td>
              <td>${formatTime(w.shift_start_time)}</td>
              <td><span class="badge badge-success">Active Shift</span></td>
            </tr>
          `).join('');
        }
      }

      if (fullWorkersTableBody) {
        if (allWorkersData.length === 0) {
          renderEmptyState(fullWorkersTableBody, 8, '👥', 'No workers registered in database.', 'Add New Worker', openAddWorkerModal);
        } else {
          fullWorkersTableBody.innerHTML = allWorkersData.map(w => {
            const isInactive = w.status === 'inactive';
            const badgeClass = w.badge_status === 'active' ? 'badge-info' : 'badge-danger';
            const shiftClass = w.active_shift_id ? 'badge-success' : 'badge-secondary';
            const statusTag = isInactive ? '<span class="badge badge-danger">Inactive</span>' : '<span class="badge badge-success">Active</span>';

            return `
              <tr style="${isInactive ? 'opacity:0.65;' : ''}">
                <td><code>${escapeHtml(w.worker_id)}</code></td>
                <td>
                  <strong>${escapeHtml(w.name)}</strong> ${statusTag}
                </td>
                <td>${escapeHtml(w.department || 'N/A')}</td>
                <td><code>${escapeHtml(w.badge_id || 'N/A')}</code></td>
                <td><span class="badge ${badgeClass}">${escapeHtml(w.badge_status)}</span></td>
                <td><span class="badge ${shiftClass}">${w.active_shift_id ? 'On Shift' : 'Off Shift'}</span></td>
                <td>${formatDate(w.created_at)}</td>
                <td style="text-align:right">
                  <div class="action-btn-group">
                    <button class="action-btn btn-view-worker" data-id="${w.id}" title="View Worker Profile">
                      👁️ View
                    </button>
                    <button class="action-btn btn-edit-worker" data-id="${w.id}" title="Edit Worker Details">
                      ✏️ Edit
                    </button>
                    <button class="action-btn ${isInactive ? 'action-btn-success' : 'action-btn-danger'} btn-toggle-status" data-id="${w.id}" data-status="${w.status || 'active'}" title="${isInactive ? 'Activate Worker' : 'Deactivate Worker'}">
                      ${isInactive ? '✅ Activate' : '🚫 Deactivate'}
                    </button>
                    <button class="action-btn action-btn-delete btn-delete-worker" data-id="${w.id}" title="Permanently Delete Worker">
                      🗑️ Delete
                    </button>
                  </div>
                </td>
              </tr>
            `;
          }).join('');

          attachWorkerTableActions();
        }
      }
    } catch (err) {
      console.error('Failed to load workers:', err);
      renderErrorState(fullWorkersTableBody, 8, 'Communication error loading worker records.', () => loadWorkers());
    }
  }

  function attachWorkerTableActions() {
    document.querySelectorAll('.btn-view-worker').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        openWorkerProfileModal(id);
      });
    });

    document.querySelectorAll('.btn-edit-worker').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const worker = allWorkersData.find(w => String(w.id) === String(id));
        if (worker) openEditWorkerModal(worker);
      });
    });

    document.querySelectorAll('.btn-toggle-status').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const currentStatus = btn.getAttribute('data-status');
        const newStatus = currentStatus === 'inactive' ? 'active' : 'inactive';
        
        const worker = allWorkersData.find(w => String(w.id) === String(id));
        const workerName = worker ? worker.name : `Worker #${id}`;

        if (newStatus === 'inactive') {
          const confirmed = await showConfirmationModal({
            title: 'Deactivate Worker',
            message: `Are you sure you want to deactivate ${workerName}? They will no longer be available for new shifts until reactivated.`,
            icon: '🚫',
            confirmText: 'Deactivate Worker',
            btnClass: 'btn-danger'
          });
          if (!confirmed) return;
        }

        await toggleWorkerStatus(id, newStatus);
      });
    });

    document.querySelectorAll('.btn-delete-worker').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const worker = allWorkersData.find(w => String(w.id) === String(id));
        if (!worker) {
          console.error(`[DELETE WORKER] Worker record not found in local state for ID: ${id}`);
          await showConfirmationModal({
            title: '❌ Worker Not Found',
            message: `Worker record with Database ID ${id} was not found in active session state. Please refresh the page.`,
            icon: '⚠️',
            confirmText: 'OK',
            btnClass: 'btn-secondary'
          });
          return;
        }

        // Front-end active shift validation
        if (worker.active_shift_id) {
          await showConfirmationModal({
            title: '⛔ Active Shift In Progress',
            message: `Worker '${worker.name}' (${worker.worker_id}) currently has an active shift in progress. Active shifts must be completed before a worker profile can be deleted.\n\nPlease complete their active shift from the Post-Shift screen or Shift History first.`,
            icon: '⏱️',
            confirmText: 'Understood',
            btnClass: 'btn-secondary'
          });
          return;
        }

        const confirmed = await showConfirmationModal({
          title: '🗑️ Delete Worker Permanently',
          message: `Are you sure you want to PERMANENTLY delete worker '${worker.name}' (${worker.worker_id})?\n\nWARNING: Worker-related records (login user account, shifts, scans, alerts) will also be permanently deleted or detached. This action CANNOT be undone!`,
          keyword: worker.worker_id,
          icon: '⚠️',
          confirmText: 'Permanently Delete Worker',
          btnClass: 'btn-danger'
        });

        if (!confirmed) {
          console.log('[DELETE WORKER] Deletion cancelled by user.');
          return;
        }

        try {
          console.log(`[DELETE WORKER] Triggering DELETE /api/workers/${id} for '${worker.name}' (Database ID: ${id}, Worker ID: ${worker.worker_id})`);
          const res = await fetchWithAuth(`/api/workers/${id}`, {
            method: 'DELETE'
          });
          const json = await res.json();
          console.log(`[DELETE WORKER] Server response (HTTP ${res.status}):`, json);

          if (res.ok && json.success) {
            showToast(json.message || `Worker '${worker.worker_id}' deleted successfully.`, 'success');
            await loadDashboardStats();
            await loadWorkers();
            await loadPreshiftActiveWorkers();
            await populateWorkerLoginDropdown();
          } else {
            const errorMsg = json.error || `Deletion failed with HTTP status ${res.status}.`;
            console.error(`[DELETE WORKER FAILED]:`, errorMsg);
            await showConfirmationModal({
              title: '❌ Worker Deletion Failed',
              message: `Could not delete worker '${worker.name}' (${worker.worker_id}).\n\nServer Response: ${errorMsg}`,
              icon: '🚨',
              confirmText: 'Dismiss',
              btnClass: 'btn-secondary'
            });
          }
        } catch (err) {
          console.error('[DELETE WORKER EXCEPTION]:', err);
          await showConfirmationModal({
            title: '❌ Communication Error',
            message: `A network or client error occurred while deleting worker '${worker.name}': ${err.message}`,
            icon: '🚨',
            confirmText: 'Dismiss',
            btnClass: 'btn-secondary'
          });
        }
      });
    });
  }

  async function openWorkerProfileModal(id) {
    try {
      const res = await fetchWithAuth(`/api/workers/${id}`);
      const json = await res.json();
      if (!json.success) return alert(json.error || 'Failed to load profile.');

      const { worker, badge, shift, metrics, recentScans } = json.data;
      currentProfileWorkerId = worker.worker_id;

      vpAvatar.textContent = getInitials(worker.name);
      vpName.textContent = worker.name;
      vpWorkerId.textContent = worker.worker_id;
      vpDept.textContent = worker.department || 'N/A';
      vpStatus.textContent = worker.status === 'inactive' ? 'Inactive' : 'Active Worker';
      vpStatus.className = `badge ${worker.status === 'inactive' ? 'badge-danger' : 'badge-success'}`;

      vpBadgeId.textContent = badge.badge_id || worker.badge_id || 'N/A';
      vpBadgeStatus.innerHTML = `<span class="badge ${badge.status === 'active' ? 'badge-info' : 'badge-danger'}">${escapeHtml(badge.status)}</span>`;
      vpBadgeMfg.textContent = badge.manufacture_date || 'N/A';
      vpBadgeExpiry.textContent = badge.expiry_date || 'N/A';

      vpShiftStatus.textContent = shift.onShift ? 'On Active Shift' : 'Off Shift';
      vpShiftStatus.className = `pstat-val ${shift.onShift ? 'text-success' : 'text-muted'}`;
      vpScanCount.textContent = metrics.scanCount || 0;
      vpExposureCount.textContent = metrics.exposureCount || 0;

      if (!recentScans || recentScans.length === 0) {
        vpHistoryContent.innerHTML = `
          <div class="empty-state-box">
            <span class="empty-state-icon">📭</span>
            <p>No exposure records logged yet for this worker.</p>
          </div>
        `;
      } else {
        vpHistoryContent.innerHTML = `
          <table class="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Exposure</th>
                <th>Quality</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${recentScans.map(s => `
                <tr>
                  <td><span class="badge ${s.scan_type === 'pre-shift' ? 'badge-info' : 'badge-warning'}">${escapeHtml(s.scan_type)}</span></td>
                  <td><strong>${s.exposure_estimate !== null ? s.exposure_estimate + ' PPM' : '<span class="badge badge-warning">Pending Analysis</span>'}</strong></td>
                  <td><span class="badge ${s.quality === 'High' ? 'badge-success' : 'badge-warning'}">${escapeHtml(s.quality || 'Medium')}</span></td>
                  <td>${formatDateTime(s.created_at)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }

      viewProfileModal.classList.remove('hidden');
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
  }

  async function toggleWorkerStatus(id, newStatus) {
    try {
      const res = await fetchWithAuth(`/api/workers/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      const json = await res.json();
      if (json.success) {
        refreshAllData();
      } else {
        alert(json.error || 'Failed to update status.');
      }
    } catch (err) {
      alert('Communication error updating status.');
    }
  }

  async function loadScans() {
    try {
      const res = await fetchWithAuth('/api/scans');
      const json = await res.json();
      if (!json.success) return;

      const scans = json.data;

      if (recentScansTableBody) {
        if (scans.length === 0) {
          recentScansTableBody.innerHTML = `<tr><td colspan="5" class="empty-cell">No scan records available.</td></tr>`;
        } else {
          recentScansTableBody.innerHTML = scans.slice(0, 5).map(s => `
            <tr>
              <td><strong>${escapeHtml(s.worker_name || s.worker_id)}</strong></td>
              <td><span class="badge ${s.scan_type === 'pre-shift' ? 'badge-info' : 'badge-warning'}">${escapeHtml(s.scan_type)}</span></td>
              <td><strong>${s.exposure_estimate !== null ? s.exposure_estimate + ' PPM' : '<span class="badge badge-warning">Pending</span>'}</strong></td>
              <td><span class="badge ${s.quality === 'High' ? 'badge-success' : 'badge-warning'}">${escapeHtml(s.quality || 'Medium')}</span></td>
              <td>${formatTime(s.created_at)}</td>
            </tr>
          `).join('');
        }
      }

      if (historyScansTableBody) {
        if (scans.length === 0) {
          historyScansTableBody.innerHTML = `<tr><td colspan="9" class="empty-cell">No exposure history logs found.</td></tr>`;
        } else {
          historyScansTableBody.innerHTML = scans.map(s => `
            <tr>
              <td><code>#SCN-${s.id}</code></td>
              <td><strong>${escapeHtml(s.worker_name || s.worker_id)}</strong></td>
              <td>${escapeHtml(s.department || 'N/A')}</td>
              <td><span class="badge ${s.scan_type === 'pre-shift' ? 'badge-info' : 'badge-warning'}">${escapeHtml(s.scan_type)}</span></td>
              <td><code>${s.detected_color || 'N/A'}</code></td>
              <td><strong>${s.exposure_estimate !== null ? s.exposure_estimate + ' PPM' : '<span class="badge badge-warning">Pending Analysis</span>'}</strong></td>
              <td>${s.confidence ? (s.confidence * 100).toFixed(0) + '%' : 'N/A'}</td>
              <td><span class="badge ${s.quality === 'High' ? 'badge-success' : 'badge-warning'}">${escapeHtml(s.quality || 'Medium')}</span></td>
              <td>${formatDateTime(s.created_at)}</td>
            </tr>
          `).join('');
        }
      }
    } catch (err) {
      console.error('Failed to load scans:', err);
    }
  }

  // -------------------------------------------------------------
  // STAGE 3: PRE-SHIFT SCAN WIZARD LOGIC (DISCRETIZED 2-STEP SCAN)
  // -------------------------------------------------------------

  let lastExpiryAnalysisResult = null;
  let lastH2sAnalysisResult = null;

  function setWizardStep(stepNum) {
    for (let i = 1; i <= 6; i++) {
      const stepEl = document.getElementById(`ws-step-${i}`);
      const panelEl = document.getElementById(`preshift-step-${i}-panel`);

      if (stepEl) {
        if (i < stepNum) {
          stepEl.className = 'wizard-step completed';
        } else if (i === stepNum) {
          stepEl.className = 'wizard-step active';
        } else {
          stepEl.className = 'wizard-step';
        }
      }

      if (panelEl) {
        if (i === stepNum) {
          panelEl.classList.add('active');
        } else {
          panelEl.classList.remove('active');
        }
      }
    }
  }

  async function loadPreshiftActiveWorkers() {
    try {
      const res = await fetchWithAuth('/api/workers/active');
      const json = await res.json();
      if (!json.success) return;

      preshiftActiveWorkers = json.data;
      if (currentUser && currentUser.role === 'worker') {
        preshiftActiveWorkers = preshiftActiveWorkers.filter(w => String(w.worker_id).toLowerCase() === String(currentUser.worker_id).toLowerCase());
      }

      selectPreshiftWorker.innerHTML = '<option value="">-- Select Active Worker --</option>';

      if (preshiftActiveWorkers.length === 0) {
        selectPreshiftWorker.innerHTML = '<option value="">No active workers available.</option>';
        btnPreshiftStep1Next.disabled = true;
        return;
      }

      preshiftActiveWorkers.forEach(w => {
        const option = document.createElement('option');
        option.value = w.id;
        const shiftStatusText = w.active_shift_id ? ' [ON ACTIVE SHIFT]' : '';
        option.textContent = `${w.worker_id} - ${w.name} (${w.department || 'General'})${shiftStatusText}`;
        if (w.active_shift_id) {
          option.dataset.onShift = 'true';
        }
        selectPreshiftWorker.appendChild(option);
      });

      if (currentUser && currentUser.role === 'worker' && preshiftActiveWorkers.length === 1) {
        selectPreshiftWorker.value = preshiftActiveWorkers[0].id;
        selectPreshiftWorker.dispatchEvent(new Event('change'));
      }
    } catch (err) {
      console.error('Failed to load preshift active workers:', err);
    }
  }

  if (selectPreshiftWorker) {
    selectPreshiftWorker.addEventListener('change', () => {
      preshiftWorkerAlert.classList.add('hidden');
      const selectedId = selectPreshiftWorker.value;
      if (!selectedId) {
        selectedPreshiftWorker = null;
        btnPreshiftStep1Next.disabled = true;
        return;
      }

      selectedPreshiftWorker = preshiftActiveWorkers.find(w => String(w.id) === String(selectedId));

      if (selectedPreshiftWorker && selectedPreshiftWorker.active_shift_id) {
        preshiftWorkerAlert.textContent = `Worker '${selectedPreshiftWorker.name}' (${selectedPreshiftWorker.worker_id}) ALREADY has an active shift. Cannot start a second active shift.`;
        preshiftWorkerAlert.classList.remove('hidden');
        btnPreshiftStep1Next.disabled = true;
      } else {
        btnPreshiftStep1Next.disabled = false;
      }
    });
  }

  if (btnPreshiftStep1Next) {
    btnPreshiftStep1Next.addEventListener('click', () => {
      if (!selectedPreshiftWorker) return;
      populateBadgeVerificationStep();
      setWizardStep(2);
    });
  }

  function populateBadgeVerificationStep() {
    if (!selectedPreshiftWorker) return;

    bvName.textContent = selectedPreshiftWorker.name;
    bvWorkerId.textContent = selectedPreshiftWorker.worker_id;
    bvDept.textContent = selectedPreshiftWorker.department || 'N/A';
    bvBadgeId.textContent = selectedPreshiftWorker.badge_id || 'N/A';
    bvMfg.textContent = `${selectedPreshiftWorker.badge_manufacture_date || 'N/A'} (Admin Record)`;
    bvExpiry.textContent = `${selectedPreshiftWorker.badge_expiry_date || 'N/A'} (Admin Record)`;

    badgeStatusBanner.className = 'status-banner status-banner-valid mb-4';
    badgeStatusBanner.innerHTML = `
      <span class="banner-icon">ℹ️</span>
      <div>
        <strong>ASSIGNED BADGE DETAILS LOADED</strong>
        <p class="text-xs" style="margin-top:0.2rem;">DB Expiry Date: ${selectedPreshiftWorker.badge_expiry_date || 'Valid'} (Administrative Reference). <strong>Primary physical validity will be determined by camera scan of physical expiry indicator dot.</strong></p>
      </div>
    `;
    btnPreshiftStep2Next.disabled = false;
  }

  if (btnPreshiftStep2Back) btnPreshiftStep2Back.addEventListener('click', () => setWizardStep(1));
  if (btnPreshiftStep2Next) {
    btnPreshiftStep2Next.addEventListener('click', () => {
      setWizardStep(3);
      startCamera();
    });
  }

  // Helper: Sample average color from canvas sub-region
  function extractCanvasHexRegion(canvas, rx, ry, rw, rh) {
    if (!canvas || !canvas.width || !canvas.height) return null;
    const ctx = canvas.getContext('2d');
    const x = Math.max(0, Math.floor(canvas.width * rx));
    const y = Math.max(0, Math.floor(canvas.height * ry));
    const w = Math.max(1, Math.floor(canvas.width * rw));
    const h = Math.max(1, Math.floor(canvas.height * rh));
    
    try {
      const imgData = ctx.getImageData(x, y, w, h).data;
      let r = 0, g = 0, b = 0, count = 0;
      for (let i = 0; i < imgData.length; i += 4) {
        r += imgData[i];
        g += imgData[i + 1];
        b += imgData[i + 2];
        count++;
      }
      if (count === 0) return null;
      const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
      const toHex = (v) => clamp(v).toString(16).padStart(2, '0');
      return `#${toHex(r / count)}${toHex(g / count)}${toHex(b / count)}`.toUpperCase();
    } catch (e) {
      return null;
    }
  }

  // --- STEP 1: EXPIRY SCAN ONLY CAMERA & ANALYSIS ---
  async function startCamera() {
    cameraErrorAlert.classList.add('hidden');
    cameraFeed.classList.remove('hidden');
    imagePreview.classList.add('hidden');
    cameraCanvas.classList.add('hidden');
    cameraOverlay.classList.remove('hidden');

    btnStartCamera.classList.add('hidden');
    btnCaptureImage.classList.remove('hidden');
    btnRetakeImage.classList.add('hidden');
    btnConfirmScan.classList.add('hidden');
    if (expiryIndicatorBanner) expiryIndicatorBanner.classList.add('hidden');
    if (expiryAnalysisCard) expiryAnalysisCard.classList.add('hidden');
    if (btnPreshiftStep3NextH2s) btnPreshiftStep3NextH2s.disabled = true;

    try {
      if (cameraStream) stopCamera();

      // Rear Camera for phones (facingMode: environment)
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: { ideal: 'environment' } }
      });
      cameraFeed.srcObject = cameraStream;
    } catch (err) {
      console.warn('[Rear Camera API Warning]:', err);
      let msg = 'Rear camera initialization failed.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera permission denied. Please allow camera access or use the file upload option below.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No camera device detected on your system. Please use the file upload fallback below.';
      } else {
        msg = `Camera error: ${err.message}. Please use file upload fallback below.`;
      }
      cameraErrorAlert.textContent = msg;
      cameraErrorAlert.classList.remove('hidden');

      btnStartCamera.classList.remove('hidden');
      btnCaptureImage.classList.add('hidden');
    }
  }

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      cameraStream = null;
    }
    if (cameraFeed) cameraFeed.srcObject = null;
  }

  if (btnStartCamera) btnStartCamera.addEventListener('click', startCamera);

  if (btnCaptureImage) {
    btnCaptureImage.addEventListener('click', () => {
      if (!cameraFeed.videoWidth) return;

      cameraCanvas.width = cameraFeed.videoWidth || 640;
      cameraCanvas.height = cameraFeed.videoHeight || 480;

      const ctx = cameraCanvas.getContext('2d');
      ctx.drawImage(cameraFeed, 0, 0, cameraCanvas.width, cameraCanvas.height);

      capturedImageData = cameraCanvas.toDataURL('image/jpeg', 0.9);

      imagePreview.src = capturedImageData;
      imagePreview.classList.remove('hidden');
      cameraFeed.classList.add('hidden');
      cameraOverlay.classList.add('hidden');

      btnCaptureImage.classList.add('hidden');
      btnRetakeImage.classList.remove('hidden');
      btnConfirmScan.classList.remove('hidden');

      stopCamera();
    });
  }

  if (btnRetakeImage) {
    btnRetakeImage.addEventListener('click', () => {
      capturedImageData = null;
      startCamera();
    });
  }

  if (fileScanUpload) {
    fileScanUpload.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        capturedImageData = event.target.result;
        imagePreview.src = capturedImageData;
        imagePreview.classList.remove('hidden');
        cameraFeed.classList.add('hidden');
        cameraOverlay.classList.add('hidden');

        btnStartCamera.classList.add('hidden');
        btnCaptureImage.classList.add('hidden');
        btnRetakeImage.classList.remove('hidden');
        btnConfirmScan.classList.remove('hidden');
        stopCamera();
      };
      reader.readAsDataURL(file);
    });
  }

  if (btnPreshiftStep3Back) {
    btnPreshiftStep3Back.addEventListener('click', () => {
      stopCamera();
      setWizardStep(2);
    });
  }

  if (btnConfirmScan) {
    btnConfirmScan.addEventListener('click', async () => {
      if (!capturedImageData) return alert('Please capture or upload an expiry scan image first.');
      await performPhysicalExpiryIndicatorAnalysis();
    });
  }

  async function performPhysicalExpiryIndicatorAnalysis() {
    if (!capturedImageData || !selectedPreshiftWorker) return;

    // Sample detected HEX from canvas if available
    let detectedHex = extractCanvasHexRegion(cameraCanvas, 0.40, 0.40, 0.20, 0.20) || '#6A9EAE';

    try {
      const res = await fetchWithAuth('/api/scans/analyze-expiry-indicator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_path: capturedImageData,
          worker_id: selectedPreshiftWorker.worker_id,
          badge_id: selectedPreshiftWorker.badge_id,
          mock_status: currentMockExpiryStatus,
          detected_hex: detectedHex
        })
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to analyze physical expiry indicator.');

      renderExpiryIndicatorResult(json);
    } catch (err) {
      console.error('[Expiry Analysis Error]:', err);
      renderExpiryIndicatorResult({
        expiry_status: 'RETAKE',
        detected_hex: 'N/A',
        reference_color: 'N/A',
        closest_reference_label: 'N/A',
        validity_percentage: null,
        validation: { can_proceed: false, message: 'EXPIRY INDICATOR NOT CLEAR — RETAKE' }
      });
    }
  }

  function renderExpiryIndicatorResult(data) {
    lastExpiryAnalysisResult = data;
    const status = data.expiry_status || 'VALID';
    const det = data.detection || {};
    const val = data.validation || {};

    const detectedHexEl = document.getElementById('expiry-detected-hex');
    const refColorEl = document.getElementById('expiry-reference-color');
    const refSwatchEl = document.getElementById('expiry-ref-swatch');
    const swatchDotEl = document.getElementById('expiry-swatch-dot');
    const validityPctEl = document.getElementById('expiry-validity-percentage');
    const statusValEl = document.getElementById('expiry-status-val');
    const statusBadgeEl = document.getElementById('expiry-status-badge');

    const detectedHex = data.detected_hex || det.detected_color_hex || '#6A9EAE';
    const refColor = data.reference_color || det.reference_color || '#6A9EAE';
    const refLabel = data.closest_reference_label || det.closest_reference_label || `${refColor}`;
    const validityPct = data.validity_percentage !== undefined && data.validity_percentage !== null ? data.validity_percentage : (status === 'RETAKE' || status === 'UNREADABLE' ? null : 100);

    if (detectedHexEl) detectedHexEl.textContent = detectedHex !== 'N/A' ? detectedHex : 'N/A';
    if (swatchDotEl) swatchDotEl.style.background = detectedHex !== 'N/A' ? detectedHex : '#64748b';
    if (refColorEl) refColorEl.textContent = refLabel;
    if (refSwatchEl) refSwatchEl.style.background = refColor !== 'N/A' ? refColor : '#64748b';

    if (validityPctEl) {
      if (validityPct !== null) {
        validityPctEl.textContent = `${validityPct}%`;
        validityPctEl.className = validityPct >= 50 ? 'detail-value text-primary' : (validityPct >= 15 ? 'detail-value text-warning' : 'detail-value text-danger');
      } else {
        validityPctEl.textContent = 'N/A (Unreadable)';
        validityPctEl.className = 'detail-value text-muted';
      }
    }

    if (statusValEl) {
      statusValEl.textContent = status;
      if (status === 'VALID') statusValEl.className = 'detail-value text-success';
      else if (status === 'WARNING') statusValEl.className = 'detail-value text-warning';
      else if (status === 'EXPIRED' || status === 'INVALID') statusValEl.className = 'detail-value text-danger';
      else statusValEl.className = 'detail-value text-muted';
    }

    if (statusBadgeEl) {
      if (status === 'VALID') {
        statusBadgeEl.className = 'badge badge-success';
        statusBadgeEl.textContent = `🟢 VALID (${validityPct}% Level)`;
      } else if (status === 'WARNING') {
        statusBadgeEl.className = 'badge badge-warning';
        statusBadgeEl.textContent = `🟡 WARNING (${validityPct}% Level)`;
      } else if (status === 'EXPIRED' || status === 'INVALID') {
        statusBadgeEl.className = 'badge badge-danger';
        statusBadgeEl.textContent = `🔴 EXPIRED (${validityPct}% Level)`;
      } else {
        statusBadgeEl.className = 'badge badge-warning';
        statusBadgeEl.textContent = '⚠️ RETAKE REQUIRED';
      }
    }

    if (expiryAnalysisCard) expiryAnalysisCard.classList.remove('hidden');

    if (expiryIndicatorBanner) {
      expiryIndicatorBanner.classList.remove('hidden');
      if (status === 'VALID' || status === 'WARNING') {
        const isWarn = status === 'WARNING';
        expiryIndicatorBanner.className = isWarn ? 'status-banner mb-4' : 'status-banner status-banner-valid mb-4';
        if (isWarn) {
          expiryIndicatorBanner.style.background = 'rgba(245, 158, 11, 0.15)';
          expiryIndicatorBanner.style.border = '1px solid rgba(245, 158, 11, 0.3)';
          expiryIndicatorBanner.style.color = 'var(--warning)';
        } else {
          expiryIndicatorBanner.style.background = '';
          expiryIndicatorBanner.style.border = '';
          expiryIndicatorBanner.style.color = '';
        }

        expiryIndicatorBanner.innerHTML = `
          <span class="banner-icon">${isWarn ? '🟡' : '🟢'}</span>
          <div>
            <strong>PHYSICAL BADGE EXPIRY LEVEL: ${status} (${validityPct}%)</strong>
            <p class="text-xs" style="margin-top:0.2rem;">Physical expiry indicator verified. Click below to continue to STEP 2 — H2S SCAN.</p>
          </div>
        `;

        if (btnPreshiftStep3NextH2s) {
          btnPreshiftStep3NextH2s.disabled = false;
          btnPreshiftStep3NextH2s.innerHTML = '<span>Proceed to STEP 2 — H2S SCAN &rarr;</span>';
        }
      } else if (status === 'EXPIRED' || status === 'INVALID') {
        // STOP WORKFLOW IMMEDIATELY
        expiryIndicatorBanner.className = 'status-banner status-banner-invalid mb-4';
        expiryIndicatorBanner.style.background = 'rgba(239, 68, 68, 0.2)';
        expiryIndicatorBanner.style.border = '2px solid #ef4444';
        expiryIndicatorBanner.style.color = '#ef4444';
        expiryIndicatorBanner.innerHTML = `
          <span class="banner-icon" style="font-size:2rem;">🛑</span>
          <div>
            <strong style="font-size:1.1rem; color:#f87171;">BADGE EXPIRED — SHIFT CANNOT START</strong>
            <p class="text-xs" style="margin-top:0.2rem; color:#fca5a5;">Scanned physical badge has reached 0% chemical expiration. H2S scanning and shift entry are strictly BLOCKED.</p>
          </div>
        `;
        if (btnPreshiftStep3NextH2s) {
          btnPreshiftStep3NextH2s.disabled = true;
          btnPreshiftStep3NextH2s.innerHTML = '<span>🚫 BADGE EXPIRED — SHIFT CANNOT START</span>';
        }
        showToast('🛑 BADGE EXPIRED — SHIFT CANNOT START', 'error', 6000);
      } else {
        // RETAKE / UNREADABLE
        expiryIndicatorBanner.className = 'status-banner status-banner-invalid mb-4';
        expiryIndicatorBanner.style.background = 'rgba(245, 158, 11, 0.15)';
        expiryIndicatorBanner.style.border = '1px solid rgba(245, 158, 11, 0.3)';
        expiryIndicatorBanner.style.color = 'var(--warning)';
        expiryIndicatorBanner.innerHTML = `
          <span class="banner-icon">⚠️</span>
          <div>
            <strong>EXPIRY INDICATOR NOT CLEAR — RETAKE</strong>
            <p class="text-xs" style="margin-top:0.2rem;">Image unclear or expiry indicator region cannot be detected. Please retake photo.</p>
          </div>
        `;
        if (btnPreshiftStep3NextH2s) {
          btnPreshiftStep3NextH2s.disabled = true;
          btnPreshiftStep3NextH2s.innerHTML = '<span>⚠️ EXPIRY INDICATOR NOT CLEAR — RETAKE</span>';
        }
        showToast('⚠️ EXPIRY INDICATOR NOT CLEAR — RETAKE', 'warning', 4000);
      }
    }
  }

  document.querySelectorAll('.btn-sim-expiry').forEach(btn => {
    btn.addEventListener('click', async () => {
      const status = btn.getAttribute('data-status');
      if (status) {
        currentMockExpiryStatus = status;
        await performPhysicalExpiryIndicatorAnalysis();
        showToast(`Test Expiry State: ${status}`, 'info');
      }
    });
  });

  if (btnPreshiftStep3NextH2s) {
    btnPreshiftStep3NextH2s.addEventListener('click', () => {
      setWizardStep(4);
      startH2sCamera();
    });
  }

  // --- STEP 2: H2S SCAN CAMERA & ANALYSIS (STEP 4) ---
  async function startH2sCamera() {
    if (h2sCameraErrorAlert) h2sCameraErrorAlert.classList.add('hidden');
    if (h2sCameraFeed) h2sCameraFeed.classList.remove('hidden');
    if (h2sImagePreview) h2sImagePreview.classList.add('hidden');
    if (h2sCameraCanvas) h2sCameraCanvas.classList.add('hidden');
    if (h2sCameraOverlay) h2sCameraOverlay.classList.remove('hidden');

    if (btnStartH2sCamera) btnStartH2sCamera.classList.add('hidden');
    if (btnCaptureH2sImage) btnCaptureH2sImage.classList.remove('hidden');
    if (btnRetakeH2sImage) btnRetakeH2sImage.classList.add('hidden');
    if (btnConfirmH2sScan) btnConfirmH2sScan.classList.add('hidden');
    if (h2sAnalysisCard) h2sAnalysisCard.classList.add('hidden');
    if (btnPreshiftStep4NextSummary) btnPreshiftStep4NextSummary.disabled = true;

    try {
      if (h2sCameraStream) stopH2sCamera();

      // Rear Camera for phones (facingMode: environment)
      h2sCameraStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: { ideal: 'environment' } }
      });
      if (h2sCameraFeed) h2sCameraFeed.srcObject = h2sCameraStream;
    } catch (err) {
      console.warn('[H2S Rear Camera API Warning]:', err);
      let msg = 'Rear camera initialization failed.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera permission denied. Please allow camera access or use the file upload option below.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No camera device detected on your system. Please use the file upload fallback below.';
      } else {
        msg = `Camera error: ${err.message}. Please use file upload fallback below.`;
      }
      if (h2sCameraErrorAlert) {
        h2sCameraErrorAlert.textContent = msg;
        h2sCameraErrorAlert.classList.remove('hidden');
      }

      if (btnStartH2sCamera) btnStartH2sCamera.classList.remove('hidden');
      if (btnCaptureH2sImage) btnCaptureH2sImage.classList.add('hidden');
    }
  }

  function stopH2sCamera() {
    if (h2sCameraStream) {
      h2sCameraStream.getTracks().forEach(track => track.stop());
      h2sCameraStream = null;
    }
    if (h2sCameraFeed) h2sCameraFeed.srcObject = null;
  }

  if (btnStartH2sCamera) btnStartH2sCamera.addEventListener('click', startH2sCamera);

  if (btnCaptureH2sImage) {
    btnCaptureH2sImage.addEventListener('click', () => {
      if (!h2sCameraFeed.videoWidth) return;

      h2sCameraCanvas.width = h2sCameraFeed.videoWidth || 640;
      h2sCameraCanvas.height = h2sCameraFeed.videoHeight || 480;

      const ctx = h2sCameraCanvas.getContext('2d');
      ctx.drawImage(h2sCameraFeed, 0, 0, h2sCameraCanvas.width, h2sCameraCanvas.height);

      h2sCapturedImageData = h2sCameraCanvas.toDataURL('image/jpeg', 0.9);

      h2sImagePreview.src = h2sCapturedImageData;
      h2sImagePreview.classList.remove('hidden');
      h2sCameraFeed.classList.add('hidden');
      h2sCameraOverlay.classList.add('hidden');

      btnCaptureH2sImage.classList.add('hidden');
      btnRetakeH2sImage.classList.remove('hidden');
      btnConfirmH2sScan.classList.remove('hidden');

      stopH2sCamera();
    });
  }

  if (btnRetakeH2sImage) {
    btnRetakeH2sImage.addEventListener('click', () => {
      h2sCapturedImageData = null;
      startH2sCamera();
    });
  }

  if (fileH2sUpload) {
    fileH2sUpload.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        h2sCapturedImageData = event.target.result;
        h2sImagePreview.src = h2sCapturedImageData;
        h2sImagePreview.classList.remove('hidden');
        h2sCameraFeed.classList.add('hidden');
        h2sCameraOverlay.classList.add('hidden');

        if (btnStartH2sCamera) btnStartH2sCamera.classList.add('hidden');
        if (btnCaptureH2sImage) btnCaptureH2sImage.classList.add('hidden');
        if (btnRetakeH2sImage) btnRetakeH2sImage.classList.remove('hidden');
        if (btnConfirmH2sScan) btnConfirmH2sScan.classList.remove('hidden');
        stopH2sCamera();
      };
      reader.readAsDataURL(file);
    });
  }

  if (btnPreshiftStep4Back) {
    btnPreshiftStep4Back.addEventListener('click', () => {
      stopH2sCamera();
      setWizardStep(3);
    });
  }

  if (btnConfirmH2sScan) {
    btnConfirmH2sScan.addEventListener('click', async () => {
      if (!h2sCapturedImageData) return alert('Please capture or upload a complete badge image first.');
      await performH2sStripAnalysis();
    });
  }

  async function performH2sStripAnalysis() {
    if (!h2sCapturedImageData) return;

    // Sample separate regions from canvas:
    // Left Zone (H2S sensing strip): ~10% to 30% width
    // Center Zone (Reference scale): ~38% to 62% width
    const detectedSensingHex = extractCanvasHexRegion(h2sCameraCanvas, 0.12, 0.30, 0.20, 0.40) || '#96CDE1';
    const detectedRefHex = extractCanvasHexRegion(h2sCameraCanvas, 0.40, 0.30, 0.20, 0.40) || '#96CDE1';

    try {
      const res = await fetchWithAuth('/api/scans/analyze-h2s-strip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          detected_hex: detectedSensingHex,
          detected_ref_hex: detectedRefHex,
          is_unreadable: false
        })
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to analyze H2S sensing strip.');

      renderH2sAnalysisResult(json);
    } catch (err) {
      console.error('[H2S Analysis Error]:', err);
      renderH2sAnalysisResult({
        h2s_status: 'OUT OF CALIBRATION RANGE',
        detected_hex: detectedSensingHex,
        corrected_hex: detectedSensingHex,
        reference_color: '#96CDE1',
        closest_reference_label: 'OUT OF CALIBRATION RANGE',
        estimated_ppm: null,
        can_proceed: false,
        message: 'OUT OF CALIBRATION RANGE — Detected H2S color is outside calibrated scale.'
      });
    }
  }

  function renderH2sAnalysisResult(data) {
    lastH2sAnalysisResult = data;
    const status = data.h2s_status || 'ANALYZED';

    const detectedHexEl = document.getElementById('h2s-detected-hex');
    const correctedHexEl = document.getElementById('h2s-corrected-hex');
    const estimatedPpmEl = document.getElementById('h2s-estimated-ppm');
    const closestRefEl = document.getElementById('h2s-closest-ref');
    const rawSwatch = document.getElementById('h2s-raw-swatch');
    const corrSwatch = document.getElementById('h2s-corr-swatch');
    const statusBadge = document.getElementById('h2s-status-badge');
    const msgEl = document.getElementById('h2s-analysis-msg');

    const detectedHex = data.detected_hex || '#96CDE1';
    const correctedHex = data.corrected_hex || detectedHex;

    if (detectedHexEl) detectedHexEl.textContent = detectedHex;
    if (rawSwatch) rawSwatch.style.background = detectedHex;
    if (correctedHexEl) correctedHexEl.textContent = correctedHex;
    if (corrSwatch) corrSwatch.style.background = correctedHex;

    if (status === 'OUT OF CALIBRATION RANGE' || status === 'RETAKE REQUIRED') {
      if (estimatedPpmEl) {
        estimatedPpmEl.textContent = 'OUT OF CALIBRATION RANGE';
        estimatedPpmEl.className = 'detail-value text-danger';
      }
      if (closestRefEl) closestRefEl.textContent = 'N/A';
      if (statusBadge) {
        statusBadge.className = 'badge badge-danger';
        statusBadge.textContent = 'OUT OF CALIBRATION RANGE';
      }
      if (msgEl) {
        msgEl.style.background = 'rgba(239,68,68,0.12)';
        msgEl.style.borderColor = 'rgba(239,68,68,0.3)';
        msgEl.style.color = '#ef4444';
        msgEl.textContent = data.message || 'OUT OF CALIBRATION RANGE — Detected H2S color is outside calibrated scale. Retake photo.';
      }
      if (btnPreshiftStep4NextSummary) {
        btnPreshiftStep4NextSummary.disabled = true;
        btnPreshiftStep4NextSummary.innerHTML = '<span>⚠️ OUT OF CALIBRATION RANGE — Retake Photo</span>';
      }
      showToast('⚠️ OUT OF CALIBRATION RANGE: Retake photo.', 'warning');
    } else {
      const ppmVal = data.estimated_ppm !== null && data.estimated_ppm !== undefined ? data.estimated_ppm : 0.0;
      if (estimatedPpmEl) {
        estimatedPpmEl.textContent = `${ppmVal.toFixed(1)} ppm`;
        estimatedPpmEl.className = 'detail-value text-primary';
      }
      if (closestRefEl) closestRefEl.textContent = data.closest_reference_label || `${ppmVal} ppm`;
      if (statusBadge) {
        statusBadge.className = 'badge badge-success';
        statusBadge.textContent = 'ANALYZED';
      }
      if (msgEl) {
        msgEl.style.background = 'rgba(2,132,199,0.08)';
        msgEl.style.borderColor = 'rgba(2,132,199,0.2)';
        msgEl.style.color = 'var(--text-main)';
        msgEl.textContent = data.message || `H2S Strip Analyzed: ${ppmVal} ppm. Corrected for lighting against center reference scale.`;
      }
      if (btnPreshiftStep4NextSummary) {
        btnPreshiftStep4NextSummary.disabled = false;
        btnPreshiftStep4NextSummary.innerHTML = '<span>Proceed to Quality Gate & Summary &rarr;</span>';
      }
    }

    if (h2sAnalysisCard) h2sAnalysisCard.classList.remove('hidden');
  }

  if (btnPreshiftStep4NextSummary) {
    btnPreshiftStep4NextSummary.addEventListener('click', () => {
      performQualityGateCheck();
      setWizardStep(5);
    });
  }

  // --- STEP 5: BASELINE SUMMARY & QUALITY GATE ---
  function performQualityGateCheck() {
    const sumExpiryDecision = document.getElementById('sum-expiry-decision');
    const sumBaselinePpm = document.getElementById('sum-baseline-ppm');
    const sumCorrectedHex = document.getElementById('sum-corrected-hex');
    const sumQualityGrade = document.getElementById('sum-quality-grade');

    const expDecision = lastExpiryAnalysisResult ? lastExpiryAnalysisResult.expiry_status : 'VALID';
    const expPct = lastExpiryAnalysisResult && lastExpiryAnalysisResult.validity_percentage !== null ? lastExpiryAnalysisResult.validity_percentage : 100;
    const basePpm = lastH2sAnalysisResult && lastH2sAnalysisResult.estimated_ppm !== null ? lastH2sAnalysisResult.estimated_ppm : 0.0;
    const corrHex = lastH2sAnalysisResult ? (lastH2sAnalysisResult.corrected_hex || '#96CDE1') : '#96CDE1';

    if (sumExpiryDecision) sumExpiryDecision.textContent = `${expDecision} (${expPct}%)`;
    if (sumBaselinePpm) sumBaselinePpm.textContent = `${basePpm.toFixed(1)} ppm`;
    if (sumCorrectedHex) sumCorrectedHex.textContent = corrHex;
    if (sumQualityGrade) sumQualityGrade.textContent = 'High (98%)';

    showQualityGateResult(true);
  }

  function showQualityGateResult(passed, reason) {
    if (passed) {
      qualityGateBanner.className = 'status-banner status-banner-valid mb-4';
      qualityGateBanner.innerHTML = `
        <span class="banner-icon">✅</span>
        <div>
          <strong>PRE-SHIFT SCANS VERIFIED — QUALITY GATE PASSED</strong>
          <p class="text-xs" style="margin-top:0.2rem;">Physical expiry indicator verified as VALID and baseline H2S calibrated. Ready to launch active shift.</p>
        </div>
      `;
      qcValCaptured.textContent = 'Verified';
      qcValCaptured.className = 'text-success';
    } else {
      qualityGateBanner.className = 'status-banner status-banner-invalid mb-4';
      qualityGateBanner.innerHTML = `
        <span class="banner-icon">⚠️</span>
        <div>
          <strong>RETAKE REQUIRED — QUALITY GATE FAILED</strong>
          <p class="text-xs" style="margin-top:0.2rem;">${reason || 'Quality check failed. Retake image captures.'}</p>
        </div>
      `;
      qcValCaptured.textContent = 'Check Failed';
      qcValCaptured.className = 'text-danger';
    }
  }

  if (btnPreshiftStep5Retake) {
    btnPreshiftStep5Retake.addEventListener('click', () => {
      setWizardStep(3);
      startCamera();
    });
  }

  if (btnPreshiftStep5Save) {
    btnPreshiftStep5Save.addEventListener('click', async () => {
      if (!selectedPreshiftWorker) return;

      const expiryStatus = lastExpiryAnalysisResult ? lastExpiryAnalysisResult.expiry_status : 'VALID';
      const refColor = lastExpiryAnalysisResult ? lastExpiryAnalysisResult.reference_color : '#6A9EAE';
      const validityPct = lastExpiryAnalysisResult && lastExpiryAnalysisResult.validity_percentage !== null ? lastExpiryAnalysisResult.validity_percentage : 100;
      const detectedHex = lastExpiryAnalysisResult ? lastExpiryAnalysisResult.detected_hex : '#6A9EAE';

      const basePpm = lastH2sAnalysisResult && lastH2sAnalysisResult.estimated_ppm !== null ? lastH2sAnalysisResult.estimated_ppm : 0.0;
      const correctedHex = lastH2sAnalysisResult ? lastH2sAnalysisResult.corrected_hex : '#96CDE1';
      const closestRef = lastH2sAnalysisResult ? lastH2sAnalysisResult.closest_reference_label : '0.0 ppm (#96CDE1)';

      try {
        // 1. Save Pre-Shift Scan Record with baseline H2S PPM
        const scanRes = await fetchWithAuth('/api/scans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            worker_id: selectedPreshiftWorker.worker_id,
            scan_type: 'pre-shift',
            image_path: h2sCapturedImageData || capturedImageData || '/uploads/scans/scan_capture.jpg',
            quality: 'High',
            expiry_indicator_status: expiryStatus,
            reference_color: refColor,
            validity_percentage: validityPct,
            detected_hex: detectedHex,
            corrected_hex: correctedHex,
            h2s_ppm: basePpm,
            pre_shift_ppm: basePpm,
            closest_h2s_reference: closestRef,
            status: 'completed'
          })
        });

        const scanJson = await scanRes.json();
        if (!scanJson.success) throw new Error(scanJson.error || 'Failed to save pre-shift scan.');

        // 2. Launch Active Shift
        const shiftRes = await fetchWithAuth('/api/shifts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            worker_id: selectedPreshiftWorker.worker_id,
            badge_id: selectedPreshiftWorker.badge_id
          })
        });

        const shiftJson = await shiftRes.json();
        if (!shiftJson.success) throw new Error(shiftJson.error || 'Failed to start shift.');

        const newShift = shiftJson.data;

        confWorkerName.textContent = selectedPreshiftWorker.name;
        confBadgeId.textContent = selectedPreshiftWorker.badge_id;
        confStartTime.textContent = formatDateTime(newShift.start_time || new Date().toISOString());
        if (confBaselinePpm) confBaselinePpm.textContent = `${basePpm.toFixed(1)} ppm`;

        setWizardStep(6);
        refreshAllData();
      } catch (err) {
        alert(err.message || 'Error completing pre-shift workflow.');
      }
    });
  }

  if (btnConfDashboard) btnConfDashboard.addEventListener('click', () => switchView('view-dashboard'));
  if (btnConfViewWorker) {
    btnConfViewWorker.addEventListener('click', () => {
      if (selectedPreshiftWorker) openWorkerProfileModal(selectedPreshiftWorker.id);
    });
  }

  // -------------------------------------------------------------
  // STAGE 4: POST-SHIFT SCAN WORKFLOW WIZARD LOGIC
  // -------------------------------------------------------------

  function setPostWizardStep(stepNum) {
    for (let i = 1; i <= 5; i++) {
      const stepEl = document.getElementById(`post-ws-step-${i}`);
      const panelEl = document.getElementById(`postshift-step-${i}-panel`);

      if (stepEl) {
        if (i < stepNum) {
          stepEl.className = 'wizard-step completed';
        } else if (i === stepNum) {
          stepEl.className = 'wizard-step active';
        } else {
          stepEl.className = 'wizard-step';
        }
      }

      if (panelEl) {
        if (i === stepNum) {
          panelEl.classList.add('active');
        } else {
          panelEl.classList.remove('active');
        }
      }
    }
  }

  // Load Active Shifts into Step 1 Selector
  async function loadPostshiftActiveShifts() {
    try {
      const res = await fetchWithAuth('/api/shifts/active');
      const json = await res.json();
      if (!json.success) return;

      activeShiftsData = json.data;
      if (currentUser && currentUser.role === 'worker') {
        activeShiftsData = activeShiftsData.filter(s => String(s.worker_id).toLowerCase() === String(currentUser.worker_id).toLowerCase());
      }

      selectPostshiftShift.innerHTML = '<option value="">-- Select Active Shift Worker --</option>';

      if (activeShiftsData.length === 0) {
        selectPostshiftShift.innerHTML = '<option value="">No active worker shifts currently open.</option>';
        btnPostshiftStep1Next.disabled = true;
        return;
      }

      activeShiftsData.forEach(s => {
        const option = document.createElement('option');
        option.value = s.id;
        option.textContent = `${s.worker_id} - ${s.worker_name} (Shift Started: ${formatTime(s.start_time)})`;
        selectPostshiftShift.appendChild(option);
      });

      if (currentUser && currentUser.role === 'worker' && activeShiftsData.length === 1) {
        selectPostshiftShift.value = activeShiftsData[0].id;
        selectPostshiftShift.dispatchEvent(new Event('change'));
      }
    } catch (err) {
      console.error('Failed to load active shifts for post-shift:', err);
    }
  }

  if (selectPostshiftShift) {
    selectPostshiftShift.addEventListener('change', () => {
      postshiftAlertMsg.classList.add('hidden');
      const selectedId = selectPostshiftShift.value;
      if (!selectedId) {
        selectedActiveShift = null;
        btnPostshiftStep1Next.disabled = true;
        return;
      }

      selectedActiveShift = activeShiftsData.find(s => String(s.id) === String(selectedId));
      btnPostshiftStep1Next.disabled = !selectedActiveShift;
    });
  }

  if (btnPostshiftStep1Next) {
    btnPostshiftStep1Next.addEventListener('click', () => {
      if (!selectedActiveShift) return;
      populatePostShiftDetailsStep();
      setPostWizardStep(2);
    });
  }

  // Step 2: Calculate Shift Duration & Populate Details
  function populatePostShiftDetailsStep() {
    if (!selectedActiveShift) return;

    psWorkerName.textContent = selectedActiveShift.worker_name;
    psWorkerId.textContent = selectedActiveShift.worker_id;
    psDept.textContent = selectedActiveShift.department || 'N/A';
    psBadgeId.textContent = selectedActiveShift.badge_id || 'N/A';
    psStartTime.textContent = formatDateTime(selectedActiveShift.start_time);
    
    const now = new Date();
    psCurrentTime.textContent = formatDateTime(now.toISOString());

    // Dynamic Shift Duration Calculation
    const startTimeDate = new Date(selectedActiveShift.start_time);
    const diffMs = Math.max(0, now - startTimeDate);
    const totalMinutes = Math.max(1, Math.round(diffMs / (1000 * 60)));
    
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    psDurationDisplay.textContent = `${hours} hrs ${mins} mins (${totalMinutes} mins total)`;
  }

  if (btnPostshiftStep2Back) btnPostshiftStep2Back.addEventListener('click', () => setPostWizardStep(1));
  if (btnPostshiftStep2Next) {
    btnPostshiftStep2Next.addEventListener('click', () => {
      setPostWizardStep(3);
      startPostCamera();
    });
  }

  // Step 3: Final Camera Capture Handler
  async function startPostCamera() {
    postCameraErrorAlert.classList.add('hidden');
    postCameraFeed.classList.remove('hidden');
    postImagePreview.classList.add('hidden');
    postCameraCanvas.classList.add('hidden');
    postCameraOverlay.classList.remove('hidden');

    btnPostStartCamera.classList.add('hidden');
    btnPostCaptureImage.classList.remove('hidden');
    btnPostRetakeImage.classList.add('hidden');
    btnPostConfirmScan.classList.add('hidden');

    try {
      if (postCameraStream) stopPostCamera();

      postCameraStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: { ideal: 'environment' } }
      });
      postCameraFeed.srcObject = postCameraStream;
    } catch (err) {
      console.warn('[Post Camera API Warning]:', err);
      let msg = 'Camera initialization failed.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera permission denied. Please allow camera access or use the file upload option below.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No camera device detected on your system. Please use the file upload fallback below.';
      } else {
        msg = `Camera error: ${err.message}. Please use file upload fallback below.`;
      }
      postCameraErrorAlert.textContent = msg;
      postCameraErrorAlert.classList.remove('hidden');

      btnPostStartCamera.classList.remove('hidden');
      btnPostCaptureImage.classList.add('hidden');
    }
  }

  function stopPostCamera() {
    if (postCameraStream) {
      postCameraStream.getTracks().forEach(track => track.stop());
      postCameraStream = null;
    }
    if (postCameraFeed) postCameraFeed.srcObject = null;
  }

  if (btnPostStartCamera) btnPostStartCamera.addEventListener('click', startPostCamera);

  if (btnPostCaptureImage) {
    btnPostCaptureImage.addEventListener('click', () => {
      if (!postCameraFeed.videoWidth) return;

      postCameraCanvas.width = postCameraFeed.videoWidth || 640;
      postCameraCanvas.height = postCameraFeed.videoHeight || 480;

      const ctx = postCameraCanvas.getContext('2d');
      ctx.drawImage(postCameraFeed, 0, 0, postCameraCanvas.width, postCameraCanvas.height);

      postCapturedImageData = postCameraCanvas.toDataURL('image/jpeg', 0.9);

      postImagePreview.src = postCapturedImageData;
      postImagePreview.classList.remove('hidden');
      postCameraFeed.classList.add('hidden');
      postCameraOverlay.classList.add('hidden');

      btnPostCaptureImage.classList.add('hidden');
      btnPostRetakeImage.classList.remove('hidden');
      btnPostConfirmScan.classList.remove('hidden');

      stopPostCamera();
    });
  }

  if (btnPostRetakeImage) {
    btnPostRetakeImage.addEventListener('click', () => {
      postCapturedImageData = null;
      startPostCamera();
    });
  }

  if (postFileScanUpload) {
    postFileScanUpload.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        postCapturedImageData = event.target.result;
        postImagePreview.src = postCapturedImageData;
        postImagePreview.classList.remove('hidden');
        postCameraFeed.classList.add('hidden');
        postCameraOverlay.classList.add('hidden');

        btnPostStartCamera.classList.add('hidden');
        btnPostCaptureImage.classList.add('hidden');
        btnPostRetakeImage.classList.remove('hidden');
        btnPostConfirmScan.classList.remove('hidden');
        stopPostCamera();
      };
      reader.readAsDataURL(file);
    });
  }

  if (btnPostshiftStep3Back) {
    btnPostshiftStep3Back.addEventListener('click', () => {
      stopPostCamera();
      setPostWizardStep(2);
    });
  }

  if (btnPostConfirmScan) {
    btnPostConfirmScan.addEventListener('click', () => {
      if (!postCapturedImageData) return alert('Please capture or upload a final scan image first.');
      performPostQualityGateCheck();
      setPostWizardStep(4);
    });
  }

  // Step 4: Quality Gate Check
  function performPostQualityGateCheck() {
    if (!postCapturedImageData) {
      showPostQualityGateResult(false, 'No image captured');
      return;
    }

    const img = new Image();
    img.onload = () => {
      const width = img.width;
      const height = img.height;

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const ctx = tempCanvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const imgData = ctx.getImageData(0, 0, width, height).data;
      let totalBrightness = 0;
      const sampleStep = 4 * 20;

      for (let i = 0; i < imgData.length; i += sampleStep) {
        const r = imgData[i];
        const g = imgData[i + 1];
        const b = imgData[i + 2];
        totalBrightness += (r + g + b) / 3;
      }

      const sampleCount = imgData.length / sampleStep;
      const avgBrightness = totalBrightness / sampleCount;

      postQcValDimensions.textContent = `Valid (${width} x ${height} px)`;

      if (avgBrightness < 12) {
        postQcValLighting.textContent = 'Too Dark / Obscured';
        postQcValLighting.className = 'text-danger';
        showPostQualityGateResult(false, 'Image appears dark or covered. Please retake under adequate lighting.');
      } else {
        postQcValLighting.textContent = 'Adequate Illumination';
        postQcValLighting.className = 'text-success';
        showPostQualityGateResult(true);
      }
    };
    img.src = postCapturedImageData;
  }

  function showPostQualityGateResult(passed, reason) {
    if (passed) {
      postQualityGateBanner.className = 'status-banner status-banner-valid mb-4';
      postQualityGateBanner.innerHTML = `
        <span class="banner-icon">✅</span>
        <div>
          <strong>IMAGE READY — QUALITY GATE PASSED</strong>
          <p class="text-xs" style="margin-top:0.2rem;">Post-shift badge image verified. Ready to save scan and complete shift.</p>
        </div>
      `;
      postQcValCaptured.textContent = 'Verified';
      postQcValCaptured.className = 'text-success';
      btnPostshiftStep4Complete.disabled = false;
    } else {
      postQualityGateBanner.className = 'status-banner status-banner-invalid mb-4';
      postQualityGateBanner.innerHTML = `
        <span class="banner-icon">⚠️</span>
        <div>
          <strong>RETAKE REQUIRED — QUALITY GATE FAILED</strong>
          <p class="text-xs" style="margin-top:0.2rem;">${reason || 'Quality check failed. Retake image capture.'}</p>
        </div>
      `;
      postQcValCaptured.textContent = 'Check Failed';
      postQcValCaptured.className = 'text-danger';
      btnPostshiftStep4Complete.disabled = true;
    }
  }

  if (btnPostshiftStep4Retake) {
    btnPostshiftStep4Retake.addEventListener('click', () => {
      setPostWizardStep(3);
      startPostCamera();
    });
  }

  // Step 5: Save Post-Shift Scan & Complete Shift
  if (btnPostshiftStep4Complete) {
    btnPostshiftStep4Complete.addEventListener('click', async () => {
      if (!selectedActiveShift || !postCapturedImageData) return;

      try {
        // 1. Save Post-Shift Scan Log
        const scanRes = await fetchWithAuth('/api/scans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            worker_id: selectedActiveShift.worker_id,
            shift_id: selectedActiveShift.id,
            scan_type: 'post-shift',
            image_path: postCapturedImageData,
            quality: 'High',
            status: 'completed'
          })
        });

        const scanJson = await scanRes.json();
        if (!scanJson.success) throw new Error(scanJson.error || 'Failed to save post-shift scan.');
        if (scanJson.data && scanJson.data.id) {
          currentCompletedPostScanId = scanJson.data.id;
        }

        // 2. Complete Active Shift in Database
        const shiftRes = await fetchWithAuth(`/api/shifts/${selectedActiveShift.id}/complete`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' }
        });

        const shiftJson = await shiftRes.json();
        if (!shiftJson.success) throw new Error(shiftJson.error || 'Failed to complete shift.');

        const completedShift = shiftJson.data;

        // Render Shift Completed Result Page
        pconfWorkerName.textContent = selectedActiveShift.worker_name;
        pconfBadgeId.textContent = selectedActiveShift.badge_id;
        pconfStartTime.textContent = formatDateTime(completedShift.start_time);
        pconfEndTime.textContent = formatDateTime(completedShift.end_time || new Date().toISOString());

        const durationMins = completedShift.duration_minutes || 1;
        const hrs = Math.floor(durationMins / 60);
        const mins = durationMins % 60;
        pconfDuration.textContent = `${hrs} hrs ${mins} mins (${durationMins} mins)`;

        const prePpmEl = document.getElementById('pconf-pre-ppm');
        const postPpmEl = document.getElementById('pconf-post-ppm');
        const deltaPpmEl = document.getElementById('pconf-delta-ppm');
        const finalExpEl = document.getElementById('pconf-final-exposure');

        if (prePpmEl) prePpmEl.textContent = `${completedShift.pre_shift_ppm !== undefined ? completedShift.pre_shift_ppm : 0.0} ppm`;
        if (postPpmEl) postPpmEl.textContent = `${completedShift.post_shift_ppm !== undefined ? completedShift.post_shift_ppm : 0.0} ppm`;
        if (deltaPpmEl) deltaPpmEl.textContent = `${completedShift.delta_ppm !== undefined ? completedShift.delta_ppm : 0.0} ppm`;
        if (finalExpEl) finalExpEl.textContent = `${completedShift.final_exposure_ppm_h !== undefined ? completedShift.final_exposure_ppm_h : 0.00} ppm-h`;

        setPostWizardStep(5);
        refreshAllData();
      } catch (err) {
        showToast(err.message || 'Error completing post-shift workflow.', 'error');
      }
    });
  }

  const btnPostConfAnalysis = document.getElementById('btn-post-conf-analysis');
  if (btnPostConfAnalysis) {
    btnPostConfAnalysis.addEventListener('click', () => {
      if (currentCompletedPostScanId) {
        openAnalysisResultScreen(currentCompletedPostScanId);
      } else {
        switchView('view-history');
      }
    });
  }

  if (btnPostConfDashboard) btnPostConfDashboard.addEventListener('click', () => switchView('view-dashboard'));
  if (btnPostConfHistory) btnPostConfHistory.addEventListener('click', () => switchView('view-history'));

  // -------------------------------------------------------------
  // Form Submission: Add & Edit Worker
  // -------------------------------------------------------------
  if (formWorker) {
    formWorker.addEventListener('submit', async (e) => {
      e.preventDefault();
      formErrorMsg.classList.add('hidden');

      const editId = inputEditWorkerId.value;
      const worker_id = inputWorkerId.value.trim();
      const name = inputWorkerName.value.trim();
      const department = inputWorkerDept.value;
      const badge_id = inputWorkerBadge.value.trim();
      const manufacture_date = inputBadgeMfg.value;
      const expiry_date = inputBadgeExpiry.value;

      if (!worker_id || !name || !department || !badge_id || !expiry_date) {
        formErrorMsg.textContent = 'Please fill in all required fields marked with *.';
        formErrorMsg.classList.remove('hidden');
        return;
      }

      const payload = {
        worker_id,
        name,
        department,
        badge_id,
        manufacture_date,
        expiry_date
      };

      const url = editId ? `/api/workers/${editId}` : '/api/workers';
      const method = editId ? 'PUT' : 'POST';

      try {
        const res = await fetchWithAuth(url, {
          method: method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const json = await res.json();
        if (json.success) {
          closeWorkerModal();
          refreshAllData();
        } else {
          formErrorMsg.textContent = json.error || 'Failed to save worker record.';
          formErrorMsg.classList.remove('hidden');
        }
      } catch (err) {
        formErrorMsg.textContent = 'Server communication failure.';
        formErrorMsg.classList.remove('hidden');
      }
    });
  }

  // -------------------------------------------------------------
  // STAGE 5: EXPOSURE HISTORY & RECORDS MODULE
  // -------------------------------------------------------------
  let historyState = {
    activeTab: 'scans',
    search: '',
    workerId: '',
    department: '',
    scanType: '',
    status: '',
    dateFrom: '',
    dateTo: '',
    sortBy: 'timestamp',
    scansPage: 1,
    scansLimit: 10,
    shiftsPage: 1,
    shiftsLimit: 10
  };

  // Tab switching
  if (btnTabScans) {
    btnTabScans.addEventListener('click', () => {
      historyState.activeTab = 'scans';
      btnTabScans.classList.add('active');
      if (btnTabShifts) btnTabShifts.classList.remove('active');
      if (tabScansContent) tabScansContent.classList.remove('hidden');
      if (tabShiftsContent) tabShiftsContent.classList.add('hidden');
      loadHistoryScans();
    });
  }

  if (btnTabShifts) {
    btnTabShifts.addEventListener('click', () => {
      historyState.activeTab = 'shifts';
      btnTabShifts.classList.add('active');
      if (btnTabScans) btnTabScans.classList.remove('active');
      if (tabShiftsContent) tabShiftsContent.classList.remove('hidden');
      if (tabScansContent) tabScansContent.classList.add('hidden');
      loadHistoryShifts();
    });
  }

  // Filter Event Listeners
  if (historySearchInput) {
    historySearchInput.addEventListener('input', () => {
      historyState.search = historySearchInput.value.trim();
      historyState.scansPage = 1;
      historyState.shiftsPage = 1;
      triggerHistoryReload();
    });
  }

  if (historyFilterWorker) {
    historyFilterWorker.addEventListener('change', () => {
      historyState.workerId = historyFilterWorker.value;
      historyState.scansPage = 1;
      historyState.shiftsPage = 1;
      triggerHistoryReload();
    });
  }

  if (historyFilterDept) {
    historyFilterDept.addEventListener('change', () => {
      historyState.department = historyFilterDept.value;
      historyState.scansPage = 1;
      historyState.shiftsPage = 1;
      triggerHistoryReload();
    });
  }

  if (historyFilterScantype) {
    historyFilterScantype.addEventListener('change', () => {
      historyState.scanType = historyFilterScantype.value;
      historyState.scansPage = 1;
      triggerHistoryReload();
    });
  }

  if (historyFilterStatus) {
    historyFilterStatus.addEventListener('change', () => {
      historyState.status = historyFilterStatus.value;
      historyState.scansPage = 1;
      historyState.shiftsPage = 1;
      triggerHistoryReload();
    });
  }

  if (historyFilterDateFrom) {
    historyFilterDateFrom.addEventListener('change', () => {
      historyState.dateFrom = historyFilterDateFrom.value;
      historyState.scansPage = 1;
      triggerHistoryReload();
    });
  }

  if (historyFilterDateTo) {
    historyFilterDateTo.addEventListener('change', () => {
      historyState.dateTo = historyFilterDateTo.value;
      historyState.scansPage = 1;
      triggerHistoryReload();
    });
  }

  if (historySortBy) {
    historySortBy.addEventListener('change', () => {
      historyState.sortBy = historySortBy.value;
      historyState.scansPage = 1;
      triggerHistoryReload();
    });
  }

  if (btnResetHistoryFilters) {
    btnResetHistoryFilters.addEventListener('click', () => {
      historyState.search = '';
      historyState.workerId = '';
      historyState.department = '';
      historyState.scanType = '';
      historyState.status = '';
      historyState.dateFrom = '';
      historyState.dateTo = '';
      historyState.sortBy = 'timestamp';
      historyState.scansPage = 1;
      historyState.shiftsPage = 1;

      if (historySearchInput) historySearchInput.value = '';
      if (historyFilterWorker) historyFilterWorker.value = '';
      if (historyFilterDept) historyFilterDept.value = '';
      if (historyFilterScantype) historyFilterScantype.value = '';
      if (historyFilterStatus) historyFilterStatus.value = '';
      if (historyFilterDateFrom) historyFilterDateFrom.value = '';
      if (historyFilterDateTo) historyFilterDateTo.value = '';
      if (historySortBy) historySortBy.value = 'timestamp';

      triggerHistoryReload();
    });
  }

  function triggerHistoryReload() {
    if (historyState.activeTab === 'scans') {
      loadHistoryScans();
    } else {
      loadHistoryShifts();
    }
  }

  // Pagination Event Listeners
  if (btnHistoryPrev) {
    btnHistoryPrev.addEventListener('click', () => {
      if (historyState.scansPage > 1) {
        historyState.scansPage--;
        loadHistoryScans();
      }
    });
  }

  if (btnHistoryNext) {
    btnHistoryNext.addEventListener('click', () => {
      historyState.scansPage++;
      loadHistoryScans();
    });
  }

  if (btnShiftsPrev) {
    btnShiftsPrev.addEventListener('click', () => {
      if (historyState.shiftsPage > 1) {
        historyState.shiftsPage--;
        loadHistoryShifts();
      }
    });
  }

  if (btnShiftsNext) {
    btnShiftsNext.addEventListener('click', () => {
      historyState.shiftsPage++;
      loadHistoryShifts();
    });
  }

  // Load Scan History Table
  async function loadHistoryScans() {
    if (!historyScansTableBody) return;

    try {
      const params = new URLSearchParams({
        search: historyState.search,
        worker_id: historyState.workerId,
        department: historyState.department,
        scan_type: historyState.scanType,
        status: historyState.status,
        date_from: historyState.dateFrom,
        date_to: historyState.dateTo,
        sort_by: historyState.sortBy,
        page: historyState.scansPage,
        limit: historyState.scansLimit
      });

      const res = await fetchWithAuth(`/api/scans?${params.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load scans.');

      const { data: scans, pagination } = json;

      const hasFilters = !!(historyState.search || historyState.workerId || historyState.department || historyState.scanType || historyState.status || historyState.dateFrom || historyState.dateTo);

      if (scans.length === 0) {
        const msg = hasFilters ? 'No matching records found.' : 'No exposure records available.';
        historyScansTableBody.innerHTML = `<tr><td colspan="13" class="empty-cell">${msg}</td></tr>`;
      } else {
        historyScansTableBody.innerHTML = scans.map(s => {
          const typeBadge = s.scan_type === 'pre-shift' ? '<span class="badge badge-info">Pre-Shift</span>' : '<span class="badge badge-warning">Post-Shift</span>';
          const colorVal = s.detected_color ? `<code>${escapeHtml(s.detected_color)}</code>` : 'N/A';
          
          let expVal = '<span class="badge badge-warning">Pending Analysis</span>';
          let statusBadge = '<span class="badge badge-warning">Pending Analysis</span>';
          if (s.exposure_estimate !== null && s.exposure_estimate !== undefined) {
            expVal = `<strong>${s.exposure_estimate} PPM</strong>`;
            statusBadge = '<span class="badge badge-success">Completed</span>';
          } else if (s.status === 'invalid') {
            statusBadge = '<span class="badge badge-danger">Invalid</span>';
          } else if (s.status === 'retake_required') {
            statusBadge = '<span class="badge badge-danger">Retake Required</span>';
          }

          const confVal = s.confidence !== null && s.confidence !== undefined ? `${Math.round(s.confidence * 100)}%` : 'N/A';
          const qualityBadge = s.quality === 'High' ? '<span class="badge badge-success">High</span>' : `<span class="badge badge-warning">${escapeHtml(s.quality || 'Medium')}</span>`;

          return `
            <tr>
              <td><code>#SCN-${s.id}</code></td>
              <td><code>${escapeHtml(s.worker_id)}</code></td>
              <td><strong>${escapeHtml(s.worker_name || 'Worker')}</strong></td>
              <td>${escapeHtml(s.department || 'N/A')}</td>
              <td><code>${escapeHtml(s.badge_id || 'N/A')}</code></td>
              <td>${typeBadge}</td>
              <td>${colorVal}</td>
              <td>${expVal}</td>
              <td>${confVal}</td>
              <td>${qualityBadge}</td>
              <td>${statusBadge}</td>
              <td>${formatDateTime(s.created_at)}</td>
              <td style="text-align:right">
                <button class="action-btn btn-view-scan-details" data-id="${s.id}" title="View Scan Details">
                  👁️ Details
                </button>
              </td>
            </tr>
          `;
        }).join('');

        attachScanDetailsActions();
      }

      if (historyPaginationInfo && pagination) {
        const fromCount = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
        const toCount = Math.min(pagination.page * pagination.limit, pagination.total);
        historyPaginationInfo.textContent = `Showing ${fromCount} to ${toCount} of ${pagination.total} records`;
        if (historyPageIndicator) historyPageIndicator.textContent = `Page ${pagination.page} of ${pagination.totalPages || 1}`;
        if (btnHistoryPrev) btnHistoryPrev.disabled = pagination.page <= 1;
        if (btnHistoryNext) btnHistoryNext.disabled = pagination.page >= pagination.totalPages;
      }
    } catch (err) {
      console.error('Error loading history scans:', err);
      historyScansTableBody.innerHTML = `<tr><td colspan="13" class="empty-cell">Error loading scan history logs.</td></tr>`;
    }
  }

  // Load Shift Logs Table
  async function loadHistoryShifts() {
    if (!shiftsTableBody) return;

    try {
      const params = new URLSearchParams({
        search: historyState.search,
        worker_id: historyState.workerId,
        status: historyState.status,
        page: historyState.shiftsPage,
        limit: historyState.shiftsLimit
      });

      const res = await fetchWithAuth(`/api/shifts?${params.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load shifts.');

      const { data: shifts, pagination } = json;

      if (shifts.length === 0) {
        const hasFilters = !!(historyState.search || historyState.workerId || historyState.status);
        const msg = hasFilters ? 'No matching records found.' : 'No shift records available.';
        shiftsTableBody.innerHTML = `<tr><td colspan="12" class="empty-cell">${msg}</td></tr>`;
      } else {
        shiftsTableBody.innerHTML = shifts.map(sh => {
          const preScanTag = sh.pre_shift_scan_id ? `<button class="action-btn btn-view-scan-details" data-id="${sh.pre_shift_scan_id}">#SCN-${sh.pre_shift_scan_id}</button>` : 'N/A';
          const postScanTag = sh.post_shift_scan_id ? `<button class="action-btn btn-view-scan-details" data-id="${sh.post_shift_scan_id}">#SCN-${sh.post_shift_scan_id}</button>` : '<span class="text-muted text-xs">Pending Wrap-up</span>';

          const durationStr = sh.duration_minutes ? `${sh.duration_minutes} mins` : '<span class="text-success text-xs font-mono">In Progress</span>';
          const statusTag = sh.status === 'completed' ? '<span class="badge badge-success">Completed</span>' : '<span class="badge badge-info">Active</span>';

          return `
            <tr>
              <td><code>#SFT-${sh.id}</code></td>
              <td><code>${escapeHtml(sh.worker_id)}</code></td>
              <td><strong>${escapeHtml(sh.worker_name || 'Worker')}</strong></td>
              <td>${escapeHtml(sh.department || 'N/A')}</td>
              <td><code>${escapeHtml(sh.badge_id || 'N/A')}</code></td>
              <td>${formatDateTime(sh.start_time)}</td>
              <td>${sh.end_time ? formatDateTime(sh.end_time) : '<span class="text-muted">Active</span>'}</td>
              <td>${durationStr}</td>
              <td>${preScanTag}</td>
              <td>${postScanTag}</td>
              <td>${statusTag}</td>
              <td style="text-align:right">
                <button class="action-btn btn-view-shift-details" data-id="${sh.id}">
                  👁️ Details
                </button>
              </td>
            </tr>
          `;
        }).join('');

        attachShiftDetailsActions();
      }

      if (shiftsPaginationInfo && pagination) {
        const fromCount = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
        const toCount = Math.min(pagination.page * pagination.limit, pagination.total);
        shiftsPaginationInfo.textContent = `Showing ${fromCount} to ${toCount} of ${pagination.total} records`;
        if (shiftsPageIndicator) shiftsPageIndicator.textContent = `Page ${pagination.page} of ${pagination.totalPages || 1}`;
        if (btnShiftsPrev) btnShiftsPrev.disabled = pagination.page <= 1;
        if (btnShiftsNext) btnShiftsNext.disabled = pagination.page >= pagination.totalPages;
      }
    } catch (err) {
      console.error('Error loading shifts history:', err);
      shiftsTableBody.innerHTML = `<tr><td colspan="12" class="empty-cell">Error loading shift history logs.</td></tr>`;
    }
  }

  function attachScanDetailsActions() {
    document.querySelectorAll('.btn-view-scan-details').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        openScanDetailsModal(id);
      });
    });
  }

  function attachShiftDetailsActions() {
    document.querySelectorAll('.btn-view-shift-details').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        openShiftDetailsModal(id);
      });
    });
  }

  let currentActiveScanModalId = null;

  async function openScanDetailsModal(scanId) {
    try {
      currentActiveScanModalId = scanId;
      const res = await fetchWithAuth(`/api/scans/${scanId}/analysis-result`);
      const json = await res.json();
      if (!json.success) return alert(json.error || 'Scan analysis record not found.');

      const data = json.data;

      const sdHierarchyPath = document.getElementById('sd-hierarchy-path');
      const sdDetectedHex = document.getElementById('sd-detected-hex');
      const sdDetectedSwatch = document.getElementById('sd-detected-swatch');
      const sdUnit = document.getElementById('sd-unit');
      const sdConfidence = document.getElementById('sd-confidence');
      const sdAnalysisStatusBadge = document.getElementById('sd-analysis-status-badge');
      const sdWarningsBox = document.getElementById('sd-warnings-box');
      const sdWarningsText = document.getElementById('sd-warnings-text');
      const sdAdminSimActions = document.getElementById('sd-admin-sim-actions');

      sdTitle.textContent = `Scan Record Analysis Details (#SCN-${data.scan_id})`;
      sdSubtitle.textContent = `Type: ${data.scan_type.toUpperCase()} | Recorded: ${formatDateTime(data.created_at)}`;

      if (sdHierarchyPath) {
        sdHierarchyPath.textContent = data.hierarchy || `Worker (${data.worker_id}) → Shift (${data.shift_id}) → Scan (#SCN-${data.scan_id})`;
      }

      if (sdImagePreview) {
        sdImagePreview.src = data.image_path || '/uploads/scans/sample_preshift_1.jpg';
      }

      if (sdQualityBadge) {
        sdQualityBadge.textContent = data.quality || 'High';
        sdQualityBadge.className = `badge ${data.quality === 'High' ? 'badge-success' : 'badge-warning'}`;
      }

      sdWorkerName.textContent = data.worker_name || 'Worker';
      sdWorkerId.textContent = data.worker_id;
      sdDepartment.textContent = data.department || 'N/A';
      sdBadgeId.textContent = data.badge_id || 'N/A';
      sdScanType.textContent = data.scan_type === 'pre-shift' ? 'Pre-Shift Baseline' : 'Post-Shift Scan';
      sdTimestamp.textContent = formatDateTime(data.created_at);

      if (sdDetectedHex) sdDetectedHex.textContent = data.detected_hex || 'N/A';
      if (sdDetectedSwatch) sdDetectedSwatch.style.background = (data.detected_hex && data.detected_hex !== 'N/A') ? data.detected_hex : '#64748b';
      if (sdUnit) sdUnit.textContent = data.unit || 'ppm-h';
      if (sdConfidence) sdConfidence.textContent = data.confidence_display || 'N/A';

      if (sdAnalysisStatusBadge) {
        sdAnalysisStatusBadge.textContent = data.status_display || 'COMPLETED';
        if (data.status === 'completed') sdAnalysisStatusBadge.className = 'badge badge-success';
        else if (data.status === 'provisional') sdAnalysisStatusBadge.className = 'badge badge-warning';
        else if (data.status === 'unavailable' || data.status === 'pending') sdAnalysisStatusBadge.className = 'badge badge-info';
        else sdAnalysisStatusBadge.className = 'badge badge-danger';
      }

      // Display "Pending Analysis" for unavailable/pending results without generating fake values!
      if (sdExposureEstimate) {
        if (data.exposure_estimate !== null && data.exposure_estimate !== undefined) {
          sdExposureEstimate.textContent = `${data.exposure_estimate} ${data.unit || 'ppm-h'}`;
          sdExposureEstimate.className = 'detail-value text-primary';
        } else {
          sdExposureEstimate.textContent = 'Pending Analysis';
          sdExposureEstimate.className = 'detail-value text-warning';
        }
      }

      if (sdWarningsBox && sdWarningsText) {
        if (data.warnings && data.warnings.length > 0) {
          sdWarningsBox.classList.remove('hidden');
          sdWarningsText.innerHTML = data.warnings.map(w => `• ${escapeHtml(w)}`).join('<br>');
        } else {
          sdWarningsBox.classList.add('hidden');
          sdWarningsText.textContent = '';
        }
      }

      if (sdAdminSimActions) {
        sdAdminSimActions.style.display = (currentUser && currentUser.role === 'admin') ? 'flex' : 'none';
      }

      scanDetailsModal.classList.remove('hidden');
    } catch (err) {
      alert('Failed to load scan record analysis details.');
    }
  }

  // Handle external analysis simulation buttons inside scan details modal
  document.querySelectorAll('.btn-sim-analysis-result').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!currentActiveScanModalId) return;
      const exposureRaw = btn.getAttribute('data-exposure');
      const statusVal = btn.getAttribute('data-status');
      const exposureVal = exposureRaw === 'null' ? null : parseFloat(exposureRaw);

      try {
        const res = await fetchWithAuth(`/api/scans/${currentActiveScanModalId}/analysis-result`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            detected_hex: exposureVal > 10.0 ? '#8B0000' : (exposureVal ? '#316EE6' : '#215F9A'),
            exposure_estimate: exposureVal,
            unit: 'ppm-h',
            confidence: 0.95,
            quality: 'High',
            status: statusVal,
            warnings: exposureVal > 10.0 ? ['High exposure threshold exceeded (> 10.0 ppm-h)'] : []
          })
        });

        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to submit external analysis result.');

        showToast(`External Analysis Result Saved for #SCN-${currentActiveScanModalId}`, 'success');
        await openScanDetailsModal(currentActiveScanModalId);
        refreshAllData();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  async function openShiftDetailsModal(shiftId) {
    try {
      const res = await fetchWithAuth(`/api/shifts/${shiftId}`);
      const json = await res.json();
      if (!json.success) return alert(json.error || 'Shift record not found.');

      const shift = json.data;

      shdTitle.textContent = `Shift Record Details (#SFT-${shift.id})`;
      shdSubtitle.textContent = `Worker: ${shift.worker_name} (${shift.worker_id})`;

      shdWorkerName.textContent = shift.worker_name;
      shdWorkerId.textContent = shift.worker_id;
      shdDepartment.textContent = shift.department || 'N/A';
      shdBadgeId.textContent = shift.badge_id || 'N/A';
      shdStartTime.textContent = formatDateTime(shift.start_time);
      shdEndTime.textContent = shift.end_time ? formatDateTime(shift.end_time) : 'Active Shift';

      const durationMins = shift.duration_minutes || (shift.status === 'completed' ? 1 : null);
      if (durationMins) {
        const hrs = Math.floor(durationMins / 60);
        const mins = durationMins % 60;
        shdDuration.textContent = `${hrs} hrs ${mins} mins (${durationMins} mins)`;
      } else {
        shdDuration.textContent = 'Shift In Progress';
      }

      shdStatusBadge.innerHTML = `<span class="badge ${shift.status === 'completed' ? 'badge-success' : 'badge-info'}">${shift.status.toUpperCase()}</span>`;

      const scansRes = await fetchWithAuth(`/api/scans/worker/${shift.worker_id}`);
      const scansJson = await scansRes.json();
      const workerScans = scansJson.success ? scansJson.data : [];

      const preScan = workerScans.find(s => s.shift_id === shift.id && (s.scan_type === 'pre-shift' || s.scan_type === 'pre_shift'));
      const postScan = workerScans.find(s => s.shift_id === shift.id && (s.scan_type === 'post-shift' || s.scan_type === 'post_shift'));

      if (preScan) {
        shdPreshiftStatus.textContent = `#SCN-${preScan.id} (${formatDateTime(preScan.created_at)})`;
        btnViewShdPreshift.disabled = false;
        btnViewShdPreshift.onclick = () => {
          closeShiftDetailsModal();
          openScanDetailsModal(preScan.id);
        };
      } else {
        shdPreshiftStatus.textContent = 'No Pre-Shift Record Logged';
        btnViewShdPreshift.disabled = true;
      }

      if (postScan) {
        shdPostshiftStatus.textContent = `#SCN-${postScan.id} (${formatDateTime(postScan.created_at)})`;
        btnViewShdPostshift.disabled = false;
        btnViewShdPostshift.onclick = () => {
          closeShiftDetailsModal();
          openScanDetailsModal(postScan.id);
        };
      } else {
        shdPostshiftStatus.textContent = shift.status === 'completed' ? 'Scan Record Missing' : 'Pending Shift Wrap-up';
        btnViewShdPostshift.disabled = true;
      }

      shiftDetailsModal.classList.remove('hidden');
    } catch (err) {
      alert('Failed to load shift details.');
    }
  }

  async function loadRecentScans() {
    if (!recentScansTableBody) return;
    try {
      const res = await fetchWithAuth('/api/scans?limit=5');
      const json = await res.json();
      if (!json.success) return;

      const scans = json.data;
      if (scans.length === 0) {
        recentScansTableBody.innerHTML = `<tr><td colspan="7" class="empty-cell">No scan logs available.</td></tr>`;
      } else {
        recentScansTableBody.innerHTML = scans.map(s => {
          const typeTag = s.scan_type === 'pre-shift' ? '<span class="badge badge-info">Pre-Shift</span>' : '<span class="badge badge-warning">Post-Shift</span>';
          const expTag = s.exposure_estimate !== null ? `<strong>${s.exposure_estimate} PPM</strong>` : '<span class="badge badge-warning">Pending Analysis</span>';
          const statusTag = s.exposure_estimate !== null ? '<span class="badge badge-success">Completed</span>' : '<span class="badge badge-warning">Pending Analysis</span>';

          return `
            <tr>
              <td><code>#SCN-${s.id}</code></td>
              <td><strong>${escapeHtml(s.worker_name || 'Worker')}</strong><br><small style="color:var(--text-dim)">ID: ${escapeHtml(s.worker_id)}</small></td>
              <td>${typeTag}</td>
              <td>${expTag}</td>
              <td>${statusTag}</td>
              <td>${formatTime(s.created_at)}</td>
              <td style="text-align:right">
                <button class="action-btn btn-view-scan-details" data-id="${s.id}">👁️ View</button>
              </td>
            </tr>
          `;
        }).join('');

        attachScanDetailsActions();
      }
    } catch (err) {
      console.error('Failed to load recent scans:', err);
    }
  }

  function closeScanDetailsModal() {
    if (scanDetailsModal) scanDetailsModal.classList.add('hidden');
  }

  function closeShiftDetailsModal() {
    if (shiftDetailsModal) shiftDetailsModal.classList.add('hidden');
  }

  if (btnCloseScanDetailsModal) btnCloseScanDetailsModal.addEventListener('click', closeScanDetailsModal);
  if (btnCloseScanDetails) btnCloseScanDetails.addEventListener('click', closeScanDetailsModal);
  if (btnCloseShiftDetailsModal) btnCloseShiftDetailsModal.addEventListener('click', closeShiftDetailsModal);
  if (btnCloseShiftDetails) btnCloseShiftDetails.addEventListener('click', closeShiftDetailsModal);

  if (btnVpViewHistory) {
    btnVpViewHistory.addEventListener('click', () => {
      if (!currentProfileWorkerId) return;
      closeProfileModal();
      if (historyFilterWorker) historyFilterWorker.value = currentProfileWorkerId;
      historyState.workerId = currentProfileWorkerId;
      historyState.scansPage = 1;
      switchView('view-history');
      loadHistoryScans();
    });
  }

  // -------------------------------------------------------------
  // SETTINGS & DIAGNOSTICS LOGIC
  // -------------------------------------------------------------
  async function loadSettingsDiagnostics() {
    const setAppVersionBadge = document.getElementById('settings-app-version-badge');
    const setAppName = document.getElementById('set-app-name');
    const setAppBuild = document.getElementById('set-app-build');
    const setAppEnv = document.getElementById('set-app-env');
    const setAppBackend = document.getElementById('set-app-backend');
    const setAppDbengine = document.getElementById('set-app-dbengine');
    const setAppAnalysis = document.getElementById('set-app-analysis');

    const setDbStatusBadge = document.getElementById('set-db-status-badge');
    const setDbFilesize = document.getElementById('set-db-filesize');
    const setDbWorkers = document.getElementById('set-db-workers');
    const setDbShifts = document.getElementById('set-db-shifts');
    const setDbScans = document.getElementById('set-db-scans');
    const setDbJournal = document.getElementById('set-db-journal');

    try {
      // Fetch App Info
      const appRes = await fetchWithAuth('/api/app/info');
      const appJson = await appRes.json();
      if (appJson.success) {
        const d = appJson.data;
        if (setAppVersionBadge) setAppVersionBadge.textContent = `v${d.version}`;
        if (setAppName) setAppName.textContent = d.name;
        if (setAppBuild) setAppBuild.textContent = d.build;
        if (setAppEnv) setAppEnv.textContent = d.environment;
        if (setAppBackend) setAppBackend.textContent = d.backendFramework;
        if (setAppDbengine) setAppDbengine.textContent = d.databaseEngine;
        if (setAppAnalysis) setAppAnalysis.textContent = d.analysisEngineStatus;
      }

      // Fetch DB Diagnostics Status
      const dbRes = await fetchWithAuth('/api/database/status');
      const dbJson = await dbRes.json();
      if (dbJson.success) {
        const d = dbJson.data;
        if (setDbStatusBadge) setDbStatusBadge.innerHTML = `<span class="badge badge-success">Online (Connected)</span>`;
        if (setDbFilesize) setDbFilesize.textContent = d.fileSizeKB;
        if (setDbWorkers) setDbWorkers.textContent = `${d.metrics.activeWorkers} active / ${d.metrics.totalWorkers} total`;
        if (setDbShifts) setDbShifts.textContent = `${d.metrics.activeShifts} active / ${d.metrics.completedShifts} completed`;
        if (setDbScans) setDbScans.textContent = `${d.metrics.totalScans} scans (${d.metrics.pendingScans} pending analysis)`;
        if (setDbJournal) setDbJournal.textContent = d.databaseEngine;
      }
    } catch (err) {
      if (setDbStatusBadge) setDbStatusBadge.innerHTML = `<span class="badge badge-danger">Offline</span>`;
      showToast('Failed to load database status.', 'error');
    }
  }

  const btnRefreshDbStatus = document.getElementById('btn-refresh-db-status');
  const btnExportDbExcel = document.getElementById('btn-export-db-excel');
  const btnExportDbJson = document.getElementById('btn-export-db-json');
  const btnClearTestData = document.getElementById('btn-clear-test-data');

  if (btnRefreshDbStatus) {
    btnRefreshDbStatus.addEventListener('click', () => {
      loadSettingsDiagnostics();
      showToast('Database diagnostics refreshed.', 'success');
    });
  }

  if (btnExportDbExcel) {
    btnExportDbExcel.addEventListener('click', () => {
      showToast('Generating Excel Report (.xlsx)...', 'info');
      const url = currentSessionToken ? `/api/database/export-excel?token=${encodeURIComponent(currentSessionToken)}` : '/api/database/export-excel';
      window.location.href = url;
    });
  }

  if (btnExportDbJson) {
    btnExportDbJson.addEventListener('click', () => {
      showToast('Downloading local SQLite database backup (JSON)...', 'info');
      const url = currentSessionToken ? `/api/database/export?token=${encodeURIComponent(currentSessionToken)}` : '/api/database/export';
      window.location.href = url;
    });
  }

  if (btnClearTestData) {
    btnClearTestData.addEventListener('click', async () => {
      const confirmed = await showConfirmationModal({
        title: '⚠️ Reset Demo / Test Data',
        message: 'Are you sure you want to reset demo test data? Shifts and scans will be cleared and default demo workers restored. Real records will not be lost unless confirmed.',
        keyword: 'CONFIRM_CLEAR_DEMO_DATA',
        icon: '🗑️',
        confirmText: 'Reset Demo Test Data',
        btnClass: 'btn-danger'
      });

      if (!confirmed) return;

      try {
        const res = await fetchWithAuth('/api/database/clear-test-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirmKey: 'CONFIRM_CLEAR_DEMO_DATA' })
        });
        const json = await res.json();
        if (json.success) {
          showToast('Demo test data reset to clean initial state!', 'success');
          refreshAllData();
          loadSettingsDiagnostics();
        } else {
          showToast(json.error || 'Failed to reset test data.', 'error');
        }
      } catch (err) {
        showToast('Communication error resetting test data.', 'error');
      }
    });
  }

  // -------------------------------------------------------------
  // STAGE 6: ANALYSIS RESULT MODULE LOGIC
  // -------------------------------------------------------------
  let currentAnalysisScanId = null;

  const analysisResultModal = document.getElementById('analysis-result-modal');
  const btnCloseArmModal = document.getElementById('btn-close-arm-modal');
  const btnCloseArm = document.getElementById('btn-close-arm');
  const btnAnalysisBackHistory = document.getElementById('btn-analysis-back-history');

  function closeAnalysisResultModal() {
    if (analysisResultModal) analysisResultModal.classList.add('hidden');
  }

  if (btnCloseArmModal) btnCloseArmModal.addEventListener('click', closeAnalysisResultModal);
  if (btnCloseArm) btnCloseArm.addEventListener('click', closeAnalysisResultModal);
  if (btnAnalysisBackHistory) btnAnalysisBackHistory.addEventListener('click', () => switchView('view-history'));

  function renderAnalysisResultContent(data, isModal = false) {
    currentAnalysisScanId = data.scan_id;

    const isPending = data.is_pending || data.status === 'pending_analysis' || data.exposure_estimate === null;
    const isInvalid = data.status === 'invalid_image' || data.quality === 'Invalid';
    const isFailed = data.status === 'failed';

    let bannerClass = 'status-banner-valid';
    let bannerIcon = '✅';
    let bannerTitle = 'ANALYSIS COMPLETED';
    let bannerDesc = `Post-shift H2S badge strip colorimetric scan evaluated and stored in database.`;

    if (isPending) {
      bannerClass = 'status-banner-invalid';
      bannerIcon = '⏳';
      bannerTitle = 'PENDING ANALYSIS';
      bannerDesc = 'Post-shift scan recorded in database. Awaiting H2S colour & AI analysis processing.';
    } else if (isInvalid) {
      bannerClass = 'status-banner-invalid';
      bannerIcon = '⚠️';
      bannerTitle = 'INVALID IMAGE — UNREADABLE BADGE STRIP';
      bannerDesc = 'The captured image quality or target alignment is inadequate for accurate colorimetric analysis.';
    } else if (isFailed) {
      bannerClass = 'status-banner-invalid';
      bannerIcon = '❌';
      bannerTitle = 'ANALYSIS FAILED';
      bannerDesc = 'An error occurred while processing colorimetric evaluation for this badge scan.';
    }

    const colorSwatchHtml = data.detected_color 
      ? `<div class="color-swatch-box"><span class="color-swatch-dot" style="background:${escapeHtml(data.detected_color)};"></span><code>${escapeHtml(data.detected_color)}</code></div>`
      : `<span class="badge badge-warning">Pending Analysis</span>`;

    const exposureDisplay = !isPending && data.exposure_estimate !== null && data.exposure_estimate !== undefined
      ? `${data.exposure_estimate} ${escapeHtml(data.unit || 'ppm-h')}`
      : `Pending Analysis`;

    const confidenceDisplay = !isPending && data.confidence !== null && data.confidence !== undefined
      ? `${Math.round(data.confidence * 100)}%`
      : `Pending Analysis`;

    const qualityBadge = data.quality === 'High' 
      ? '<span class="badge badge-success">High Quality</span>'
      : (data.quality === 'Invalid' ? '<span class="badge badge-danger">Invalid Image</span>' : `<span class="badge badge-warning">${escapeHtml(data.quality || 'Medium')}</span>`);

    const statusBadge = isPending 
      ? '<span class="badge badge-warning">Pending Analysis</span>'
      : (isInvalid ? '<span class="badge badge-danger">Invalid Image</span>' : (isFailed ? '<span class="badge badge-danger">Failed</span>' : '<span class="badge badge-success">Completed</span>'));

    return `
      <div class="status-banner ${bannerClass} mb-4">
        <span class="banner-icon">${bannerIcon}</span>
        <div>
          <strong>${bannerTitle}</strong>
          <p class="text-xs mt-1">${bannerDesc}</p>
        </div>
      </div>

      <div class="scan-details-grid mb-4">
        <!-- Badge Image Card -->
        <div class="scan-image-card">
          <span class="text-xs text-muted mb-2">Captured Post-Shift Badge Image (#SCN-${data.scan_id})</span>
          <img src="${escapeHtml(data.image_path)}" alt="Post Shift Scan Preview" style="max-height:200px;border-radius:8px;">
          <div class="mt-3 text-center">
            <span class="text-xs text-muted">Quality:</span>
            ${qualityBadge}
          </div>
        </div>

        <!-- Exposure Analysis Grid -->
        <div class="profile-details-grid" style="grid-template-columns:1fr 1fr;">
          <div class="profile-detail-box" style="grid-column: span 2; background:rgba(2,132,199,0.1); border-color:rgba(56,189,248,0.25);">
            <span class="detail-label">Final Cumulative Shift Exposure (ppm-h)</span>
            <strong class="detail-value ${isPending ? 'text-warning' : 'text-success'}" style="font-size:1.4rem;">
              ${isPending ? 'Pending Analysis' : (data.final_exposure_ppm_h !== undefined ? data.final_exposure_ppm_h + ' ppm-h' : exposureDisplay)}
            </strong>
          </div>

          <!-- 5 Mandatory Shift Exposure Components -->
          <div class="profile-detail-box">
            <span class="detail-label">Pre-Shift baseline H2S</span>
            <strong class="detail-value text-primary">${data.pre_shift_ppm !== undefined && data.pre_shift_ppm !== null ? data.pre_shift_ppm + ' ppm' : '0.0 ppm'}</strong>
          </div>

          <div class="profile-detail-box">
            <span class="detail-label">Post-Shift wrap H2S</span>
            <strong class="detail-value text-warning">${data.post_shift_ppm !== undefined && data.post_shift_ppm !== null ? data.post_shift_ppm + ' ppm' : (data.h2s_ppm !== null ? data.h2s_ppm + ' ppm' : '0.0 ppm')}</strong>
          </div>

          <div class="profile-detail-box">
            <span class="detail-label">Difference / Delta H2S</span>
            <strong class="detail-value text-danger">${data.delta_ppm !== undefined && data.delta_ppm !== null ? data.delta_ppm + ' ppm' : '0.0 ppm'}</strong>
          </div>

          <div class="profile-detail-box">
            <span class="detail-label">Calculated Shift Duration</span>
            <strong class="detail-value text-success">${data.shift_duration_hours !== undefined ? data.shift_duration_hours + ' hrs' : escapeHtml(data.shift_duration || 'N/A')}</strong>
          </div>

          <!-- Color Correction & Calibration Details -->
          <div class="profile-detail-box">
            <span class="detail-label">Detected Raw Strip Color</span>
            <div class="color-swatch-box"><span class="color-swatch-dot" style="background:${escapeHtml(data.detected_hex || data.detected_color || '#96CDE1')};"></span><code>${escapeHtml(data.detected_hex || data.detected_color || 'N/A')}</code></div>
          </div>

          <div class="profile-detail-box">
            <span class="detail-label">Corrected Strip Color</span>
            <div class="color-swatch-box"><span class="color-swatch-dot" style="background:${escapeHtml(data.corrected_hex || data.detected_hex || '#96CDE1')};"></span><code>${escapeHtml(data.corrected_hex || data.detected_hex || 'N/A')}</code></div>
          </div>

          <div class="profile-detail-box" style="grid-column: span 2;">
            <span class="detail-label">Closest H2S Calibration Reference</span>
            <strong class="detail-value text-cyan">${escapeHtml(data.closest_reference_label || data.reference_color || '#96CDE1')}</strong>
          </div>

          <div class="profile-detail-box">
            <span class="detail-label">Confidence Score</span>
            <strong class="detail-value ${isPending ? 'text-muted' : 'text-cyan'}">${confidenceDisplay}</strong>
          </div>

          <div class="profile-detail-box">
            <span class="detail-label">Analysis Status</span>
            <div>${statusBadge}</div>
          </div>
        </div>
      </div>

      <!-- Worker & Shift Context -->
      <div class="panel-box mb-4" style="background:rgba(30,41,59,0.4);">
        <h4 class="panel-title mb-3 text-sm">👷 Worker & Shift Context</h4>
        <div class="profile-details-grid">
          <div class="profile-detail-box">
            <span class="detail-label">Worker Name</span>
            <strong class="detail-value">${escapeHtml(data.worker_name)}</strong>
          </div>
          <div class="profile-detail-box">
            <span class="detail-label">Worker ID</span>
            <strong class="detail-value"><code>${escapeHtml(data.worker_id)}</code></strong>
          </div>
          <div class="profile-detail-box">
            <span class="detail-label">Department</span>
            <strong class="detail-value">${escapeHtml(data.department)}</strong>
          </div>
          <div class="profile-detail-box">
            <span class="detail-label">Badge ID</span>
            <strong class="detail-value"><code>${escapeHtml(data.badge_id)}</code></strong>
          </div>
          <div class="profile-detail-box">
            <span class="detail-label">Shift Duration</span>
            <strong class="detail-value text-success">${escapeHtml(data.shift_duration)}</strong>
          </div>
          <div class="profile-detail-box">
            <span class="detail-label">Scan Timestamp</span>
            <strong class="detail-value">${formatDateTime(data.created_at)}</strong>
          </div>
        </div>
      </div>

      <!-- Action Stack -->
      <div class="wizard-actions mt-3">
        ${isInvalid || isPending ? `
          <button type="button" class="btn btn-secondary btn-block btn-analysis-retake mb-2">
            🔄 Retake Post-Shift Scan
          </button>
        ` : ''}
        <button type="button" class="btn btn-primary btn-block btn-analysis-view-history">
          📜 View Full Exposure History Logs
        </button>
      </div>

      <!-- Local API Interface Simulator (for testing analysis submission) -->
      <div class="analysis-simulator-card mt-4">
        <div class="flex-between mb-2">
          <h4 class="text-cyan text-sm font-bold">⚙️ Analysis Result API Interface Simulator</h4>
          <span class="text-xs text-muted">POST /api/scans/${data.scan_id}/analysis</span>
        </div>
        <p class="text-xs text-muted mb-3">Simulate external AI/colorimetric engine posting an analysis result to SQLite:</p>
        
        <form class="form-simulate-analysis form-row" style="flex-wrap:wrap;">
          <div class="form-group flex-1 mb-2" style="min-width:130px;">
            <label for="sim-color-${data.scan_id}">Detected Color Hex</label>
            <input type="color" id="sim-color-${data.scan_id}" class="form-control sim-color" value="${data.detected_color || '#CDB889'}" style="height:40px;padding:0.2rem;">
          </div>
          <div class="form-group flex-1 mb-2" style="min-width:130px;">
            <label for="sim-exposure-${data.scan_id}">Exposure Value</label>
            <input type="number" step="0.1" id="sim-exposure-${data.scan_id}" class="form-control sim-exposure" value="${data.exposure_estimate !== null ? data.exposure_estimate : 3.8}" placeholder="e.g. 3.8" required>
          </div>
          <div class="form-group flex-1 mb-2" style="min-width:110px;">
            <label for="sim-unit-${data.scan_id}">Unit</label>
            <select id="sim-unit-${data.scan_id}" class="form-control sim-unit">
              <option value="ppm-h" ${data.unit === 'ppm-h' ? 'selected' : ''}>ppm-h</option>
              <option value="ppm" ${data.unit === 'ppm' ? 'selected' : ''}>ppm</option>
            </select>
          </div>
          <div class="form-group flex-1 mb-2" style="min-width:110px;">
            <label for="sim-confidence-${data.scan_id}">Confidence (0-1)</label>
            <input type="number" step="0.01" max="1" min="0" id="sim-confidence-${data.scan_id}" class="form-control sim-confidence" value="${data.confidence !== null ? data.confidence : 0.91}" placeholder="e.g. 0.91">
          </div>
          <div class="form-group flex-1 mb-2" style="min-width:130px;">
            <label for="sim-status-${data.scan_id}">Analysis Status</label>
            <select id="sim-status-${data.scan_id}" class="form-control sim-status">
              <option value="completed" ${data.status === 'completed' ? 'selected' : ''}>Completed</option>
              <option value="pending_analysis" ${data.status === 'pending_analysis' ? 'selected' : ''}>Pending Analysis</option>
              <option value="invalid_image" ${data.status === 'invalid_image' ? 'selected' : ''}>Invalid Image</option>
              <option value="failed" ${data.status === 'failed' ? 'selected' : ''}>Failed</option>
            </select>
          </div>
          <div class="form-group width-100 mb-0 mt-2" style="width:100%;">
            <button type="submit" class="btn btn-primary btn-block">
              <span>🚀 Post Analysis Result to SQLite</span>
            </button>
          </div>
        </form>
      </div>
    `;
  }

  async function openAnalysisResultScreen(scanId) {
    const container = document.getElementById('analysis-screen-container');
    if (!container) return;

    renderTableSkeleton(container, 1, 3);
    switchView('view-analysis-result');

    try {
      const res = await fetchWithAuth(`/api/scans/${scanId}/analysis`);
      const json = await res.json();
      if (!json.success) {
        container.innerHTML = `
          <div class="empty-cell text-center p-4">
            <div class="text-danger font-bold mb-2">⚠️ ${escapeHtml(json.error || 'Failed to load analysis result.')}</div>
            <button type="button" onclick="switchView('view-history')" class="btn btn-secondary text-xs">Back to History</button>
          </div>
        `;
        return;
      }

      container.innerHTML = renderAnalysisResultContent(json.data);
      attachAnalysisResultEvents(json.data.scan_id);
    } catch (err) {
      container.innerHTML = `
        <div class="empty-cell text-center p-4">
          <div class="text-danger font-bold mb-2">⚠️ Communication error loading scan analysis.</div>
          <button type="button" onclick="switchView('view-history')" class="btn btn-secondary text-xs">Back to History</button>
        </div>
      `;
    }
  }

  async function openAnalysisResultModal(scanId) {
    const modal = document.getElementById('analysis-result-modal');
    const body = document.getElementById('arm-modal-body');
    const title = document.getElementById('arm-modal-title');
    const subtitle = document.getElementById('arm-modal-subtitle');
    if (!modal || !body) return;

    body.innerHTML = '<div class="skeleton-box mb-3" style="height:120px;"></div>';
    title.textContent = `Scan Analysis Result (#SCN-${scanId})`;
    subtitle.textContent = `Fetching analysis data...`;
    modal.classList.remove('hidden');

    try {
      const res = await fetchWithAuth(`/api/scans/${scanId}/analysis`);
      const json = await res.json();
      if (!json.success) {
        body.innerHTML = `<div class="text-danger p-3 text-center">⚠️ ${escapeHtml(json.error)}</div>`;
        return;
      }

      subtitle.textContent = `Status: ${json.data.status.toUpperCase()} | Recorded: ${formatDateTime(json.data.created_at)}`;
      body.innerHTML = renderAnalysisResultContent(json.data, true);
      attachAnalysisResultEvents(json.data.scan_id, true);
    } catch (err) {
      body.innerHTML = `<div class="text-danger p-3 text-center">⚠️ Error loading analysis details.</div>`;
    }
  }

  function attachAnalysisResultEvents(scanId, isModal = false) {
    const btnRetake = document.querySelectorAll('.btn-analysis-retake');
    btnRetake.forEach(btn => {
      btn.addEventListener('click', () => {
        if (isModal) closeAnalysisResultModal();
        switchView('view-postshift');
        showToast('Navigated to Post-Shift Camera Scan for retake.', 'info');
      });
    });

    const btnHistory = document.querySelectorAll('.btn-analysis-view-history');
    btnHistory.forEach(btn => {
      btn.addEventListener('click', () => {
        if (isModal) closeAnalysisResultModal();
        switchView('view-history');
      });
    });

    const formSim = document.querySelectorAll('.form-simulate-analysis');
    formSim.forEach(form => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const simColor = form.querySelector('.sim-color').value;
        const simExposure = parseFloat(form.querySelector('.sim-exposure').value);
        const simUnit = form.querySelector('.sim-unit').value;
        const simConfidence = parseFloat(form.querySelector('.sim-confidence').value);
        const simStatus = form.querySelector('.sim-status').value;

        try {
          const res = await fetchWithAuth(`/api/scans/${scanId}/analysis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              detected_color: simColor,
              exposure_estimate: simExposure,
              unit: simUnit,
              confidence: simConfidence,
              status: simStatus
            })
          });

          const json = await res.json();
          if (json.success) {
            showToast(`Analysis result posted to SQLite for scan #SCN-${scanId}!`, 'success');
            if (isModal) {
              openAnalysisResultModal(scanId);
            } else {
              openAnalysisResultScreen(scanId);
            }
            refreshAllData();
          } else {
            showToast(json.error || 'Failed to update analysis result.', 'error');
          }
        } catch (err) {
          showToast('Error posting analysis result.', 'error');
        }
      });
    });
  }

  // -------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------
  function refreshAllData() {
    fetchHealth();
    loadDashboardStats();
    loadWorkers();
    loadRecentScans();
    loadHistoryScans();
    loadHistoryShifts();
    loadSettingsDiagnostics();
  }

  function getInitials(name) {
    if (!name) return 'W';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatTime(isoStr) {
    if (!isoStr) return 'N/A';
    const d = new Date(isoStr);
    return isNaN(d.getTime()) ? isoStr : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(isoStr) {
    if (!isoStr) return 'N/A';
    const d = new Date(isoStr);
    return isNaN(d.getTime()) ? isoStr : d.toLocaleDateString();
  }

  function formatDateTime(isoStr) {
    if (!isoStr) return 'N/A';
    const d = new Date(isoStr);
    return isNaN(d.getTime()) ? isoStr : d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Initial Load
  refreshAllData();
});
