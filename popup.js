import { getFromStorage } from './storageUtils.js';

document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.getElementById("priceTableBody");

  // Fetch and display price data
  chrome.storage.local.get(["trackers"], (data) => {
    const trackers = data.trackers || [];

    trackers.forEach(async (tracker, index) => {
      const row = document.createElement("tr");

      const faviconUrl = new URL(tracker.url).origin + '/favicon.ico';

      const scrapeData = await getFromStorage(tracker.url);
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
          chrome.tabs.create({ url: selectors.url });
        }
      });

      tableBody.appendChild(row);
    });

    // Add event listeners to bin icons
    document.querySelectorAll('.bin-icon').forEach(binIcon => {
      binIcon.addEventListener('click', (event) => {
        const index = event.target.closest('.bin-icon').getAttribute('data-index');
        removeSelector(index);
      });
    });

    // Add event listeners to edit icons
    document.querySelectorAll('.edit-icon').forEach(editIcon => {
      editIcon.addEventListener('click', (event) => {
        const index = event.target.closest('.edit-icon').getAttribute('data-index');
        editSelector(index);
      });
    });
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

  document.getElementById('forceScrape').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'forceScrape' });
  });

  function removeSelector(index) {
    chrome.storage.local.get({ trackers: [] }, (result) => {
      let trackers = result.trackers;
      if (Array.isArray(trackers)) {
        trackers.splice(index, 1); // Remove the selector at the specified index
        chrome.storage.local.set({ trackers }, () => {
          location.reload(); // Reload the table
        });
      }
    });
  }

  function editSelector(index) {
    chrome.storage.local.get({ trackers: [] }, (result) => {
      let trackers = result.trackers;
      const tracker = trackers[index];
      // Implement your edit logic here, e.g., open a modal to edit the tracker
      console.log('Edit tracker:', tracker);
    });
  }
});