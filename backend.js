const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.static("public"));

const DATA_PATH = path.join(__dirname, "data", "graph.json");

// Enhanced data loader with better error handling
function loadGraphData() {
  try {
    if (!fs.existsSync(DATA_PATH)) {
      throw new Error(`Data file not found at ${DATA_PATH}`);
    }

    const rawData = fs.readFileSync(DATA_PATH, "utf-8");
    const data = JSON.parse(rawData);

    // Validate data structure
    if (!data.nodes || !Array.isArray(data.nodes)) {
      throw new Error("Invalid data format: missing nodes array");
    }

    if (!data.links || !Array.isArray(data.links)) {
      throw new Error("Invalid data format: missing links array");
    }

    // Validate individual nodes
    data.nodes.forEach((node, index) => {
      if (!node.id) throw new Error(`Node at index ${index} missing ID`);
      if (!node.date) throw new Error(`Node ${node.id} missing date`);
    });

    // Validate links
    data.links.forEach((link, index) => {
      if (!link.source || !link.target) {
        throw new Error(`Link at index ${index} missing source/target`);
      }
      if (!data.nodes.some((n) => n.id === link.source)) {
        throw new Error(`Link source ${link.source} not found in nodes`);
      }
      if (!data.nodes.some((n) => n.id === link.target)) {
        throw new Error(`Link target ${link.target} not found in nodes`);
      }
    });

    console.log("Successfully loaded graph data with:");
    console.log(`- ${data.nodes.length} nodes`);
    console.log(`- ${data.links.length} links`);

    return data;
  } catch (error) {
    console.error("\n\nDATA LOADING ERROR:");
    console.error(error.message);
    console.error("\nPlease check your graph.json file format and content\n");
    process.exit(1); // Exit with error code
  }
}

// Load data at startup
const graphData = loadGraphData();

// Enhanced API endpoint
app.get("/api/graph", (req, res) => {
  try {
    // Clone data to prevent modification
    const responseData = {
      nodes: [...graphData.nodes],
      links: [...graphData.links],
    };

    // Sort nodes by date (ascending)
    responseData.nodes.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.setHeader("Content-Type", "application/json");
    res.status(200).json(responseData);
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({
      error: "Failed to process graph data",
      details: error.message,
    });
  }
});

// Export for testing
module.exports = { app, loadGraphData };

// Start server only when not in test mode
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Test API endpoint: http://localhost:${PORT}/api/graph`);
  });
}
