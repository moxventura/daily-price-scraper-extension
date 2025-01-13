async function checkAlarmState() {
  const alarm = await chrome.alarms.get("dailyScrape");

  if (!alarm) {
    scrapeData();
    // Run daily scrape using Chrome alarms
    await chrome.alarms.create("dailyScrape", { periodInMinutes: 1440 });
  }
}

checkAlarmState();

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "dailyScrape") {
    scrapeData();
  }
});

function scrapeData() {
  console.log("Scraping data");
  chrome.storage.local.get({ trackers: [] }, (result) => {
    const trackers = result.trackers;
    const today = new Date().toISOString().split("T")[0];

    trackers.forEach((entry, index) => {
      const selectors = entry.selectors;
      console.log(`Scraping ${selectors.url}`);
      const lastScraped = entry.scrapeData.lastScraped || "never";
      console.log(`Last scraped: ${lastScraped}`);
      if (lastScraped === today) {
        console.log(`Already scraped ${selectors.url} today.`);
        return;
      }

      // Open tab in the background
      chrome.tabs.create({ url: selectors.url, active: false }, (tab) => {
        handleTabUpdate(tab.id, selectors, index, today);
      });
    });
  });
}

function handleTabUpdate(tabId, selectors, index, today) {
  chrome.tabs.onUpdated.addListener(function listener(tabIdUpdated, changeInfo) {
    if (tabIdUpdated === tabId && changeInfo.status === "complete") {
      console.log(`Tab loaded: ${selectors.url}`);
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      }, () => {
        chrome.tabs.sendMessage(tabId, { action: "scrape", config: selectors }, (response) => {
          handleScrapeResponse(response, selectors, index, today, tabId);
        });
      });
      chrome.tabs.onUpdated.removeListener(listener);
    }
  });
}

function handleScrapeResponse(response, selectors, index, today, tabId) {
  if (response?.data) {
    console.log(`Scraped data from ${selectors.url}:`, response.data);
    savePrice(index, selectors, response.data);

    // Save the scrape date
    chrome.storage.local.get({ trackers: [] }, (result) => {
      const trackers = result.trackers;
      trackers[index].scrapeData.lastScraped = today;

      // Save the updated trackers array back to storage
      chrome.storage.local.set({ trackers }, () => {
        console.log(`Updated lastScraped for ${selectors.url}`);
      });

      // Close the tab
      chrome.tabs.remove(tabId);
    });
  } else {
    console.error("No response data received");
  }
}

// Save price to storage
function savePrice(index, selectors, data) {
  chrome.storage.local.get({ trackers: [] }, (result) => {
    let trackers = result.trackers;
    const oldPrice = trackers[index]?.scrapeData?.price || null;

    if (oldPrice && oldPrice !== data.price) {
      console.log(`Price changed for ${selectors.url}: ${oldPrice} -> ${data.price}`);
      sendNotification("Price Change Detected", `${trackers[index].scrapeData.name} price changed from ${oldPrice} to ${data.price}`, selectors.url);
      trackers[index].scrapeData.oldPrice = oldPrice; // Update oldPrice only when there is a difference
    }

    const oldPromotion = trackers[index]?.scrapeData?.promotion || null;
    if (data.promotion && oldPromotion !== data.promotion) {
      console.log(`Promotion changed for ${selectors.url}: ${oldPromotion} -> ${data.promotion}`);
      sendNotification("Promotion Detected", `${trackers[index].scrapeData.name} promotion found: ${data.promotion}`, selectors.url);
    }
    // Update the trackers with the new price information
    trackers[index] = {
      scrapeData: {
        name: data.name,
        price: data.price,
        promotion: data.promotion,
        lastScraped: new Date().toISOString().split("T")[0]
      },
      selectors: selectors
    };

    // Save the updated trackers back to storage
    chrome.storage.local.set({ trackers }, () => {
      console.log("Trackers data updated:", trackers);
    });
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
  if (message.action === 'saveSelectors') {
    const newSelector = message.data;
    chrome.storage.local.get({ trackers: [] }, (result) => {
      let trackers = result.trackers;
      if (!Array.isArray(trackers)) {
        trackers = [];
      }

      // Add the new selector to the trackers array
      trackers.push({
        scrapeData: {
          name: "",
          price: "",
          promotion: "",
          lastScraped: ""
        },
        selectors: {
          url: newSelector.url,
          name: newSelector.name,
          price: newSelector.price,
          decimal: newSelector.decimal,
          promotion: newSelector.promotion
        }
      });

      // Save the updated trackers back to storage and re-scrape
      chrome.storage.local.set({ trackers }, () => {
        sendResponse({ status: 'success' });
        scrapeData();
      });
    });
    return true; // Indicates that the response will be sent asynchronously
  }
});