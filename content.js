chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "scrape") {
    const selectors = message.config;
    const data = scrapeData(selectors);
    sendResponse({ data });
  }

  // Required for asynchronous response
  return true;
});

function scrapeData(selectors) {
  const name = getTextContent(selectors.name);
  const euros = getTextContent(selectors.price, 0);
  const decimal = getTextContent(selectors.decimal);
  let promotion = getTextContent(selectors.promotion);

  if (promotion) {
    promotion = cleanText(promotion);
  }

  const price = formatPrice(euros, decimal);
  return { name, price, promotion };
}

function getTextContent(selector, defaultValue = null) {
  return selector ? document.querySelector(selector)?.textContent.trim() : defaultValue;
}

function cleanText(text) {
  return text.replace(/\s+/g, ' ');
}

function formatPrice(euros, decimal) {
  if (euros && decimal) {
    return `${euros}.${decimal}`;
  }
  return euros || decimal || null;
}