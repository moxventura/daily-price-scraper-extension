import { getHashForTracker } from "./shared.js";

const fileInput = document.getElementById('fileInput');
const importBtn = document.getElementById('importBtn');
const exportBtn = document.getElementById('exportBtn');
const clearBtn = document.getElementById('clearBtn');

// Define the JSON schema
const schema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      id: { type: "string" },
      url: { type: "string" },
      name: { type: "string" },
      price: { type: "string" },
      decimal: { type: "string" },
      promotion: { type: "string" },
      category: { type: "string" },
    },
    required: ["url"],
    additionalProperties: false,
  },
};

// Validate JSON against schema
function validateJson(data, schema) {

  if (!Array.isArray(data)) {
    return { valid: false, error: "Data should be an array." };
  }

  for (const item of data) {
    if (typeof item !== "object") {
      return { valid: false, error: "Each item should be an object." };
    }

    for (const key of Object.keys(item)) {
      if (!schema.items.properties[key]) {
        return { valid: false, error: `Invalid key: ${key}` };
      }

      if (typeof item[key] !== schema.items.properties[key].type) {
        return { valid: false, error: `Invalid type for key: ${key}` };
      }
    }

    for (const key of schema.items.required) {
      if (!item[key]) {
        return { valid: false, error: `Missing required key: ${key}` };
      }
    }
  }

  return { valid: true };

}

// Handle Import
fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) {
    alert('Please select a file to import.');
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const newData = JSON.parse(event.target.result);

      // Validate JSON data
      const validation = validateJson(newData, schema);
      if (!validation.valid) {
        alert(`Invalid JSON: ${validation.error}`);
        return;
      }
      // Loop through the merged data and add an id if there is none
      for (let i = 0; i < newData.length; i++) {
        if (!newData[i].id) {
          newData[i].id = getHashForTracker(newData[i]);
        }
      }
      // Merge with existing data
      chrome.storage.local.get(['trackers'], (result) => {
        const existingData = result.trackers || [];
        const uniqueData = [...newData, ...existingData].filter((value, index, self) => {
          return self.findIndex((t) => t.id === value.id) === index;
        });

        console.log("uniqueData with ID", uniqueData);

        chrome.storage.local.set({ trackers: uniqueData }, () => {
          alert('Data imported and merged successfully!');
          chrome.runtime.sendMessage({ action: 'scrape' });
        });
      });
    } catch (e) {
      alert('Invalid JSON file format.');
      console.log(e);
    }
  };
  reader.readAsText(file);
  fileInput.value = '';
});

// Handle Export
exportBtn.addEventListener('click', () => {
  chrome.storage.local.get(['trackers'], (result) => {
    if (result.trackers) {
      const dataStr = JSON.stringify(result.trackers, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = 'trackers.json';
      a.click();
      URL.revokeObjectURL(url);
    } else {
      alert('No data to export.');
    }
  });
});

// Handle Clear Storage
clearBtn.addEventListener('click', () => {
  if (confirm('Are you sure you want to clear all storage?')) {
    chrome.storage.local.remove('trackers', () => {
      alert('Storage cleared successfully.');
    });
  }
});
