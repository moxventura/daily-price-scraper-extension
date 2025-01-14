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
      url: { type: "string" },
      name: { type: "string" },
      price: { type: "string" },
      decimal: { type: "string" },
      promotion: { type: "string" },
    },
    required: ["url"],
    additionalProperties: false,
  },
};

// Validate JSON against schema
function validateJson(data, schema) {
  if (schema.type === "array" && !Array.isArray(data)) {
    return { valid: false, error: "Root element must be an array." };
  }

  for (const item of data) {
    for (const key of schema.items.required) {
      if (!Object.prototype.hasOwnProperty.call(item, key)) {
        return { valid: false, error: `Missing required field: ${key}` };
      }
    }
    for (const [key, value] of Object.entries(item)) {
      const propertySchema = schema.items.properties[key];
      if (!propertySchema) {
        return { valid: false, error: `Unexpected property: ${key}` };
      }
      if (typeof value !== propertySchema.type) {
        return {
          valid: false,
          error: `Invalid type for property '${key}'. Expected ${propertySchema.type}.`,
        };
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

      // Merge with existing data
      chrome.storage.local.get(['trackers'], (result) => {
        const existingData = result.trackers || [];
        const mergedData = [...existingData, ...newData];

        chrome.storage.local.set({ trackers: mergedData }, () => {
          alert('Data imported and merged successfully!');
        });
      });
    } catch (e) {
      alert('Invalid JSON file format.');
    }
  };
  reader.readAsText(file);
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
