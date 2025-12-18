document.addEventListener('DOMContentLoaded', () => {
    class ProblemAnalysis {
        constructor() {
            this.CSRF_TOKEN_NAME = '_csrf_token';
            this.form = this.findFormWithCsrfToken();
            this.init();
        }

        findFormWithCsrfToken() {
            for (let form of document.forms) {
                if (form[this.CSRF_TOKEN_NAME]) {
                    return form;
                }
            }
            
            const tokenInput = document.querySelector(`input[name="${this.CSRF_TOKEN_NAME}"]`);
            if (tokenInput) {
                return tokenInput.closest('form') || document.forms[0];
            }

            return document.forms[0];
        }

        init() {
            // Initially adds the button
            this.addLTSButton();
            
            // Observer for changes in the DOM
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    // Checks if there are changes relevant to the LTS button
                    if (mutation.target.classList && 
                        (mutation.target.classList.contains('flickerfreescreen') ||
                         mutation.target.classList.contains('list-table') ||
                         mutation.target.classList.contains('dashboard-grid-widget-contents') ||
                         mutation.target.classList.contains('dashboard-widget-problems') ||
                         mutation.target.classList.contains('table') ||
                         mutation.target.tagName === 'TBODY' ||
                         mutation.target.tagName === 'TR')) {
                        this.addLTSButton();
                    }
                });
            });

            // Specific observer for dashboard widgets
            const dashboardObserver = new MutationObserver((mutations) => {
                let shouldUpdate = false;
                mutations.forEach((mutation) => {
                    if (mutation.target.classList && 
                        (mutation.target.classList.contains('dashboard-grid-widget-contents') ||
                         mutation.target.classList.contains('dashboard-widget-problems') ||
                         mutation.target.closest('.dashboard-grid-widget-contents'))) {
                        shouldUpdate = true;
                    }
                });
                
                if (shouldUpdate) {
                    setTimeout(() => {
                        this.addLTSButtonToDashboardWidgets();
                    }, 500);
                }
            });

            // Observe the dashboard container if it exists
            const dashboardContainer = document.querySelector('.dashboard-grid, .dashboard-container');
            if (dashboardContainer) {
                dashboardObserver.observe(dashboardContainer, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['class']
                });
            }

            // Observe the document body for changes
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class', 'style']
            });

            // Add listener for Zabbix screen update event
            document.addEventListener('zbx_reload', () => {
                this.addLTSButton();
            });

            // Run periodically to capture dynamic changes
            setInterval(() => {
                this.addLTSButton();
            }, 2000);

            // Run periodically to capture dynamically loaded dashboard widgets
            setInterval(() => {
                this.addLTSButtonToDashboardWidgets();
            }, 3000);
        }

        addLTSButton() {
            // Add buttons in the main problem list
            this.addLTSButtonToMainTable();
            
            // Add buttons to dashboard widgets
            this.addLTSButtonToDashboardWidgets();
        }

        addLTSButtonToMainTable() {
            const flickerfreescreen = document.querySelector('.flickerfreescreen');
            if (!flickerfreescreen) return;

            const tables = flickerfreescreen.querySelectorAll('table.list-table');
            tables.forEach(table => {
                const tbody = table.querySelector('tbody');
                if (!tbody) return;

                // Check if we have already added the LTS column header
                const headerRow = table.querySelector('thead tr');
                if (headerRow && !headerRow.querySelector('.lts-header')) {
                    const ltsHeader = document.createElement('th');
                    ltsHeader.className = 'lts-header';
                    ltsHeader.textContent = 'Analysis';
                    headerRow.appendChild(ltsHeader);
                }

                const rows = tbody.querySelectorAll('tr:not(.timeline-axis):not(.timeline-td)');
                rows.forEach(row => {
                    // Check if the row is not a timeline row and if it already has an LTS button
                    if (row.querySelector('.js-lts-button') || 
                        !row.querySelector('.problem-expand-td')) return;

                    // Extract data using data-menu-popup (more reliable)
                    const problemData = this.extractProblemDataFromMenuPopup(row);
                    
                    if (problemData && problemData.eventid) {
                        this.addLTSColumnToRow(row, problemData);
                    }
                });
            });
        }

        addLTSButtonToDashboardWidgets() {
            // Look for specific widgets with both classes
            const specificWidget = document.querySelector('.dashboard-grid-widget-contents.dashboard-widget-problems');

            const problemWidgets = new Set();

            if (specificWidget) {
                problemWidgets.add(specificWidget);
            }
            
            problemWidgets.forEach(widget => {
                const problemTable = widget.querySelector('table.list-table') || (widget.tagName === 'TABLE' ? widget : null);
                if (!problemTable) return;

                const tbody = problemTable.querySelector('tbody');
                if (!tbody) return;

                // Check if we have already added the LTS column header
                const headerRow = problemTable.querySelector('thead tr');
                if (headerRow && !headerRow.querySelector('.lts-header')) {
                    const ltsHeader = document.createElement('th');
                    ltsHeader.className = 'lts-header';
                    ltsHeader.textContent = 'MonZGuru';
                    headerRow.appendChild(ltsHeader);
                }

                const rows = tbody.querySelectorAll('tr:not(.timeline-axis):not(.timeline-td)');
                rows.forEach(row => {
                    // Check if there's already an LTS button in this row
                    if (row.querySelector('.js-lts-button-widget')) return;

                    // Extract data using data-menu-popup
                    const problemData = this.extractProblemDataFromMenuPopup(row);
                    
                    if (problemData && problemData.eventid) {
                        this.addLTSColumnToRow(row, problemData, true);
                    }
                });
            });
        }

        extractProblemDataFromMenuPopup(row) {
            let eventid = null;
            let triggerid = null;
            let hostid = null;
            let hostname = '';
            let problemName = '';

            try {
                // Extract eventid from links or attributes
                const eventLink = row.querySelector('a[href*="eventid"]');
                if (eventLink) {
                    const match = eventLink.href.match(/eventid=(\d+)/);
                    if (match) {
                        eventid = match[1];
                    }
                }

                // Extract hostid and triggerid using data-menu-popup (more reliable method)
                const hostElement = row.querySelector('[data-menu-popup*="hostid"]');
                const triggerElement = row.querySelector('[data-menu-popup*="triggerid"]');

                if (hostElement) {
                    try {
                        const hostData = JSON.parse(hostElement.getAttribute('data-menu-popup'));
                        if (hostData.data && hostData.data.hostid) {
                            hostid = hostData.data.hostid;
                            hostname = hostElement.textContent.trim();
                        }
                    } catch (e) {
                        console.warn('Error parsing hostid:', e);
                    }
                }

                if (triggerElement) {
                    try {
                        const triggerData = JSON.parse(triggerElement.getAttribute('data-menu-popup'));
                        if (triggerData.data && triggerData.data.triggerid) {
                            triggerid = triggerData.data.triggerid;
                            problemName = triggerElement.textContent.trim();
                        }
                    } catch (e) {
                        console.warn('Error parsing triggerid:', e);
                    }
                }

                // If not able to extract using data-menu-popup, try fallback methods
                if (!hostid || !triggerid) {
                    const fallbackData = this.extractProblemDataFallback(row);
                    hostid = hostid || fallbackData.hostid;
                    triggerid = triggerid || fallbackData.triggerid;
                    hostname = hostname || fallbackData.hostname;
                    problemName = problemName || fallbackData.problemName;
                }

                return eventid ? {
                    eventid: eventid,
                    triggerid: triggerid,
                    hostid: hostid,
                    hostname: hostname,
                    problemName: problemName
                } : null;

            } catch (error) {
                
                return null;
            }
        }

        extractProblemDataFallback(row) {
            let eventid = null;
            let triggerid = null;
            let hostid = null;
            let hostname = '';
            let problemName = '';

            try {
                // Try to extract eventid from links or attributes
                const eventLink = row.querySelector('a[href*="eventid"]');
                if (eventLink) {
                    const match = eventLink.href.match(/eventid=(\d+)/);
                    if (match) {
                        eventid = match[1];
                    }
                }

                // Multiple attempts to extract triggerid
                let triggerLink = row.querySelector('a[href*="triggerids"]');
                if (triggerLink) {
                    const match = triggerLink.href.match(/triggerids.*?(\d+)/);
                    if (match) {
                        triggerid = match[1];
                    }
                }

                // Also try singular triggers
                if (!triggerid) {
                    triggerLink = row.querySelector('a[href*="triggerid"]');
                    if (triggerLink) {
                        const match = triggerLink.href.match(/triggerid.*?(\d+)/);
                        if (match) {
                            triggerid = match[1];
                        }
                    }
                }

                // Multiple attempts to extract hostid and hostname
                // 1. Search for links with hostid in the URL
                let hostLink = row.querySelector('a[href*="hostid"]');
                if (!hostLink) {
                    hostLink = row.querySelector('a[href*="filter_hostids"]');
                }
                if (!hostLink) {
                    hostLink = row.querySelector('a[href*="hostids"]');
                }
                
                if (hostLink) {
                    const hostMatch = hostLink.href.match(/(?:hostids?|filter_hostids).*?(\d+)/);
                    if (hostMatch) {
                        hostid = hostMatch[1];
                    }
                    hostname = hostLink.textContent.trim();
                }
                
                // 2. If not found, search in the Host column (usually the 4th or 5th column)
                if (!hostid || !hostname) {
                    const hostCells = row.querySelectorAll('td');
                    for (let i = 3; i <= 5 && i < hostCells.length; i++) {
                        const hostCell = hostCells[i];
                        const hostAnchor = hostCell.querySelector('a');
                        if (hostAnchor && hostAnchor.href.includes('hostid')) {
                            const match = hostAnchor.href.match(/hostid.*?(\d+)/);
                            if (match) {
                                hostid = match[1];
                                hostname = hostAnchor.textContent.trim();
                                break;
                            }
                        }
                    }
                }
                
                // 3. If still not found, try using data attributes or other patterns
                if (!hostid) {
                    // Look for data-hostid in the row or child elements
                    const elementWithHostid = row.querySelector('[data-hostid]');
                    if (elementWithHostid) {
                        hostid = elementWithHostid.getAttribute('data-hostid');
                    }
                }
                
                // 4. If still no hostname, search for text that might be the hostname
                if (!hostname && hostid) {
                    // Search in the cell containing host information
                    const possibleHostCell = row.querySelector('td:nth-child(4), td:nth-child(5)');
                    if (possibleHostCell) {
                        const text = possibleHostCell.textContent.trim();
                        if (text && !text.includes('Problem') && text.length > 0) {
                            hostname = text;
                        }
                    }
                }

                // Extract problem name
                const problemCell = row.querySelector('td:nth-child(3), td:nth-child(4)');
                if (problemCell) {
                    problemName = problemCell.textContent.trim();
                }

                // If eventid wasn't extracted, try another method
                if (!eventid) {
                    // Look for any link that might contain eventid numbers
                    const allLinks = row.querySelectorAll('a[href*="action="]');
                    allLinks.forEach(link => {
                        const href = link.href;
                        if (href.includes('eventid')) {
                            const match = href.match(/eventid=(\d+)/);
                            if (match && !eventid) {
                                eventid = match[1];
                            }
                        }
                    });
                }

            } catch (error) {
                
                return null;
            }

            return eventid ? {
                eventid: eventid,
                triggerid: triggerid,
                hostid: hostid,
                hostname: hostname,
                problemName: problemName
            } : null;
        }

        addLTSColumnToRow(row, problemData, isWidget = false) {
            // Check if the LTS column already exists in this row
            const existingButton = row.querySelector('.js-lts-button') || row.querySelector('.js-lts-button-widget');
            if (existingButton) return;

            // Create the button
            const button = document.createElement('button');
            button.className = isWidget ? 'btn-alt js-lts-button-widget' : 'btn-alt js-lts-button';
            button.innerHTML = 'Details';
            button.title = `LTS Analysis: ${problemData.hostname} - ${problemData.problemName}`;

            // Create the new table cell
            const td = document.createElement('td');
            td.className = 'lts-column-cell';
            td.appendChild(button);

            // Add the cell at the end of the row
            row.appendChild(td);

            // Add click event
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.openLTSModal(problemData);
            });
        }

        addButtonToRow(row, problemData) {
            // Find the last cell in the row to add the button
            const lastCell = row.lastElementChild;
            if (!lastCell) return;

            // Create the button
            const button = document.createElement('button');
            button.className = 'analist-lts-btn btn-link';
            button.innerHTML = 'LTS';
            button.title = 'LTS Analysis of the Problem';

            // Add click event
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.openLTSModal(problemData);
            });

            // Add the button to the cell
            lastCell.appendChild(button);
        }

        openLTSModal(problemData) {
            const params = new URLSearchParams({
                eventid: problemData.eventid,
                ...(problemData.triggerid && { triggerid: problemData.triggerid }),
                ...(problemData.hostid && { hostid: problemData.hostid }),
                ...(problemData.hostname && { hostname: problemData.hostname }),
                ...(problemData.problemName && { problem_name: problemData.problemName })
            });

            // URL of the endpoint for our module
            const url = params.toString();

            // Open popup using the Zabbix function
            if (typeof PopUp !== 'undefined') {
                PopUp('problemanalist.view', url, {
                    dialogue_class: 'modal-popup-large',
                    draggable: true,
                    resizable: true
                });
            } else {
                // Fallback to open in a new window
                window.open(url, 'analist-lts', 'width=1200,height=800,scrollbars=yes,resizable=yes');
            }
        }

        getCsrfToken() {
            if (this.form && this.form[this.CSRF_TOKEN_NAME]) {
                return this.form[this.CSRF_TOKEN_NAME].value;
            }
            
            const tokenInput = document.querySelector(`input[name="${this.CSRF_TOKEN_NAME}"]`);
            return tokenInput ? tokenInput.value : '';
        }
    }

    // Initialize the class
    new ProblemAnalysis();
});
