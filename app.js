const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the "public" folder.
app.use(express.static(path.join(__dirname, "public")));

// API endpoint to return the graph data.
app.get("/api/graph", (req, res) => {
  const dataPath = path.join(__dirname, "data", "graph.json");
  fs.readFile(dataPath, "utf8", (err, data) => {
    if (err) {
      console.error("Error reading graph.json:", err);
      return res.status(500).send("Error reading graph data.");
    }
    try {
      const jsonData = JSON.parse(data);
      res.json(jsonData);
    } catch (parseError) {
      console.error("Error parsing JSON:", parseError);
      res.status(500).send("Error parsing graph data.");
    }
  });
});

// Start the server.
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
