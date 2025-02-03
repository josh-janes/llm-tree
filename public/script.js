// Use full window dimensions

const width = window.innerWidth;
const height = window.innerHeight * 3; // Stretch vertically
const margin = { top: 20, right: 20, bottom: 20, left: 60 };

// Define radii for normal and expanded nodes.
const normalRadius = 10;
const expandedRadius = 20;
const nodeSpacing = 200;
const textPadding = 40; // Increased text padding

const detailsWidth = 200;
const detailsHeight = 120;

// Select the SVG and add a container group (this group will be zoomable/pannable)
const svg = d3.select("#dag").attr("width", width).attr("height", height);

const zoomContainer = svg.append("g");
const container = zoomContainer.append("g");

// Set up zoom behavior with proportional scaling
const zoom = d3
  .zoom()
  .scaleExtent([0.5, 5])
  .on("zoom", (event) => {
    // Apply zoom transformation to container
    zoomContainer.attr("transform", event.transform);

    container.selectAll(".year-line").attr("width", width);

    // Scale nodes, texts, and links proportionally
    container
      .selectAll(".node circle")
      .attr("r", (d) => (d.expanded ? expandedRadius : normalRadius) / scale);

    container.selectAll(".details text").attr("font-size", `${12 / scale}px`);

    container.selectAll(".node text").attr("font-size", `${12 / scale}px`);

    container.selectAll(".link").attr("stroke-width", 2 / scale);

    // Scale details if expanded
    container
      .selectAll(".details rect")
      .attr("width", detailsWidth / scale)
      .attr("height", detailsHeight / scale)
      .attr("x", -100 / scale);

    container
      .selectAll(".details text")
      .attr("font-size", `${12 / scale}px`)
      .attr("y", function () {
        const originalY = parseFloat(d3.select(this).attr("data-original-y"));
        return originalY / scale;
      });
  });
svg.call(zoom);

// Prevent double-click zoom
svg.on("dblclick.zoom", null);

// Load the graph data.
fetch("/api/graph")
  .then((response) => response.json())
  .then((data) => {
    renderGraph(data);
  })
  .catch((error) => {
    console.error("Error loading graph data:", error);
  });

function renderGraph(graph) {
  // Preprocess nodes to calculate text widths
  const tempSvg = d3.select("body").append("svg").style("visibility", "hidden");
  graph.nodes.forEach((d) => {
    d.dateObj = new Date(d.date);
    d.expanded = false;
    d.childOffset = 0;

    // Calculate text width to prevent overlap
    const textElement = tempSvg
      .append("text")
      .text(d.name)
      .attr("font-size", "12px");
    d.textWidth = textElement.node().getBBox().width + textPadding;
    textElement.remove();
  });
  tempSvg.remove();

  const dateExtent = d3.extent(graph.nodes, (d) => d.dateObj);
  dateExtent[1] = new Date(dateExtent[1].getFullYear() + 2, 0, 1); // Ensure next year tick

  const yScale = d3
    .scaleTime()
    .domain(dateExtent)
    .range([margin.top, height - margin.bottom]);

  const yearTicks = d3.timeYears(dateExtent[0], dateExtent[1]);

  const gridGroup = container.insert("g", ":first-child").attr("class", "grid");
  gridGroup
    .selectAll("line.year-line")
    .data(yearTicks)
    .enter()
    .append("line")
    .attr("class", "year-line")
    .attr("x1", -99999)
    .attr("x2", 99999)
    .attr("y1", (d) => yScale(d))
    .attr("y2", (d) => yScale(d));

  gridGroup
    .selectAll("text.year-label")
    .data(yearTicks)
    .enter()
    .append("text")
    .attr("class", "year-label")
    .attr("x", margin.left - 10)
    .attr("y", (d) => yScale(d))
    .attr("dy", "0.35em")
    .text((d) => d.getFullYear());

  // Custom x-scale to prevent text overlap with massive spacing
  const xScale = d3
    .scalePoint()
    .domain(graph.nodes.map((d) => d.id))
    .range([margin.left, width - margin.right])
    .padding(50);

  const simulation = d3
    .forceSimulation(graph.nodes)
    .force(
      "link",
      d3
        .forceLink(graph.links)
        .id((d) => d.id)
        .distance(nodeSpacing),
    )
    .force("charge", d3.forceManyBody().strength(-1))
    .force("y", d3.forceY((d) => yScale(d.dateObj)).strength(1))
    .force(
      "collision",
      d3
        .forceCollide()
        .radius((d) =>
          Math.max(
            d.expanded ? expandedRadius * 3 : normalRadius * 2,
            d.textWidth,
          ),
        ),
    )
    .on("tick", ticked);

  // Preprocess links to assign child offsets
  graph.links.forEach((link) => {
    const targetNode = graph.nodes.find((node) => node.id === link.target);
    const sourceNode = graph.nodes.find((node) => node.id === link.source);

    if (sourceNode) {
      sourceNode.childOffset = (sourceNode.childOffset || 0) + 1;
      targetNode.parent = sourceNode.id;
      targetNode.childOffset = sourceNode.childOffset;
    }
  });

  const linkGroup = container.append("g").attr("class", "links");
  const linkElements = linkGroup
    .selectAll("line")
    .data(graph.links)
    .enter()
    .append("line")
    .attr("class", "link")
    .attr("stroke-width", 2)
    .attr("stroke", "rgba(0,0,0,0.2)");

  const nodeGroup = container.append("g").attr("class", "nodes");
  const nodeElements = nodeGroup
    .selectAll("g.node")
    .data(graph.nodes)
    .enter()
    .append("g")
    .attr("class", "node")
    .on("click", function (event, d) {
      d.expanded = !d.expanded;
      simulation.alpha(1).restart();
      updateNodeDetails(d3.select(this), d, d.expanded);
    });

  // Replace the circle creation code with this:
  nodeElements
    .append("circle")
    .attr("r", (d) => (d.expanded ? expandedRadius : normalRadius))
    .attr("fill", "white") // Remove solid fill
    .attr("stroke", "white")
    .attr("stroke-width", 4);

  // Add image elements inside the nodes
  nodeElements
    .append("image")
    .attr("xlink:href", (d) => "icons/" + d.image) // Use node's image property
    .attr("x", (d) => -(d.expanded ? expandedRadius : normalRadius))
    .attr("y", (d) => -(d.expanded ? expandedRadius : normalRadius))
    .attr("width", (d) => 2 * (d.expanded ? expandedRadius : normalRadius))
    .attr("height", (d) => 2 * (d.expanded ? expandedRadius : normalRadius))
    .attr(
      "clip-path",
      (d) => `circle(${d.expanded ? expandedRadius : normalRadius}px)`,
    );

  nodeElements
    .append("text")
    .attr("dy", (d) => (d.expanded ? 50 : 20))
    .attr("text-anchor", "middle")
    .attr("font-size", "12px")
    .text((d) => d.name);

  function updateNodeDetails(nodeSelection, d, showDetails) {
    nodeSelection.selectAll(".details").remove();
    nodeSelection
      .select("circle")
      .attr("r", showDetails ? expandedRadius : normalRadius);
    nodeSelection.select("text").attr("dy", showDetails ? 50 : 20);

    if (showDetails) {
      const details = nodeSelection
        .append("g")
        .attr("class", "details")
        .attr("transform", `translate(0, ${expandedRadius + 10})`);

      // Add background rectangle
      details
        .append("rect")
        .attr("x", -100)
        .attr("y", 0)
        .attr("width", detailsWidth)
        .attr("height", detailsHeight)
        .attr("fill", "white")
        .attr("stroke", "#ccc");
      // Add content
      const content = details.append("g").attr("transform", "translate(0, 10)");

      content
        .append("text")
        .attr("x", 0)
        .attr("data-original-y", 20)
        .attr("y", 20)
        .attr("text-anchor", "middle")
        .text(`Date: ${d.date}`);

      content
        .append("text")
        .attr("x", 0)
        .attr("y", 40)
        .attr("data-original-y", 40)
        .attr("text-anchor", "middle")
        .text(`Organization: ${d.properties.organization}`);

      // Clickable paper link
      content
        .append("a")
        .attr("xlink:href", d.link)
        .attr("target", "_blank")
        .append("text")
        .attr("x", 0)
        .attr("y", 80)
        .attr("data-original-y", 80)
        .attr("text-anchor", "middle")
        .attr("fill", "blue")
        .style("cursor", "pointer")
        .style("text-decoration", "underline")
        .text("View Paper");
    }
  }

  function ticked() {
    nodeElements.attr(
      "transform",
      (d) => `translate(${d.x}, ${yScale(d.dateObj)})`,
    );
    linkElements
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => yScale(d.source.dateObj))
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => yScale(d.target.dateObj));
  }
}
