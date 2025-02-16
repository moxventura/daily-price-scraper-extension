import { getFromStorage } from './shared.js';
let tableData = [];

let table = new DataTable('#priceTable', { 
  lengthMenu: [[5, 10, 25, -1], [5, 10, 25, 'All']],
  pageLength: 5,
  hover: true,
  language: {
    lengthMenu: 'Show _MENU_',
  },
  columns: [ 
    { label: 'Name', 
      className: 'nowrap',
      render: function(data, type, row) {
        return `<a href=${row.url}><img src="${row.faviconUrl}" class="favicon" alt="Favicon"><span>${row.scrapedName}</span></a>`;
      }
    }, 
    { label: 'Old Price', data: 'oldPrice', render: $.fn.dataTable.render.number( '.', ',', 2, '€ ' ) }, 
    { label: 'Price', data: 'scrapedPrice', render: $.fn.dataTable.render.number( '.', ',', 2, '€ ' ) }, 
    { label: 'Promotion', data: 'scrapedPromotion' }, 
    { label: 'Actions', 
      className: 'nowrap',
      render: function(data, type, row) { 
        return `
          <div class="table-button-container">
            <!--
            <div class="edit-button" data-tracker-id="${row.trackerId}">
              <i class="fa fa-edit"></i>
            </div>
            !-->
            <div class="delete-button" data-tracker-id="${row.trackerId}">
              <i class="fa fa-trash"></i>
            </div>
          </div>
        `; 
      }
    } 
  ],
  data: tableData, 
  drawCallback: function() {
    // Get the buttons
    const editButtons = document.querySelectorAll('.edit-button');
    const deleteButtons = document.querySelectorAll('.delete-button');

    // Attach event listeners to the buttons
    editButtons.forEach(button => {
      button.addEventListener('click', () => {
        const trackerId = button.dataset.trackerId;
        editRow(trackerId);
      });
    });

    deleteButtons.forEach(button => {
      button.addEventListener('click', () => {
        const trackerId = button.dataset.trackerId;
        deleteRow(trackerId);
      });
    });
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const forceScrapeButton = document.getElementById("forceScrape");

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
        files: ['src/selectionScript.js']
      }, () => {
        window.close();
      });
    });
  });
});

// Fetch and display price data
function updateTable() {
  chrome.storage.local.get(["trackers"], async (data) => {
    const trackers = data.trackers || [];
    tableData = await Promise.all(trackers.map(async tracker => {
      const scrapeData = await getFromStorage(tracker.id);
      return {
        scrapedName: scrapeData.name || tracker.url,
        oldPrice: scrapeData.oldPrice || "N/A",
        scrapedPrice: scrapeData.price || "",
        scrapedPromotion: scrapeData.promotion || "",
        faviconUrl: new URL(tracker.url).origin + '/favicon.ico',
        trackerId: tracker.id,
      }
    }))
    table.clear();
    table.rows.add(tableData);
    table.draw();
  });
}  


function editRow(trackerId) {
}

function deleteRow(trackerId) {
  chrome.storage.local.get(["trackers"], async (data) => {
    const trackers = data.trackers || [];
    const newTrackers = trackers.filter(tracker => tracker.id !== trackerId);
    await chrome.storage.local.set({ trackers: newTrackers });
    updateTable();
  });
}