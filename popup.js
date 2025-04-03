document.addEventListener('DOMContentLoaded', init);

const exControls = {
  btnSetEnum: null,
  btnContinueEnumeration: null,
  btnApplyEnum: null,
  btnIdentifyTicket: null,
  btnClearEnumeration: null,
};

function init() {
  exControls.btnSetEnum = document.getElementById('btn-set-enumerate');
  exControls.btnContinueEnumeration = document.getElementById('btn-continue-enum');
  exControls.btnApplyEnum = document.getElementById('btn-apply-enumeration');
  exControls.btnIdentifyTicket = document.getElementById('btn-identify-ticket');
  exControls.btnClearEnumeration = document.getElementById('btn-clear-enum-list');

  initEventHandlers();
}

function initEventHandlers() {
  exControls.btnSetEnum.addEventListener('click', enumerateTickets);
  exControls.btnContinueEnumeration.addEventListener('click', continueEnumeration);
  exControls.btnApplyEnum.addEventListener('click', applyTicketEnumeration);
  exControls.btnIdentifyTicket.addEventListener('click', identifyTicket);
  exControls.btnClearEnumeration.addEventListener('click', clearEnumeration);
}

// Execute a script inside the current tab
function executeScript(script, args, callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        var tabId = tabs[0].id;
        chrome.scripting.executeScript({
                target: {tabId: tabId},
                func: script,
                args: args
            },
            (results) => {
                if (callback) {
                    callback(results[0].result);
                }
            });
    });
}

// Test if the current page is a Jira Structure page
function jiraStructureQueryTest() {
   return !!document.getElementsByClassName('st-view').length && !document.getElementsByClassName('ghx-backlog-group').length;
}

// Alert if the current page is scrolled down
function alertIfScrolledDown() {
    var topCSS = document.querySelector(".cacheTable").style.top;
    if (!topCSS || topCSS !== "0px") {
        alert("Be careful! Page scrolled down and listing for enumeration might not be correct. Better is scroll to top of the list and enumerate + use \'Continue\' bnt")
    }
}

// Enumerate tickets for Jira Structure page
function ticketsForJiraStructure() {
   return [].forEach.call(document.querySelectorAll('.s-sema-inserted .s-f-issuekey'), (el, i) => { el.getElementsByClassName('s-item-link')[0].insertAdjacentHTML('beforebegin', `<span class="jira-ticket-enumeration" data-number=${i+1}>№: ${i+1} - </span>`)});
}

// Enumerate tickets for simple Jira page
function ticketsForSimpleJira() {
    return [].forEach.call(document.getElementsByClassName('js-key-link'), (el, i) => { el.insertAdjacentHTML('beforebegin', `<span class="jira-ticket-enumeration" data-number=${i+1}>№: ${i+1} - </span>`)});
}

// List enumeration for Jira Structure
function listEnumerationForJiraStructure() {
    return [].map.call(document.querySelectorAll('.s-sema-inserted .s-f-issuekey'), (el, i) => el.getElementsByClassName('s-item-link')[0].innerText);
}

// List enumeration for simple Jira
function listEnumerationForSimpleJira() {
    return [].map.call(document.getElementsByClassName('js-key-link'), (el, i) => el.innerText);
}

// Apply ticket enumeration and store it in the local storage
function enumerateTickets() {
    executeScript(jiraStructureQueryTest,[], (isJiraStructure) => {
        let ticketsQuery;
        let listEnumerationQuery;
        if (isJiraStructure) {
            executeScript(alertIfScrolledDown);
            ticketsQuery = ticketsForJiraStructure;
            listEnumerationQuery = listEnumerationForJiraStructure;
        }
        else {
            ticketsQuery = ticketsForSimpleJira;
            listEnumerationQuery = listEnumerationForSimpleJira;
        }
        executeScript(ticketsQuery,[], (result) => {
            executeScript(listEnumerationQuery, [], (result) => {
                chrome.storage.local.set({ list: result });
                window.close();
            });
        });
    });
}

function continueQuery() {
    let enumList = document.querySelectorAll('.jira-ticket-enumeration');
    if (enumList && enumList.length) {
        let lastNum = +enumList[enumList.length - 1].getAttribute('data-number');
        let filteredItems = [].filter.call(document.querySelectorAll('.s-sema-inserted .s-f-issuekey'), (el) => !el.getElementsByClassName('s-item-link')[0].parentElement.innerHTML.includes('jira-ticket-enumeration'));
        [].forEach.call(filteredItems, (el, i) => { el.getElementsByClassName('s-item-link')[0].insertAdjacentHTML('beforebegin', `<span class='jira-ticket-enumeration' data-number=${i + lastNum + 1}>№: ${i + lastNum + 1} - </span>`)});
        return [].map.call(filteredItems, (el, i) => el.getElementsByClassName('s-item-link')[0].innerText);
    }
}

// Find last element that were enumerated, and continue enumeration, (push new items to the saved list)
function continueEnumeration() {
    executeScript(jiraStructureQueryTest,[], (isJiraStructure) => {
        if (isJiraStructure) {
            executeScript(continueQuery,[], (nextItems) => {
                if (nextItems && nextItems.length) {
                    chrome.storage.local.get(['list'], (tickets) => {
                        const newList = tickets.list.concat(nextItems);
                        chrome.storage.local.set({ list: newList });
                    });
                }
            });
        }
        else {
            window.close();
        }
    });
}

// Apply the enumeration to a Jira Structure page
function applyEnumrationOnJiraStructure(tickets) {
    let tmpList = tickets.list;
    return [].forEach.call(document.querySelectorAll(".s-sema-inserted .s-f-issuekey"), (el, i) => { el.getElementsByClassName('s-item-link')[0].insertAdjacentHTML('beforebegin', `<span class="jira-ticket-enumeration">№: ${tmpList.indexOf(el.getElementsByClassName('s-item-link')[0].innerText) + 1} - </span>`)});
}

// Apply the enumeration to a simple Jira page
function applyEnumerationOnSimpleJira(tickets) {
    let tmpList = tickets.list;
    return [].forEach.call(document.getElementsByClassName("js-key-link"), (el, i) => { el.insertAdjacentHTML('beforebegin', `<span class="jira-ticket-enumeration">№: ${tmpList.indexOf(el.innerText) + 1} - </span>`)});
}

// Apply the ticket enumeration to the current page
function applyTicketEnumeration() {
    executeScript(jiraStructureQueryTest,[], (isJiraStructure) => {
        let applyEnumeration;
        if (isJiraStructure) {
            applyEnumeration = applyEnumrationOnJiraStructure;
        }
        else {
            applyEnumeration = applyEnumerationOnSimpleJira;
        }
        chrome.storage.local.get(['list'], (tickets) => {
            executeScript(applyEnumeration, [tickets], () => {
                window.close();
            });
        });
    });
}

// Identify given tickets in the current page
function identifyQuery(tickets) {
    let tmpList = tickets.list;
    return [].forEach.call(document.getElementsByClassName("links-container")[0].getElementsByClassName("issue-link"), (el, i) => {
        el.insertAdjacentHTML("beforebegin", `<span class=\"jira-ticket-enumeration\">№: ${tmpList.indexOf(el.innerText) + 1} - </span>`)});
}

// Get the ticket list from the local storage and identify the tickets
function identifyTicket() {
    chrome.storage.local.get(['list'], (tickets) => {
        executeScript(identifyQuery, [tickets], (result) => {
            window.close();
        });
    });
}

// Clearing query
function clearQuery() {
    return document.querySelectorAll(".jira-ticket-enumeration").forEach(el => el.remove());
}

// Clear the enumeration from the current page
function clearEnumeration() {
    executeScript(clearQuery, [], (result) => {
        window.close();
    });
}