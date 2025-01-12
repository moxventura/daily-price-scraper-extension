chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "scrape") {
    const selectors = message.config;

    const name = selectors.name? document.querySelector(selectors.name)?.textContent.trim() : null;
    const euros = selectors.price? document.querySelector(selectors.price)?.textContent.trim() : 0;
    const decimal = selectors.decimal? document.querySelector(selectors.decimal)?.textContent.trim() : null;
    let promotion = selectors.promotion ? document.querySelector(selectors.promotion)?.textContent.trim() : null;

    // Replace multiple spaces and newlines with a single space
    if (promotion) {
      promotion = promotion.replace(/\s+/g, ' ');
    }
    const price = euros && decimal ? `${euros}.${decimal}` : euros? euros : decimal? decimal: null;
    sendResponse({ data: { name, price, promotion } });
  }

  // Required for asynchronous response
  return true;
});