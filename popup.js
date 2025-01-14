import { getFromStorage } from './storageUtils.js';

document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.getElementById("priceTableBody");
  const forceScrapeButton = document.getElementById("forceScrape");

  // Fetch and display price data
  function updateTable() {
    chrome.storage.local.get(["trackers"], async (data) => {
      const categories = [...new Set(trackers.map(item => item.category))];
      const trackers = data.trackers || [];

      for (const [index, tracker] of trackers.entries()) {
        console.log("adding row for tracker: ", tracker.url);
        let row = tableBody.querySelector(`tr:nth-child(${index + 1})`);
        if (!row) {
          row = document.createElement("tr");
          tableBody.appendChild(row);
        }

        const faviconUrl = new URL(tracker.url).origin + '/favicon.ico';

        const scrapeData = await getFromStorage(tracker.id);
        row.innerHTML = `
          <td class="name-column">
            <img src="${faviconUrl}" class="favicon" alt="Favicon">
            <span>${scrapeData.name || tracker.url}</span>
          </td>
          <td>${scrapeData.oldPrice || "N/A"}</td>
          <td>${scrapeData.price || ""}</td>
          <td>${scrapeData.promotion || ""}</td>
          <td> 
            <span class="icon bin-icon" data-index="${index}"><i class="fas fa-trash-alt"></i></span>
          </td>
        `;
        // Add click event listener to the row
        row.addEventListener('click', (event) => {
          // Check if the clicked element is not the bin icon
          if (!event.target.closest('.bin-icon')) {
            chrome.tabs.create({ url: tracker.url });
          }
        });
      }

      // Add event listeners to bin icons after updating the table
      addBinIconEventListeners();
    });
  }

  // Initial table update
  updateTable();

  // Listen for scrape completion message
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'scrapeComplete') {
      updateTable();
    }
  });

  // Handle force scrape button click
  forceScrapeButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'forceScrape' });
  });

  document.getElementById("openSelectionPopup").addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        files: ['selectionScript.js']
      }, () => {
        window.close();
      });
    });
  });
});

// Function to add event listeners to bin icons
function addBinIconEventListeners() {
  document.querySelectorAll('.bin-icon').forEach(binIcon => {
    binIcon.addEventListener('click', (event) => {
      console.log('Remove selector:', event.target.closest('.bin-icon').getAttribute('data-index'));
      const index = event.target.closest('.bin-icon').getAttribute('data-index');
      removeSelector(index);
    });
  });
}

function removeSelector(index) {
  chrome.storage.local.get({ trackers: [] }, (result) => {
    let trackers = result.trackers;
    if (Array.isArray(trackers)) {
      let tracker = trackers.splice(index, 1); // Remove the selector at the specified index
      chrome.storage.local.remove(tracker[0].id); // Remove the data associated with the selector
      chrome.storage.local.set({ trackers }, () => {
        location.reload(); // Reload the table
      });
    }
  });
}