// Popup script for LLMSec extension

let isConnected = false;
let isAttacking = false;
let currentAttackId = null;
let availableTargets = [];
let selectedTarget = null;

// Setup Collapsible Sections
document.querySelectorAll('.section-title.collapsible').forEach(header => {
  header.addEventListener('click', () => {
    header.classList.toggle('open');
    const content = header.nextElementSibling;
    if (content && content.classList.contains('section-content')) {
      content.classList.toggle('open');
    }
  });
});

// Tab Switching Logic
document.getElementById('tabTesting').addEventListener('click', () => {
  document.getElementById('tabTesting').classList.add('active');
  document.getElementById('tabSecurity').classList.remove('active');
  document.getElementById('contentTesting').style.display = 'block';
  document.getElementById('contentSecurity').style.display = 'none';
});

document.getElementById('tabSecurity').addEventListener('click', () => {
  document.getElementById('tabSecurity').classList.add('active');
  document.getElementById('tabTesting').classList.remove('active');
  document.getElementById('contentSecurity').style.display = 'block';
  document.getElementById('contentTesting').style.display = 'none';
});

// Connect to backend logic
async function handleConnect() {
  const backendUrl = document.getElementById('backendUrl').value;
  const apiKey = document.getElementById('apiKey').value;
  const indicatorEl = document.getElementById('connectionIndicator');

  if (!backendUrl || !apiKey) return;

  try {
    const response = await fetch(`${backendUrl}/api/v1/targets/`, { headers: { "X-API-Key": apiKey } });

    if (response.ok) {
      showStatus('connectionStatus', 'success', 'Connected to Backend!');
      indicatorEl.className = 'status-indicator status-connected';
      isConnected = true;

      document.getElementById('serverConfigHeader').classList.remove('open');
      document.getElementById('serverConfigContent').classList.remove('open');

      // Load initial data
      chrome.storage.local.get(['selectedTargetId'], (data) => {
        loadTargets(backendUrl, apiKey, data.selectedTargetId);
      });
    } else {
      throw new Error('Authentication failed');
    }
  } catch (error) {
    showStatus('connectionStatus', 'error', `Connection failed: ${error.message}`);
    isConnected = false;
  }
}

// Load saved settings
chrome.storage.local.get(['backendUrl', 'apiKey', 'inputSelector', 'buttonSelector', 'responseSelector', 'confirmButtonSelector', 'testSuiteSelector', 'useCaseSelector'], (data) => {
  // Server Config
  if (data.backendUrl) document.getElementById('backendUrl').value = data.backendUrl;
  if (data.apiKey) document.getElementById('apiKey').value = data.apiKey;

  if (data.backendUrl && data.apiKey) {
    // Auto-connect
    document.getElementById('connectBtn').click();
  } else {
    document.getElementById('serverConfigHeader').classList.add('open');
    document.getElementById('serverConfigContent').classList.add('open');
  }

  // Target Detection
  if (data.inputSelector && data.buttonSelector) {
    document.getElementById('inputSelector').value = data.inputSelector;
    document.getElementById('buttonSelector').value = data.buttonSelector;
    if (data.responseSelector) document.getElementById('responseSelector').value = data.responseSelector;
    if (data.confirmButtonSelector) document.getElementById('confirmButtonSelector').value = data.confirmButtonSelector;
  } else {
    document.getElementById('targetDetectHeader').classList.add('open');
    document.getElementById('targetDetectContent').classList.add('open');
  }
});

// Save settings on input change
['backendUrl', 'apiKey', 'inputSelector', 'buttonSelector', 'responseSelector', 'confirmButtonSelector', 'testSuiteSelector', 'useCaseSelector'].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('change', (e) => {
      chrome.storage.local.set({ [id]: e.target.value });
    });
    el.addEventListener('input', (e) => {
      chrome.storage.local.set({ [id]: e.target.value });
    });
  }
});

// Load targets from backend
async function loadTargets(backendUrl, apiKey, selectedTargetId = null) {
  try {
    const response = await fetch(`${backendUrl}/api/v1/targets/`, { headers: { "X-API-Key": apiKey } });
    if (response.ok) {
      availableTargets = await response.json();
      const selector = document.getElementById('targetSelector');

      // Clear existing options except the first one
      selector.innerHTML = '<option value="">-- Create New Target --</option>';

      // Add targets
      availableTargets.forEach(target => {
        const option = document.createElement('option');
        option.value = target.id;
        option.textContent = target.name;
        selector.appendChild(option);
      });

      // Select the previously selected target
      if (selectedTargetId) {
        // Wait a small tick for the DOM to update options
        setTimeout(() => {
          selector.value = selectedTargetId;
          handleTargetSelection();
        }, 50);
      }

      // Also fetch Active LLM Model for display
      await loadActiveModel(backendUrl, apiKey);
    } else {
      throw new Error(`Server returned HTTP ${response.status}`);
    }
  } catch (error) {
    console.error('Failed to load targets:', error);
  }
}

async function loadActiveModel(backendUrl, apiKey) {
  try {
    const res = await fetch(`${backendUrl}/api/v1/organizations/`, { headers: { "X-API-Key": apiKey } });
    if (res.ok) {
      const orgs = await res.json();
      if (orgs && orgs.length > 0) {
        const org = orgs[0]; // Assuming user operates within their primary auth'd organization
        const activeModel = org.llm_models?.find(m => m.is_active);

        const container = document.getElementById('activeModelContainer');
        if (activeModel) {
          container.style.display = 'block';
          document.getElementById('activeModelName').textContent = activeModel.model_name;
          document.getElementById('activeModelProvider').textContent = activeModel.provider;
        } else {
          container.style.display = 'none';
        }
      }
    } else {
      throw new Error(`Server returned HTTP ${res.status}`);
    }
  } catch (err) {
    console.error("Failed to load active model for extension:", err);
  }
}

// Handle target selection
function handleTargetSelection() {
  const selector = document.getElementById('targetSelector');
  const selectedId = selector.value;

  if (selectedId === '') {
    // Create new target mode
    document.getElementById('newTargetForm').style.display = 'block';
    document.getElementById('selectedTargetInfo').style.display = 'none';
    document.getElementById('noTargetMsg').style.display = 'block';
    document.getElementById('loadTestCasesBtn').style.display = 'none';
    document.getElementById('testCasesContainer').style.display = 'none';
    selectedTarget = null;
  } else {
    // Existing target selected
    document.getElementById('newTargetForm').style.display = 'none';
    document.getElementById('selectedTargetInfo').style.display = 'block';

    selectedTarget = availableTargets.find(t => t.id === selectedId);
    if (selectedTarget) {
      document.getElementById('selectedTargetName').textContent = selectedTarget.name;
      const contextText = selectedTarget.context ? selectedTarget.context : selectedTarget.description;
      document.getElementById('selectedTargetContext').textContent = contextText;

      document.getElementById('noTargetMsg').style.display = 'none';
      document.getElementById('loadTestCasesBtn').style.display = 'block';
      document.getElementById('testCasesContainer').style.display = 'block';

      // Load Test Suites first, which will then trigger loadFunctionalTests
      loadTestSuites();

      // Save selection
      chrome.storage.local.set({ selectedTargetId: selectedId });
    }
  }
}

// Load test suites
let availableTestSuites = [];

async function loadTestSuites() {
  if (!selectedTarget) return;
  const backendUrl = document.getElementById('backendUrl').value;
  const apiKey = document.getElementById('apiKey').value;
  const tsSelector = document.getElementById('testSuiteSelector');
  const tsContainer = document.getElementById('testSuiteFilterContainer');

  try {
    tsContainer.style.display = 'block';
    const res = await fetch(`${backendUrl}/api/v1/testing/suites/${selectedTarget.id}`, { headers: { "X-API-Key": apiKey } });
    if (res.ok) {
      const suites = await res.json();
      availableTestSuites = suites || [];
      tsSelector.innerHTML = '<option value="">Global (All Executions)</option>';
      suites.forEach(s => {
        const option = document.createElement('option');
        option.value = s.id;
        option.textContent = s.name;
        tsSelector.appendChild(option);
      });

      // Restore previous valid selection
      chrome.storage.local.get(['testSuiteSelector'], (data) => {
        if (data.testSuiteSelector && Array.from(tsSelector.options).some(o => o.value === data.testSuiteSelector)) {
          tsSelector.value = data.testSuiteSelector;
        }

        // Now that Test Suite dropdown is ready, proceed to load use cases bounded by its project_id
        loadFunctionalTests(tsSelector.value);
      });
    } else {
      throw new Error(`Server returned HTTP ${res.status}`);
    }
  } catch (error) {
    console.error('Failed to load test suites:', error);
  }
}

// Target selector change handler
document.getElementById('targetSelector').addEventListener('change', handleTargetSelection);

// Test suite selector change handler
document.getElementById('testSuiteSelector').addEventListener('change', (e) => {
  const selectedSuiteId = e.target.value;
  chrome.storage.local.set({ testSuiteSelector: selectedSuiteId });
  loadFunctionalTests(selectedSuiteId);
});

// Create new target
document.getElementById('createTargetBtn').addEventListener('click', async () => {
  const backendUrl = document.getElementById('backendUrl').value;
  const apiKey = document.getElementById('apiKey').value;
  const targetName = document.getElementById('targetName').value;
  const targetUrl = document.getElementById('targetUrl').value;

  if (!targetName) {
    showStatus('connectionStatus', 'error', 'Please enter a target name');
    return;
  }

  if (!isConnected) {
    showStatus('connectionStatus', 'error', 'Please connect to backend first');
    return;
  }

  try {
    // Get current tab URL if not provided
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = targetUrl || tab.url;

    const response = await fetch(`${backendUrl}/api/v1/targets/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        name: targetName,
        description: `Browser-based target: ${targetName}`,
        purpose: 'Security testing via Chrome extension',
        context: '',
        target_type: 'web_browser',
        url: url
      })
    });

    if (response.ok) {
      const newTarget = await response.json();
      showStatus('connectionStatus', 'success', 'Target created successfully!');

      // Reload targets and select the new one
      await loadTargets(backendUrl, newTarget.id);

      // Clear form
      document.getElementById('targetName').value = '';
      document.getElementById('targetUrl').value = '';
    } else {
      throw new Error('Failed to create target');
    }
  } catch (error) {
    showStatus('connectionStatus', 'error', `Failed to create target: ${error.message}`);
  }
});

// Connect to backend
document.getElementById('connectBtn').addEventListener('click', async () => {
  const backendUrl = document.getElementById('backendUrl').value;
  const apiKey = document.getElementById('apiKey').value;
  const statusEl = document.getElementById('connectionStatus');
  const indicatorEl = document.getElementById('connectionIndicator');

  try {
    // Validate by attempting to fetch targets which requires authentication
    const response = await fetch(`${backendUrl}/api/v1/targets/`, { headers: { "X-API-Key": apiKey } });

    if (response.ok) {
      isConnected = true;
      chrome.storage.local.set({ backendUrl, apiKey });
      statusEl.className = 'status success';
      statusEl.textContent = 'Authenticated and connected!';
      indicatorEl.className = 'connection-indicator connected';
      document.getElementById('startAttack').disabled = false;

      // Load available targets
      await loadTargets(backendUrl, apiKey);
    } else if (response.status === 401 || response.status === 403) {
      throw new Error('Invalid or missing API Key');
    } else {
      throw new Error(`Server returned status ${response.status}`);
    }
  } catch (error) {
    isConnected = false;
    statusEl.className = 'status error';
    statusEl.textContent = `Connection failed: ${error.message}`;
    indicatorEl.className = 'connection-indicator disconnected';
  }
});

// Auto-detect chat interface
document.getElementById('detectBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.tabs.sendMessage(tab.id, { action: 'detectChatInterface' }, (response) => {
    if (chrome.runtime.lastError) {
      showStatus('detectionStatus', 'error', 'Please refresh the target web page first!');
      return;
    }
    if (response && response.success) {
      document.getElementById('inputSelector').value = response.inputSelector;
      document.getElementById('buttonSelector').value = response.buttonSelector;

      chrome.storage.local.set({
        inputSelector: response.inputSelector,
        buttonSelector: response.buttonSelector
      });

      showStatus('detectionStatus', 'success', 'Chat interface detected!');
    } else {
      showStatus('detectionStatus', 'error', response?.message || 'Could not detect chat interface automatically');
    }
  });
});

// Test selectors
document.getElementById('testSelectors').addEventListener('click', async () => {
  const inputSelector = document.getElementById('inputSelector').value;
  const buttonSelector = document.getElementById('buttonSelector').value;

  if (!inputSelector || !buttonSelector) {
    showStatus('detectionStatus', 'error', 'Please provide both selectors');
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.tabs.sendMessage(tab.id, {
    action: 'testSelectors',
    inputSelector,
    buttonSelector
  }, (response) => {
    if (chrome.runtime.lastError) {
      showStatus('detectionStatus', 'error', 'Please refresh the target web page first!');
      return;
    }
    if (response && response.success) {
      showStatus('detectionStatus', 'success', 'Selectors work! Input field will flash.');
    } else {
      showStatus('detectionStatus', 'error', response?.message || 'Selectors not found on page');
    }
  });
});

// Start attack
document.getElementById('startAttack').addEventListener('click', async () => {
  if (!isConnected) {
    showStatus('attackStatus', 'error', 'Please connect to backend first');
    return;
  }

  // Check if target is selected
  if (!selectedTarget) {
    showStatus('attackStatus', 'error', 'Please select or create a target first');
    return;
  }

  const inputSelector = document.getElementById('inputSelector').value;
  const buttonSelector = document.getElementById('buttonSelector').value;
  const responseSelector = document.getElementById('responseSelector').value;

  if (!inputSelector || !buttonSelector) {
    showStatus('attackStatus', 'error', 'Please configure target selectors');
    return;
  }

  const attackType = document.getElementById('attackType').value;
  const attackMode = document.getElementById('attackMode').value;
  const targetBehavior = document.getElementById('targetBehavior').value;

  isAttacking = true;
  document.getElementById('startAttack').style.display = 'none';
  document.getElementById('stopAttack').style.display = 'block';

  showStatus('attackStatus', 'info', 'Starting attack...');

  // Save selectors
  chrome.storage.local.set({ inputSelector, buttonSelector, responseSelector });

  // Get current tab info
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Start attack via background script with target info
  chrome.runtime.sendMessage({
    action: 'startAttack',
    config: {
      tabId: tab.id,
      targetId: selectedTarget.id,
      targetName: selectedTarget.name,
      targetContext: selectedTarget.context || selectedTarget.description,
      inputSelector,
      buttonSelector,
      responseSelector,
      attackType,
      attackMode,
      targetBehavior,
      backendUrl: document.getElementById('backendUrl').value
    }
  }, (response) => {
    if (response && response.success) {
      currentAttackId = response.attackId;
      showStatus('attackStatus', 'success', `Attack started (ID: ${currentAttackId})`);
      addAttackToHistory(attackType, attackMode, 'running');
    } else {
      showStatus('attackStatus', 'error', 'Failed to start attack');
      resetAttackButtons();
    }
  });
});

// Stop attack
document.getElementById('stopAttack').addEventListener('click', () => {
  chrome.runtime.sendMessage({
    action: 'stopAttack',
    attackId: currentAttackId
  });

  resetAttackButtons();
  showStatus('attackStatus', 'info', 'Attack stopped');
});

// Listen for attack updates
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'attackProgress') {
    showStatus('attackStatus', 'info', `Turn ${message.turn}: ${message.status}`);
  } else if (message.type === 'attackComplete') {
    resetAttackButtons();
    const result = message.success ? 'Vulnerability found!' : 'No vulnerability detected';
    showStatus('attackStatus', message.success ? 'error' : 'success', result);
    updateAttackHistory(currentAttackId, message.success ? 'vulnerable' : 'passed');
  }
});

// Helper functions
function showStatus(elementId, type, message) {
  const statusEl = document.getElementById(elementId);
  statusEl.className = `status ${type}`;
  statusEl.textContent = message;
}

function resetAttackButtons() {
  isAttacking = false;
  document.getElementById('startAttack').style.display = 'block';
  document.getElementById('stopAttack').style.display = 'none';
}

// -------------------------------------------------------------------
// Functional Testing Logic
// -------------------------------------------------------------------
let pendingTestCases = [];
let allLoadedUseCases = [];

async function loadFunctionalTests(suiteId = null) {
  if (!selectedTarget) return;
  const backendUrl = document.getElementById('backendUrl').value;
  const apiKey = document.getElementById('apiKey').value;
  const container = document.getElementById('testCasesContainer');
  const ucFilterContainer = document.getElementById('useCaseFilterContainer');
  const ucSelector = document.getElementById('useCaseSelector');

  container.innerHTML = '<div style="text-align: center; color: var(--text-muted); font-size: 13px; padding: 20px;">Fetching test plans...</div>';
  ucFilterContainer.style.display = 'block';

  // Calculate URL to filter by project_id
  let fetchUrl = `${backendUrl}/api/v1/testing/usecases/${selectedTarget.id}`;
  if (suiteId) {
    const suite = availableTestSuites.find(s => String(s.id) === String(suiteId));
    if (suite && suite.project_id) {
      fetchUrl += `?project_id=${suite.project_id}`;
    }
  }

  try {
    const ucRes = await fetch(fetchUrl, { headers: { "X-API-Key": apiKey } });
    if (!ucRes.ok) throw new Error('Failed to load use cases');
    allLoadedUseCases = await ucRes.json();

    // Populate Dropdown
    ucSelector.innerHTML = '<option value="all">-- All Use Cases --</option>';
    allLoadedUseCases.forEach(uc => {
      const opt = document.createElement('option');
      opt.value = uc.id;
      opt.textContent = uc.name;
      ucSelector.appendChild(opt);
    });

    chrome.storage.local.get(['useCaseSelector'], (data) => {
      if (data.useCaseSelector && Array.from(ucSelector.options).some(o => o.value === data.useCaseSelector)) {
        ucSelector.value = data.useCaseSelector;
        renderTestCases(data.useCaseSelector);
      } else {
        renderTestCases('all');
      }

      // Add event listener for tracking manual changes
      ucSelector.onchange = (e) => {
        chrome.storage.local.set({ useCaseSelector: e.target.value });
        renderTestCases(e.target.value);
      };
    });

  } catch (err) {
    container.innerHTML = `<div style="color: var(--neon-red); font-size: 13px; padding: 10px;">Error: ${err.message}</div>`;
  }
}

async function renderTestCases(filterUcId) {
  const backendUrl = document.getElementById('backendUrl').value;
  const apiKey = document.getElementById('apiKey').value;
  const container = document.getElementById('testCasesContainer');
  container.innerHTML = '';
  pendingTestCases = [];

  const useCasesToRender = filterUcId === 'all'
    ? allLoadedUseCases
    : allLoadedUseCases.filter(uc => String(uc.id) === String(filterUcId));

  if (useCasesToRender.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: var(--text-muted); font-size: 13px; padding: 20px;">No use cases found.</div>';
    return;
  }

  // Global Run Selected toolbar (shown above all UCs)
  const globalToolbar = document.createElement('div');
  globalToolbar.id = 'global-selection-toolbar';
  globalToolbar.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 8px 4px; margin-bottom: 8px; border-bottom: 2px solid var(--border-card);';
  globalToolbar.innerHTML = `
    <span id="selection-count-label" style="font-size: 12px; color: var(--text-muted);">0 selected</span>
    <button id="run-selected-global-btn" class="btn-primary" style="font-size: 11px; padding: 5px 12px; background: var(--neon-mantis); color: var(--surface-dark); border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">▶ Run Selected</button>
  `;
  container.appendChild(globalToolbar);
  document.getElementById('run-selected-global-btn').addEventListener('click', () => window.runSelectedTests());

  function updateSelectionCount() {
    const total = container.querySelectorAll('.tc-checkbox:checked').length;
    document.getElementById('selection-count-label').textContent = `${total} selected`;
  }

  for (const uc of useCasesToRender) {
    try {
      const tcRes = await fetch(`${backendUrl}/api/v1/testing/testcases/${uc.id}`, { headers: { "X-API-Key": apiKey } });
      if (!tcRes.ok) throw new Error(`HTTP ${tcRes.status} loading test cases.`);
      const testCases = await tcRes.json();

      if (testCases.length > 0) {
        // Use Case Header Row
        const ucTitle = document.createElement('div');
        ucTitle.className = 'uc-header';
        ucTitle.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 8px 4px; margin-top: 16px; border-bottom: 1px solid var(--border-card); gap: 8px;';

        ucTitle.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
            <input type="checkbox" class="uc-select-all" title="Select all in this group" style="cursor: pointer; accent-color: var(--neon-mantis); width: 14px; height: 14px; flex-shrink: 0;" data-uc-id="${uc.id}">
            <div style="font-weight: 600; color: var(--text-primary); font-size: 14px;">${uc.name}</div>
          </div>
          <div style="display: flex; gap: 6px; flex-shrink: 0;">
            <button class="btn-secondary run-selected-uc-btn" style="font-size: 11px; padding: 4px 10px;">Run Selected</button>
            <button class="btn-secondary run-all-btn" style="font-size: 11px; padding: 4px 10px;">Run All</button>
          </div>
        `;
        container.appendChild(ucTitle);

        const runAllBtn = ucTitle.querySelector('.run-all-btn');
        runAllBtn.addEventListener('click', () => window.runAllTests(uc.id));

        const runSelectedUcBtn = ucTitle.querySelector('.run-selected-uc-btn');
        runSelectedUcBtn.addEventListener('click', () => window.runSelectedTests(uc.id));

        const selectAllCb = ucTitle.querySelector('.uc-select-all');
        selectAllCb.addEventListener('change', (e) => {
          const checkboxes = container.querySelectorAll(`.tc-checkbox[data-uc-id="${uc.id}"]`);
          checkboxes.forEach(cb => cb.checked = e.target.checked);
          updateSelectionCount();
        });

        // Test Case Items
        testCases.forEach(tc => {
          tc.use_case_id = uc.id;
          pendingTestCases.push(tc);

          const tcItem = document.createElement('div');
          tcItem.className = 'attack-item';
          tcItem.id = `tc-${tc.id}`;
          tcItem.style.cssText = 'background: transparent; border: none; border-bottom: 1px solid var(--border-hover); border-radius: 0; padding: 12px 4px; margin: 0; display: flex; flex-direction: row; align-items: center; gap: 12px;';

          tcItem.innerHTML = `
            <input type="checkbox" class="tc-checkbox" data-tc-id="${tc.id}" data-uc-id="${uc.id}" style="cursor: pointer; accent-color: var(--neon-mantis); width: 14px; height: 14px; flex-shrink: 0;">
            <div style="flex: 1 1 auto; padding-right: 12px;">
              <div style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 4px;">
                <div style="font-weight: 500; font-size: 13px; color: var(--text-primary); white-space: normal; overflow-wrap: break-word; word-break: normal;">${tc.name}</div>
                <span class="tc-status-badge" style="background: var(--surface-elevated); color: var(--text-secondary); font-size: 10px; padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-card); flex-shrink: 0; margin-top: 2px;">Pending</span>
              </div>
              <div style="color: var(--text-muted); font-size: 11px; white-space: normal; overflow-wrap: break-word; word-break: normal;">${tc.input_prompt}</div>
              <div class="tc-status" style="margin-top: 6px; font-weight: 500; font-size: 11px; display: none;"></div>
            </div>
            <button class="btn-secondary run-tc-btn" style="flex: 0 0 auto; width: 80px; margin-top: 0; padding: 6px 16px; background: var(--text-primary); color: var(--surface-dark); border: none; align-self: center;">Run</button>
          `;
          container.appendChild(tcItem);

          // Update global count when individual checkbox changes
          tcItem.querySelector('.tc-checkbox').addEventListener('change', () => {
            updateSelectionCount();
            // Update UC-level select-all checkbox state
            const allUcCbs = container.querySelectorAll(`.tc-checkbox[data-uc-id="${uc.id}"]`);
            const allChecked = Array.from(allUcCbs).every(cb => cb.checked);
            selectAllCb.checked = allChecked;
            selectAllCb.indeterminate = !allChecked && Array.from(allUcCbs).some(cb => cb.checked);
          });

          const runTcBtn = tcItem.querySelector('.run-tc-btn');
          runTcBtn.addEventListener('click', function () {
            if (this.textContent === 'Stop') {
              chrome.runtime.sendMessage({ action: 'stopFunctionalTest', testId: tc.id }, () => {
                this.textContent = 'Run';
                this.style.background = 'var(--text-primary)';
                this.disabled = false;
                this.style.opacity = '1';
                const statusEl = document.getElementById(`tc-${tc.id}`).querySelector('.tc-status');
                const badgeEl = document.getElementById(`tc-${tc.id}`).querySelector('.tc-status-badge');
                if (statusEl) {
                  statusEl.textContent = 'Manually stopped.';
                  statusEl.style.color = 'var(--neon-red)';
                }
                if (badgeEl) {
                  badgeEl.textContent = 'Stopped';
                  badgeEl.style.background = 'var(--neon-red)';
                  badgeEl.style.color = 'var(--surface-dark)';
                  badgeEl.style.borderColor = 'transparent';
                }
              });
            } else {
              window.runFunctionalTest(tc.id, this);
            }
          });
        });
      }
    } catch (e) {
      console.error('Error loading TCs for UC', uc.id, e);
    }
  }

  if (pendingTestCases.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: var(--text-muted); font-size: 13px; padding: 20px;">No test cases found.</div>';
  }

  // Sync with background to see if any are currently running
  syncActiveTests();
  if (!window.syncInterval) {
    window.syncInterval = setInterval(syncActiveTests, 2000);
  }
}

function syncActiveTests() {
  chrome.runtime.sendMessage({ action: 'getActiveTests' }, (response) => {
    if (response && response.activeTcIds) {
      response.activeTcIds.forEach(tcId => {
        const el = document.getElementById(`tc-${tcId}`);
        if (el) {
          const statusEl = el.querySelector('.tc-status');
          const badgeEl = el.querySelector('.tc-status-badge');
          const btn = el.querySelector('.run-tc-btn');

          if (btn) {
            btn.textContent = 'Stop';
            btn.style.background = 'var(--neon-red)';
            btn.disabled = false;
            btn.style.opacity = '1';
          }

          if (statusEl && badgeEl) {
            statusEl.style.display = 'block';
            statusEl.style.color = 'var(--neon-amber)';
            statusEl.textContent = 'Running in background...';

            badgeEl.textContent = 'Running...';
            badgeEl.style.background = 'var(--neon-amber)';
            badgeEl.style.color = 'var(--surface-dark)';
            badgeEl.style.borderColor = 'transparent';
          }
        }
      });
    }
  });
}

// Event Listeners
document.getElementById('loadTestCasesBtn').addEventListener('click', loadFunctionalTests);
document.getElementById('useCaseSelector').addEventListener('change', (e) => {
  renderTestCases(e.target.value);
});

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function injectPrompt(tabId, prompt, config) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { action: 'injectPrompt', prompt, inputSelector: config.inputSelector, buttonSelector: config.buttonSelector }, response => {
      if (response && response.success) resolve(response);
      else reject(new Error(response?.message || 'Injection failed'));
    });
  });
}

async function getResponse(tabId, responseSelector, buttonSelector) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { action: 'getResponse', responseSelector, buttonSelector }, response => {
      resolve(response || { success: false, message: 'No response' });
    });
  });
}

window.runAllTests = async function (ucId) {
  const tcs = pendingTestCases.filter(t => t.use_case_id === ucId);
  if (tcs.length === 0) return;

  const backendUrl = document.getElementById('backendUrl').value;
  const apiKey = document.getElementById('apiKey').value;
  const inputSelector = document.getElementById('inputSelector').value;
  const buttonSelector = document.getElementById('buttonSelector').value;
  const responseSelector = document.getElementById('responseSelector').value;
  const testSuiteId = document.getElementById('testSuiteSelector').value;
  const confirmButtonSelector = document.getElementById('confirmButtonSelector').value;

  if (!inputSelector || !buttonSelector) {
    alert("Please set up the target selectors first in Target Detection!");
    return;
  }

  const allBtns = document.querySelectorAll('.run-tc-btn, .run-all-btn');
  allBtns.forEach(btn => btn.disabled = true);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Set UI to loading state for all in batch
    for (const tc of tcs) {
      const statusEl = document.getElementById(`tc-${tc.id}`).querySelector('.tc-status');
      const badgeEl = document.getElementById(`tc-${tc.id}`).querySelector('.tc-status-badge');
      statusEl.style.display = 'block';
      statusEl.style.color = 'var(--text-secondary)';
      statusEl.textContent = 'Queued...';
      badgeEl.textContent = 'Pending';
      badgeEl.style.background = 'transparent';
      badgeEl.style.color = 'var(--text-secondary)';
    }

    const config = {
      tabId: tab.id,
      testCases: tcs,
      backendUrl, apiKey, inputSelector, buttonSelector, responseSelector,
      testSuiteId, confirmButtonSelector
    };

    chrome.runtime.sendMessage({ action: 'startAllFunctionalTests', config }, (response) => {
      if (!response || !response.success) {
        allBtns.forEach(btn => btn.disabled = false);
        alert("Failed to start batch tests: " + (response?.error || 'Unknown error'));
      }
    });
  } catch (e) {
    allBtns.forEach(btn => btn.disabled = false);
    alert(e.message);
  }
};

window.runSelectedTests = async function (filterUcId = null) {
  const container = document.getElementById('testCasesContainer');
  let checkedBoxes = Array.from(container.querySelectorAll('.tc-checkbox:checked'));

  if (filterUcId) {
    checkedBoxes = checkedBoxes.filter(cb => cb.dataset.ucId === String(filterUcId));
  }

  if (checkedBoxes.length === 0) {
    alert('No test cases selected. Please check one or more test cases to run.');
    return;
  }

  const selectedIds = checkedBoxes.map(cb => cb.dataset.tcId);
  const tcs = pendingTestCases.filter(t => selectedIds.includes(String(t.id)));
  if (tcs.length === 0) return;

  const backendUrl = document.getElementById('backendUrl').value;
  const apiKey = document.getElementById('apiKey').value;
  const inputSelector = document.getElementById('inputSelector').value;
  const buttonSelector = document.getElementById('buttonSelector').value;
  const responseSelector = document.getElementById('responseSelector').value;
  const testSuiteId = document.getElementById('testSuiteSelector').value;
  const confirmButtonSelector = document.getElementById('confirmButtonSelector').value;

  if (!inputSelector || !buttonSelector) {
    alert('Please set up the target selectors first in Target Detection!');
    return;
  }

  const allBtns = document.querySelectorAll('.run-tc-btn, .run-all-btn, .run-selected-uc-btn');
  allBtns.forEach(btn => btn.disabled = true);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    for (const tc of tcs) {
      const statusEl = document.getElementById(`tc-${tc.id}`)?.querySelector('.tc-status');
      const badgeEl = document.getElementById(`tc-${tc.id}`)?.querySelector('.tc-status-badge');
      if (statusEl) { statusEl.style.display = 'block'; statusEl.style.color = 'var(--text-secondary)'; statusEl.textContent = 'Queued...'; }
      if (badgeEl) { badgeEl.textContent = 'Pending'; badgeEl.style.background = 'transparent'; badgeEl.style.color = 'var(--text-secondary)'; }
    }

    const config = {
      tabId: tab.id,
      testCases: tcs,
      backendUrl, apiKey, inputSelector, buttonSelector, responseSelector,
      testSuiteId, confirmButtonSelector
    };

    chrome.runtime.sendMessage({ action: 'startAllFunctionalTests', config }, (response) => {
      if (!response || !response.success) {
        allBtns.forEach(btn => btn.disabled = false);
        alert('Failed to start selected tests: ' + (response?.error || 'Unknown error'));
      }
    });
  } catch (e) {
    allBtns.forEach(btn => btn.disabled = false);
    alert(e.message);
  }
};

window.runFunctionalTest = async function (tcId, btnElement, isBatch = false) {
  const tc = pendingTestCases.find(t => t.id === tcId);
  if (!tc) return;

  const backendUrl = document.getElementById('backendUrl').value;
  const apiKey = document.getElementById('apiKey').value;
  const inputSelector = document.getElementById('inputSelector').value;
  const buttonSelector = document.getElementById('buttonSelector').value;
  const responseSelector = document.getElementById('responseSelector').value;
  const testSuiteId = document.getElementById('testSuiteSelector').value;
  const confirmButtonSelector = document.getElementById('confirmButtonSelector').value;

  if (!inputSelector || !buttonSelector) {
    alert("Please set up the target selectors first in Target Detection!");
    return;
  }

  if (!isBatch) {
    document.querySelectorAll('.run-tc-btn, .run-all-btn').forEach(btn => btn.disabled = true);
  }

  const statusEl = document.getElementById(`tc-${tcId}`).querySelector('.tc-status');
  const badgeEl = document.getElementById(`tc-${tcId}`).querySelector('.tc-status-badge');

  btnElement.textContent = 'Stop';
  btnElement.style.background = 'var(--neon-red)';
  btnElement.disabled = false;
  btnElement.style.opacity = '1';

  statusEl.style.display = 'block';
  statusEl.style.color = 'var(--neon-amber)';
  statusEl.textContent = 'Offloaded sequence to Background Script...';

  badgeEl.textContent = 'Running...';
  badgeEl.style.background = 'var(--neon-amber)';
  badgeEl.style.color = 'var(--surface-dark)';
  badgeEl.style.borderColor = 'transparent';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const config = {
      tabId: tab.id,
      tc, backendUrl, apiKey, inputSelector, buttonSelector, responseSelector,
      testSuiteId, confirmButtonSelector
    };

    chrome.runtime.sendMessage({ action: 'startFunctionalTest', config }, (response) => {
      if (!response || !response.success) {
        if (!isBatch) {
          document.querySelectorAll('.run-tc-btn, .run-all-btn').forEach(btn => {
            if (btn !== btnElement) {
              btn.disabled = false;
            }
          });
        }
        btnElement.textContent = 'Run';
        btnElement.style.background = 'var(--text-primary)';
        btnElement.disabled = false;
        btnElement.style.opacity = '1';
        statusEl.textContent = 'Failed to start gracefully.';
        badgeEl.textContent = 'Error';
        badgeEl.style.background = 'var(--neon-red)';
      } else if (isBatch) {
        // Successfully started batch, Stop button handling will be managed by progress events
      }
    });

  } catch (e) {
    statusEl.style.color = 'var(--neon-red)';
    statusEl.textContent = `Error: ${e.message}`;
    badgeEl.textContent = 'Error';
    badgeEl.style.background = 'var(--surface-elevated)';
    badgeEl.style.color = 'var(--text-secondary)';
    if (!isBatch) {
      document.querySelectorAll('.run-tc-btn, .run-all-btn').forEach(btn => btn.disabled = false);
    }
  }
};

// Listen for completion events from background script to update UI if popup is open
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'functionalTestComplete') {
    const { tcId, score } = msg;
    const isPass = score >= 0.8;
    const isWarn = score >= 0.5;

    const el = document.getElementById(`tc-${tcId}`);
    if (el) {
      const statusEl = el.querySelector('.tc-status');
      const badgeEl = el.querySelector('.tc-status-badge');

      statusEl.style.color = isPass ? 'var(--neon-mantis)' : (isWarn ? 'var(--neon-amber)' : 'var(--neon-red)');
      statusEl.textContent = `Score: ${(score * 100).toFixed(0)}%`;

      badgeEl.textContent = isPass ? 'Passed' : 'Failed';
      badgeEl.style.background = isPass ? 'var(--neon-mantis)' : 'var(--neon-red)';
      badgeEl.style.color = 'var(--surface-dark)';

      const btn = el.querySelector('.run-tc-btn');
      if (btn) {
        btn.textContent = 'Run';
        btn.style.background = 'var(--text-primary)';
        btn.disabled = false;
        btn.style.opacity = '1';
      }
    }
    document.querySelectorAll('.run-tc-btn').forEach(btn => {
      if (btn.textContent !== 'Stop') {
        btn.disabled = false;
      }
    });
    document.querySelectorAll('.run-all-btn').forEach(btn => btn.disabled = false);
  }

  if (msg.type === 'functionalTestError') {
    const { tcId, error } = msg;
    const el = document.getElementById(`tc-${tcId}`);
    if (el) {
      const statusEl = el.querySelector('.tc-status');
      const badgeEl = el.querySelector('.tc-status-badge');

      statusEl.style.color = 'var(--neon-red)';
      statusEl.textContent = `Error: ${error}`;
      badgeEl.textContent = 'Error';
      badgeEl.style.background = 'var(--surface-elevated)';
      badgeEl.style.color = 'var(--text-secondary)';

      const btn = el.querySelector('.run-tc-btn');
      if (btn) {
        btn.textContent = 'Run';
        btn.style.background = 'var(--text-primary)';
        btn.disabled = false;
        btn.style.opacity = '1';
      }
    }
    document.querySelectorAll('.run-tc-btn').forEach(btn => {
      if (btn.textContent !== 'Stop') {
        btn.disabled = false;
      }
    });
    document.querySelectorAll('.run-all-btn').forEach(btn => btn.disabled = false);
  }

  if (msg.type === 'functionalTestProgress') {
    const { tcId, text, statusType } = msg;
    const el = document.getElementById(`tc-${tcId}`);

    // Only update if it's currently marked as running
    if (el) {
      const statusEl = el.querySelector('.tc-status');
      const badgeEl = el.querySelector('.tc-status-badge');
      const btn = el.querySelector('.run-tc-btn');

      if (statusEl) {
        statusEl.style.display = 'block';

        if (statusType === 'success') statusEl.style.color = 'var(--neon-mantis)';
        else if (statusType === 'error') statusEl.style.color = 'var(--neon-red)';
        else if (statusType === 'warn') {
          statusEl.style.color = 'var(--neon-amber)';
          if (badgeEl && badgeEl.textContent === 'Pending') {
            badgeEl.textContent = 'Running...';
            badgeEl.style.background = 'var(--neon-amber)';
            badgeEl.style.color = 'var(--surface-dark)';
            badgeEl.style.borderColor = 'transparent';
            if (btn && btn.textContent !== 'Stop') {
              btn.textContent = 'Stop';
              btn.style.background = 'var(--neon-red)';
              btn.disabled = false;
              btn.style.opacity = '1';
            }
          }
        }
        else {
          statusEl.style.color = 'var(--text-secondary)';
          if (text.includes('Running') || text.includes('Injecting') || text.includes('Analyzing')) {
            if (badgeEl && badgeEl.textContent === 'Pending') {
              badgeEl.textContent = 'Running...';
              badgeEl.style.background = 'var(--neon-amber)';
              badgeEl.style.color = 'var(--surface-dark)';
              badgeEl.style.borderColor = 'transparent';
            }
            if (btn && btn.textContent !== 'Stop') {
              btn.textContent = 'Stop';
              btn.style.background = 'var(--neon-red)';
              btn.disabled = false;
              btn.style.opacity = '1';
            }
          }
        }

        statusEl.textContent = text;
      }
    }
  }
});
