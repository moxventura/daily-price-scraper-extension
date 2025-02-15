import { getFromStorage, setToStorage, getHashForTracker } from './shared.js';

async function checkAlarmState() {
  const alarm = await chrome.alarms.get("dailyScrape");

  if (!alarm) {
    scrapeData();
    // Run daily scrape using Chrome alarms
    await chrome.alarms.create("dailyScrape", { periodInMinutes: 1440 });
  }
}

chrome.runtime.onStartup.addListener(() => {
  checkAlarmState();
});

chrome.runtime.onInstalled.addListener(() => {
  checkAlarmState();
});

checkAlarmState();

chrome.alarms.onAlarm.addListener((alarm) => {
  checkAlarmState();
  if (alarm.name === "dailyScrape") {
    scrapeData();
  }
});

async function scrapeData(force = false) {
  const trackers = await getFromStorage('trackers');
  console.log("trackers: ", trackers);
  const today = new Date().toISOString().split("T")[0];

  const settings = await getFromStorage('settings');
  const batchSize = settings?.batchSize || 5; // Default batch size to 5 if not set

  let activeTabs = 0;

  for (const tracker of trackers) {
    if (!force) {
      console.log(`Scraping ${tracker.url}`);
      const lastData = await getFromStorage(tracker.id);
      const lastScraped = lastData?.lastScraped || "never";
      console.log(`Last scraped: ${lastScraped}`);
      if (lastScraped === today) {
        console.log(`Already scraped ${tracker.url} today.`);
        continue;
      }
    }

    while (activeTabs >= batchSize) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for an available slot
    }

    activeTabs++;
    scrapeTracker(tracker).finally(() => {
      activeTabs--;
    });
  }
}

async function scrapeTracker(tracker) {
  return new Promise((resolve, reject) => {
    // Open tab in the background
    chrome.tabs.create({ url: tracker.url, active: false }, (tab) => {
      handleTabUpdate(tab.id, tracker)
        .then(resolve)
        .catch(reject);
    });
  });
}

function handleTabUpdate(tabId, tracker) {
  return new Promise((resolve, reject) => {
    chrome.tabs.onUpdated.addListener(function listener(tabIdUpdated, changeInfo) {
      if (tabIdUpdated === tabId && changeInfo.status === "complete") {
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        }, () => {
          chrome.tabs.sendMessage(tabId, { action: "scrape", config: tracker }, (response) => {
            if (response?.data) {
              console.log(`Scraped data from ${tracker.url}:`, response.data);
              response.data.price != null ? saveData(tracker, response.data) : console.error(`Failed to scrape price from ${tracker.url}`);
            } else {
              console.error(`Failed to scrape data from ${tracker.url}`);
            }
            // Close the tab
            chrome.tabs.remove(tabId);
          });
        });
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    });
  });
}

// Save price to storage
async function saveData(tracker, data) {
  const oldData = await getFromStorage(tracker.id);
  const oldPrice = oldData?.price;
  if (oldPrice && oldPrice !== data.price) {
    console.log(`Price changed for ${tracker.url}: ${oldPrice} -> ${data.price}`);
    sendNotification("Price Change Detected", `${data.name} price changed from ${oldPrice} to ${data.price}`, tracker.url);
    oldData.oldPrice = oldPrice; // Update oldPrice only when there is a difference
  }

  const oldPromotion = oldData?.promotion;
  if (data.promotion && oldPromotion !== data.promotion) {
    console.log(`Promotion changed for ${tracker.url}: ${oldPromotion} -> ${data.promotion}`);
    sendNotification("Promotion Detected", `${data.name} promotion found: ${data.promotion}`, tracker.url);
  }
  // Empty promotion if it is not set
  if (!data.promotion) {
    data.promotion = '';
  }
  // Update the trackers with the new price information
  let newData = { ...oldData, ...data };
  newData.lastScraped = new Date().toISOString().split("T")[0]
  newData.url = tracker.url;

  // Save the data to storage
  await setToStorage(tracker.id, newData);
  chrome.runtime.sendMessage({ action: 'scrapeComplete' }, () => {
    if (chrome.runtime.lastError) {
      // Ignore errors when the popup is not open
    }
  });
}

async function sendNotification(title, message, url) {
  // Notify about the price change
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icon.png", // Replace with your icon
    title: title,
    message: message,
    buttons: [
      { title: "View Product" }  // Button text
    ],
    priority: 2  // to make the notification more prominent
  }, function (notificationId) {
    // Store the URL associated with the notification for later use
    chrome.notifications.onButtonClicked.addListener(function (notifId, buttonIndex) {
      if (notifId === notificationId && buttonIndex === 0) {
        // Open the URL in a new tab when the button is clicked
        chrome.tabs.create({ url: url });
      }
    });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  checkAlarmState();
  if (message.action === 'forceScrape') {
    scrapeData(true);
    sendResponse({ success: true });
  }
  if (message.action === 'saveSelectors') {
    const newSelector = message.data;
    chrome.storage.local.get({ trackers: [] }, (result) => {
      let trackers = result.trackers;
      if (!Array.isArray(trackers)) {
        trackers = [];
      }
      const trackerId = getHashForTracker(newSelector);
      // Add the new selector to the trackers array
      trackers.push({
        id: `tracker-${trackerId}`,
        url: newSelector.url,
        name: newSelector.name,
        price: newSelector.price,
        decimal: newSelector.decimal,
        promotion: newSelector.promotion
      });

      // Save the updated trackers back to storage and re-scrape
      chrome.storage.local.set({ trackers }, () => {
        sendResponse({ status: 'success' });
        scrapeData();
      });
    });
    return true; // Indicates that the response will be sent asynchronously
  }
  if (message.action === 'scrape') {
    scrapeData().then(() => {
      ;
      sendResponse({ success: true });
    });
  }
});