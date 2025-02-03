const request = require("supertest");
const app = require("../backend"); // Make sure backend exports the app
const fs = require("fs");
const path = require("path");

describe("DAG API", () => {
  // No need to manually handle server start/stop with supertest
  test("GET /api/graph returns valid graph data", async () => {
    const response = await request(app).get("/api/graph");

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("nodes");
    expect(response.body).toHaveProperty("links");
    expect(Array.isArray(response.body.nodes)).toBe(true);

    if (response.body.nodes.length > 0) {
      const firstNode = response.body.nodes[0];
      expect(firstNode).toHaveProperty("id");
      expect(firstNode).toHaveProperty("name");
      expect(firstNode).toHaveProperty("date");
      expect(firstNode).toHaveProperty("properties");
    }
  });

  test("Data file validation", () => {
    const dataPath = path.join(__dirname, "../data/graph.json");
    const rawData = fs.readFileSync(dataPath);
    const data = JSON.parse(rawData);

    expect(data).toHaveProperty("nodes");
    expect(Array.isArray(data.nodes)).toBe(true);

    if (data.nodes.length > 0) {
      data.nodes.forEach((node) => {
        expect(node).toHaveProperty("id");
        expect(node).toHaveProperty("date");
      });
    }
  });
});
