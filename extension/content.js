// Content script - runs in the context of web pages

console.log('LLMSec content script loaded');

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'detectChatInterface') {
    const result = detectChatInterface();
    sendResponse(result);
    return true;
  }

  if (request.action === 'testSelectors') {
    const result = testSelectors(request.inputSelector, request.buttonSelector);
    sendResponse(result);
    return true;
  }

  if (request.action === 'injectPrompt') {
    const result = injectPrompt(request.prompt, request.inputSelector, request.buttonSelector);
    sendResponse(result);
    return true;
  }

  if (request.action === 'clickConfirmButton') {
    const result = clickConfirmButton(request.confirmButtonSelector);
    sendResponse(result);
    return true;
  }

  if (request.action === 'getResponse') {
    const result = getLatestResponse(request.responseSelector, request.buttonSelector);
    sendResponse(result);
    return true;
  }

  // Floating UI Routes
  if (request.action === 'showFloatingWidget') {
    showFloatingWidget(request.testId);
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'updateFloatingWidget') {
    updateFloatingWidget(request.text, request.type, request.isComplete);
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'hideFloatingWidget') {
    hideFloatingWidget();
    sendResponse({ success: true });
    return true;
  }
});

// ==========================================
// FLOATING WIDGET UI
// ==========================================

let activeWidgetTestId = null;

function showFloatingWidget(testId) {
  activeWidgetTestId = testId;
  let widget = document.getElementById('llmsec-floating-widget');

  if (!widget) {
    widget = document.createElement('div');
    widget.id = 'llmsec-floating-widget';

    // Add neon-styled dark theme similar to extension
    Object.assign(widget.style, {
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      width: '320px',
      backgroundColor: '#0a0a0f',
      border: '1px solid #33ff99',
      borderRadius: '8px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.8), 0 0 15px rgba(51,255,153,0.2)',
      padding: '16px',
      zIndex: '2147483647',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#e2e8f0',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      boxSizing: 'border-box'
    });

    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottom: '1px solid #1e293b',
      paddingBottom: '8px',
      marginBottom: '4px'
    });

    header.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: #33ff99; box-shadow: 0 0 8px #33ff99; animation: pulse 2s infinite;"></span>
        <strong style="font-size: 14px; color: #f8fafc; letter-spacing: 0.5px;">LLMSec Testing</strong>
      </div>
    `;

    const btnContainer = document.createElement('div');
    Object.assign(btnContainer.style, {
      display: 'flex',
      gap: '8px',
      alignItems: 'center'
    });

    // Close Button (X)
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    Object.assign(closeBtn.style, {
      backgroundColor: 'transparent',
      border: 'none',
      color: '#94a3b8',
      fontSize: '14px',
      fontWeight: 'bold',
      cursor: 'pointer',
      padding: '0 4px',
      lineHeight: '1',
      transition: 'color 0.2s ease'
    });
    closeBtn.onmouseover = () => { closeBtn.style.color = '#f8fafc'; };
    closeBtn.onmouseleave = () => { closeBtn.style.color = '#94a3b8'; };
    closeBtn.onclick = () => {
      // Trigger a silent stop just in case it's still running
      chrome.runtime.sendMessage({ action: 'stopFunctionalTest', testId: activeWidgetTestId });
      hideFloatingWidget();
    };

    // Stop Button
    const stopBtn = document.createElement('button');
    stopBtn.id = 'llmsec-widget-stop-btn';
    stopBtn.textContent = 'Stop Test';
    Object.assign(stopBtn.style, {
      backgroundColor: 'transparent',
      border: '1px solid #ff3366',
      color: '#ff3366',
      padding: '4px 10px',
      borderRadius: '4px',
      fontSize: '11px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.2s ease'
    });
    stopBtn.onmouseover = () => { stopBtn.style.backgroundColor = 'rgba(255, 51, 102, 0.1)'; };
    stopBtn.onmouseleave = () => { stopBtn.style.backgroundColor = 'transparent'; };
    stopBtn.onclick = () => {
      stopBtn.textContent = 'Stopping...';
      stopBtn.style.opacity = '0.5';
      chrome.runtime.sendMessage({ action: 'stopFunctionalTest', testId: activeWidgetTestId });
    };

    btnContainer.appendChild(stopBtn);
    btnContainer.appendChild(closeBtn);
    header.appendChild(btnContainer);

    const content = document.createElement('div');
    content.id = 'llmsec-widget-content';
    Object.assign(content.style, {
      fontSize: '13px',
      lineHeight: '1.4',
      color: '#94a3b8',
      wordBreak: 'break-word',
      maxHeight: '100px',
      overflowY: 'auto'
    });
    content.textContent = 'Initializing test...';

    // Animations block
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0% { opacity: 1; box-shadow: 0 0 8px #33ff99; }
        50% { opacity: 0.5; box-shadow: 0 0 2px #33ff99; }
        100% { opacity: 1; box-shadow: 0 0 8px #33ff99; }
      }
    `;

    widget.appendChild(style);
    widget.appendChild(header);
    widget.appendChild(content);
    document.body.appendChild(widget);
  }

  const existingStopBtn = document.getElementById('llmsec-widget-stop-btn');
  if (existingStopBtn) {
    existingStopBtn.style.display = 'block';
    existingStopBtn.textContent = 'Stop Test';
    existingStopBtn.style.opacity = '1';
  }

  widget.style.display = 'flex';
  updateFloatingWidget('Running test sequence...', 'info', false);
}

function updateFloatingWidget(text, type = 'info', isComplete = false) {
  const content = document.getElementById('llmsec-widget-content');
  if (content) {
    content.textContent = text;

    if (type === 'success') content.style.color = '#33ff99';
    else if (type === 'error') content.style.color = '#ff3366';
    else if (type === 'warn') content.style.color = '#ffb84d';
    else content.style.color = '#94a3b8'; // info
  }

  if (isComplete) {
    const stopBtn = document.getElementById('llmsec-widget-stop-btn');
    if (stopBtn) {
      stopBtn.style.display = 'none';
    }
  }
}

function hideFloatingWidget() {
  const widget = document.getElementById('llmsec-floating-widget');
  if (widget) {
    widget.style.display = 'none';
  }
}

// Auto-detect chat interface
function detectChatInterface() {
  // Common patterns for chat inputs
  const inputSelectors = [
    'textarea[placeholder*="message" i]',
    'textarea[placeholder*="chat" i]',
    'textarea[placeholder*="type" i]',
    'input[type="text"][placeholder*="message" i]',
    'div[contenteditable="true"][role="textbox"]',
    'textarea[name*="message" i]',
    'textarea.chat-input',
    '#chat-input',
    '#message-input',
    'textarea'
  ];

  // Common patterns for send buttons
  const buttonSelectors = [
    'button[type="submit"]',
    'button[aria-label*="send" i]',
    'button:has(svg)',
    'button.send',
    'button#send',
    '[data-testid*="send"]',
    'button[title*="send" i]'
  ];

  let inputElement = null;
  let buttonElement = null;

  // Try to find input
  for (const selector of inputSelectors) {
    try {
      const el = document.querySelector(selector);
      if (el && isVisible(el)) {
        inputElement = el;
        break;
      }
    } catch (e) {
      // Invalid selector, continue
    }
  }

  // Try to find button
  for (const selector of buttonSelectors) {
    try {
      const el = document.querySelector(selector);
      if (el && isVisible(el)) {
        buttonElement = el;
        break;
      }
    } catch (e) {
      // Invalid selector, continue
    }
  }

  if (inputElement && buttonElement) {
    return {
      success: true,
      inputSelector: generateSelector(inputElement),
      buttonSelector: generateSelector(buttonElement)
    };
  }

  return {
    success: false,
    message: 'Could not auto-detect chat interface'
  };
}

// Test if selectors work
function testSelectors(inputSelector, buttonSelector) {
  try {
    const inputEl = document.querySelector(inputSelector);
    const buttonEl = document.querySelector(buttonSelector);

    if (!inputEl) {
      return { success: false, message: 'Input element not found' };
    }

    if (!buttonEl) {
      return { success: false, message: 'Button element not found' };
    }

    // Flash the input element
    const originalBorder = inputEl.style.border;
    inputEl.style.border = '3px solid #3498db';
    setTimeout(() => {
      inputEl.style.border = originalBorder;
    }, 1000);

    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

// Inject prompt into chat interface
function injectPrompt(prompt, inputSelector, buttonSelector) {
  try {
    const inputEl = document.querySelector(inputSelector);
    const buttonEl = document.querySelector(buttonSelector);

    if (!inputEl || !buttonEl) {
      return { success: false, message: 'Elements not found' };
    }

    // Set value based on element type
    if (inputEl.tagName === 'TEXTAREA' || inputEl.tagName === 'INPUT') {
      inputEl.value = prompt;
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (inputEl.contentEditable === 'true') {
      inputEl.textContent = prompt;
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Small delay to ensure UI updates
    setTimeout(() => {
      buttonEl.click();
    }, 100);

    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

// Click a confirmation button directly
function clickConfirmButton(selector) {
  try {
    const btn = document.querySelector(selector);
    if (btn && isVisible(btn)) {
      btn.click();
      console.log(`[LLMSec] Clicked confirmation button: ${selector} `);
      return { success: true };
    }
    return { success: false, message: `Button not found or not visible: ${selector} ` };
  } catch (e) {
    return { success: false, message: `Invalid selector: ${selector} - ${e.message} ` };
  }
}

// Get latest response from chat
function getLatestResponse(responseSelector, buttonSelector) {
  try {
    console.log('[LLMSec] Getting latest response...');

    // If custom selector provided, try it first
    if (responseSelector) {
      try {
        const elements = document.querySelectorAll(responseSelector);
        if (elements.length > 0) {
          const lastEl = elements[elements.length - 1];

          // Check if response is still streaming (for SSE-based chats)
          if (isStreaming(lastEl)) {
            console.log('[LLMSec] Response still streaming, waiting...');
            return { success: false, message: 'Response still streaming' };
          }

          let chunksToExtract = [lastEl];

          // For most chat interfaces, the responseSelector (like data-message-author-role="assistant")
          // selects the entire message container. We strictly only want the last container
          // to prevent sequentially run test cases from grouping with previous test case outputs.

          const text = chunksToExtract.map(el => extractText(el)).filter(t => t.length > 0).join('\n\n');
          if (text && text.length > 10) {
            let messageId = lastEl.getAttribute('data-llmsec-id');
            if (!messageId) {
              messageId = 'msg_' + Math.random().toString(36).substr(2, 9);
              lastEl.setAttribute('data-llmsec-id', messageId);
            }
            const childCount = lastEl.querySelectorAll('*').length;
            console.log('[LLMSec] Found grouped response via custom selector:', text.substring(0, 100));
            return { success: true, text, messageId, childCount };
          }
        }
      } catch (e) {
        console.log('[LLMSec] Custom selector failed:', e.message);
      }
    }

    // Strategy 1: Try to find all assistant messages and get the last one
    const assistantPatterns = [
      '[data-message-author-role="assistant"]',
      '[data-role="assistant"]',
      '.assistant-message',
      '.ai-message',
      '.bot-message',
      '[class*="assistant"]',
      '[class*="ai-response"]'
    ];

    for (const pattern of assistantPatterns) {
      try {
        const elements = document.querySelectorAll(pattern);
        if (elements.length > 0) {
          const lastEl = elements[elements.length - 1];
          const text = extractText(lastEl);
          if (text && text.length > 10) {
            let messageId = lastEl.getAttribute('data-llmsec-id');
            if (!messageId) {
              messageId = 'msg_' + Math.random().toString(36).substr(2, 9);
              lastEl.setAttribute('data-llmsec-id', messageId);
            }
            const childCount = lastEl.querySelectorAll('*').length;
            console.log('[LLMSec] Found response via assistant pattern:', pattern);
            console.log('[LLMSec] Response preview:', text.substring(0, 100));
            return { success: true, text, messageId, childCount };
          }
        }
      } catch (e) {
        continue;
      }
    }

    // Strategy 2: Get all messages and find the last non-user message
    const messagePatterns = [
      '.message',
      '.chat-message',
      '[class*="message"]',
      '[role="article"]',
      '.prose'
    ];

    for (const pattern of messagePatterns) {
      try {
        const elements = document.querySelectorAll(pattern);
        if (elements.length > 1) {
          // Get the last message (should be assistant's response)
          const lastEl = elements[elements.length - 1];
          // Skip if it looks like a user message
          if (!isUserMessage(lastEl)) {
            const text = extractText(lastEl);
            if (text && text.length > 10) {
              let messageId = lastEl.getAttribute('data-llmsec-id');
              if (!messageId) {
                messageId = 'msg_' + Math.random().toString(36).substr(2, 9);
                lastEl.setAttribute('data-llmsec-id', messageId);
              }
              const childCount = lastEl.querySelectorAll('*').length;
              console.log('[LLMSec] Found response via message pattern:', pattern);
              console.log('[LLMSec] Response preview:', text.substring(0, 100));
              return { success: true, text, messageId, childCount };
            }
          }
        }
      } catch (e) {
        continue;
      }
    }

    console.log('[LLMSec] No response found with any selector');
    return { success: false, message: 'Response not found' };
  } catch (error) {
    console.error('[LLMSec] Error getting response:', error);
    return { success: false, message: error.message };
  }
}

// Helper: Extract clean text from element, preserving basic structure
function extractText(el) {
  const clone = el.cloneNode(true);

  // Remove common UI elements that pollute the text
  const uiElements = clone.querySelectorAll('button, .copy-button, .edit-button, svg, [class*="icon"], style, script');
  uiElements.forEach(e => e.remove());

  // Function to recursively extract text into Markdown
  function extractWithStructure(node) {
    let text = '';

    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        text += child.textContent;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tagName = child.tagName.toLowerCase();

        // 1. Headers
        if (tagName.match(/^h[1-6]$/)) {
          const level = parseInt(tagName.substring(1));
          text += '\n\n' + '#'.repeat(level) + ' ' + extractWithStructure(child) + '\n\n';
          continue;
        }

        // 2. Bold/Italics
        if (tagName === 'strong' || tagName === 'b') {
          text += '**' + extractWithStructure(child).trim() + '**';
          continue;
        }
        if (tagName === 'em' || tagName === 'i') {
          text += '*' + extractWithStructure(child).trim() + '*';
          continue;
        }
        if (tagName === 'code') {
          text += '`' + extractWithStructure(child) + '`';
          continue;
        }
        if (tagName === 'pre') {
          text += '\n\n```\n' + extractWithStructure(child) + '\n```\n\n';
          continue;
        }

        // 3. Lists
        if (tagName === 'li') {
          text += '\n- ' + extractWithStructure(child).trim();
          continue;
        }
        if (tagName === 'ul' || tagName === 'ol') {
          text += '\n' + extractWithStructure(child) + '\n';
          continue;
        }

        // 4. Tables
        if (tagName === 'table') {
          text += '\n\n' + extractWithStructure(child) + '\n\n';
          continue;
        }
        if (tagName === 'tr') {
          let rowContent = extractWithStructure(child).trim();
          // Ensure it starts/ends with pipe if there's any pipes
          if (rowContent && rowContent.includes('|')) {
            if (!rowContent.startsWith('|')) rowContent = '| ' + rowContent;
            if (!rowContent.endsWith('|')) rowContent = rowContent + ' |';
            text += '\n' + rowContent;

            // Add markdown separator row if this was a table header
            if (child.querySelector('th')) {
              const pipeCount = (rowContent.match(/\|/g) || []).length;
              let separator = '\n|';
              for (let i = 1; i < pipeCount; i++) {
                separator += '---|';
              }
              text += separator;
            }
          }
          continue;
        }
        if (tagName === 'td' || tagName === 'th') {
          // Replace newlines within cell with space so table doesn't break
          let cellData = extractWithStructure(child).replace(/\n/g, ' ').trim();
          text += ` ${cellData} | `;
          continue;
        }

        // 5. Block elements & standard layouts
        if (['p', 'div', 'br'].includes(tagName)) {
          if (text.length > 0 && !text.endsWith('\n')) {
            text += '\n';
          }
        }

        text += extractWithStructure(child);

        // 6. Ending block layouts
        if (['p', 'div'].includes(tagName)) {
          if (!text.endsWith('\n')) {
            text += '\n';
          }
        }
      }
    }

    return text;
  }

  // Use the structural extractor and clean up excessive whitespace
  let formattedText = extractWithStructure(clone);

  // Clean up excessive blank lines but preserve formatting
  formattedText = formattedText.replace(/\n{3,}/g, '\n\n').trim();

  // If the structural extraction somehow failed to get anything but standard textContent has data, fallback
  if (!formattedText && (clone.textContent || clone.innerText)) {
    return (clone.textContent || clone.innerText || '').trim();
  }

  return formattedText;
}

// Helper: Check if message is from user
function isUserMessage(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;

  const classes = Array.from(el.classList || []).map(c => c.toLowerCase());
  const isUserClass = classes.some(c =>
    c === 'user' || c === 'human' || c.includes('user-message') || c.includes('human-message')
  );

  const role = (el.getAttribute('role') || '').toLowerCase();
  const dataRole = (el.getAttribute('data-message-author-role') || '').toLowerCase();
  const dataTestId = (el.getAttribute('data-testid') || '').toLowerCase();

  const isUserAttr = role === 'user' || dataRole === 'user' || dataRole === 'human' || dataTestId.includes('user');

  const hasUserChild = el.querySelector('[data-message-author-role="user"], [data-role="user"], [class*="user-message"]') !== null;

  return isUserClass || isUserAttr || hasUserChild;
}

function isStreaming(el) {
  // Look for streaming indicators
  const classes = el.className || '';
  const text = el.textContent || '';

  // Check for streaming indicators
  const hasStreamingClass = classes.includes('streaming') || classes.includes('loading');
  const hasCursor = el.querySelector('.cursor') !== null || text.endsWith('▊') || text.endsWith('|');
  const hasLoadingIndicator = el.querySelector('.loading, .spinner, [class*="loading"]') !== null;

  return hasStreamingClass || hasCursor || hasLoadingIndicator;
}

// Helper: Check if element is visible
function isVisible(el) {
  return !!(
    el.offsetWidth ||
    el.offsetHeight ||
    el.getClientRects().length
  );
}

// Helper: Generate CSS selector for element
function generateSelector(el) {
  if (el.id) {
    return `#${el.id} `;
  }

  if (el.className && typeof el.className === 'string') {
    const classes = el.className.split(' ').filter(c => c);
    if (classes.length > 0) {
      return `${el.tagName.toLowerCase()}.${classes[0]} `;
    }
  }

  // Fallback to tag name with attributes
  const attributes = [];
  if (el.name) attributes.push(`[name = "${el.name}"]`);
  if (el.type) attributes.push(`[type = "${el.type}"]`);
  if (el.role) attributes.push(`[role = "${el.role}"]`);

  return `${el.tagName.toLowerCase()}${attributes.join('')} `;
}

// Monitor for response updates (for multi-turn attacks)
let responseObserver = null;

function startResponseMonitoring(callback) {
  // Find common response containers
  const containers = document.querySelectorAll(
    '[class*="message"], [class*="chat"], [role="log"], [class*="conversation"]'
  );

  if (containers.length === 0) return;

  const container = containers[containers.length - 1];

  responseObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        // New message added
        const latestResponse = getLatestResponse();
        if (latestResponse.success) {
          callback(latestResponse.text);
        }
      }
    }
  });

  responseObserver.observe(container, {
    childList: true,
    subtree: true
  });
}

function stopResponseMonitoring() {
  if (responseObserver) {
    responseObserver.disconnect();
    responseObserver = null;
  }
}
