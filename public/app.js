async function initializeGraph() {
  const container = d3.select("#graph-container");
  const { width, height } = container.node().getBoundingClientRect();

  const svg = container
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .call(
      d3.zoom().on("zoom", (event) => svg.attr("transform", event.transform)),
    )
    .append("g");

  const data = await d3.json("/api/graph");

  // Sort nodes chronologically
  data.nodes.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Create simulation
  const simulation = d3
    .forceSimulation(data.nodes)
    .force(
      "link",
      d3
        .forceLink(data.links)
        .id((d) => d.id)
        .distance(100),
    )
    .force("charge", d3.forceManyBody().strength(-300))
    .force("x", d3.forceX(width / 2).strength(0.05))
    .force("y", d3.forceY(height / 2).strength(0.05));

  // Create links
  const link = svg
    .append("g")
    .selectAll("line")
    .data(data.links)
    .enter()
    .append("line")
    .attr("class", "link");

  // Create nodes
  const node = svg
    .append("g")
    .selectAll("g")
    .data(data.nodes)
    .enter()
    .append("g")
    .attr("class", "node")
    .on("click", (event, d) => showNodeDetails(d));

  // Add images to nodes
  node
    .append("image")
    .attr("class", "node-image")
    .attr("xlink:href", (d) => d.image)
    .attr("x", -30)
    .attr("y", -30)
    .attr("width", 60)
    .attr("height", 60);

  // Add text labels
  node
    .append("text")
    .attr("class", "node-text")
    .text((d) => d.name)
    .attr("y", 40);

  simulation.on("tick", () => {
    link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);

    node.attr("transform", (d) => `translate(${d.x},${d.y})`);
  });
}

function showNodeDetails(node) {
  const modal = document.getElementById("node-modal");
  modal.style.display = "block";

  document.getElementById("modal-title").textContent = node.name;
  document.getElementById("modal-image").src = node.image;
  document.getElementById("modal-link").href = node.link;

  const propertiesDiv = document.getElementById("modal-properties");
  propertiesDiv.innerHTML = Object.entries(node.properties)
    .map(([key, value]) => `<div class="property-badge">${key}: ${value}</div>`)
    .join("");
}

function closeModal() {
  document.getElementById("node-modal").style.display = "none";
}

// Initialize the graph when page loads
window.addEventListener("DOMContentLoaded", initializeGraph);
