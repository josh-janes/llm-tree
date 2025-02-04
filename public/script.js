// Use full window dimensions.
const width = window.innerWidth;
const height = window.innerHeight * 3; // Stretch vertically
const margin = { top: 20, right: 20, bottom: 20, left: 60 };

// Define radii for normal and expanded nodes.
const normalRadius = 10;
const expandedRadius = 30;
const nodeSpacing = 200;
const textPadding = 40; // extra padding for text

const detailsWidth = 200;
let detailsHeight = 120; // initial height (will be recalculated per node)

// --- Helper function to wrap text ---
// This function creates <tspan> elements as needed so that the text fits within maxWidth.
function wrapText(textSelection, maxWidth, lineHeight = 1.2) {
  textSelection.each(function () {
    const text = d3.select(this);
    const words = text.text().split(/\s+/).reverse();
    let word,
      line = [],
      lineNumber = 0;
    const x = text.attr("x") || 0;
    const y = text.attr("y") || 0;
    const dy = parseFloat(text.attr("dy")) || 0;
    text.text(""); // clear current text
    // Create the first tspan.
    let tspan = text
      .append("tspan")
      .attr("x", x)
      .attr("y", y)
      .attr("dy", dy + "em");
    while ((word = words.pop())) {
      line.push(word);
      tspan.text(line.join(" "));
      if (tspan.node().getComputedTextLength() > maxWidth) {
        // If adding the word makes it too long, remove it and start a new tspan.
        line.pop();
        tspan.text(line.join(" "));
        line = [word];
        lineNumber++;
        tspan = text
          .append("tspan")
          .attr("x", x)
          .attr("y", y)
          .attr("dy", lineNumber * lineHeight + dy + "em")
          .text(word);
      }
    }
  });
}

// --- SVG and Zoom Setup ---
// Create an SVG element and a zoomable container.
const svg = d3.select("#dag").attr("width", width).attr("height", height);

const zoomContainer = svg.append("g");
const container = zoomContainer.append("g");

const zoom = d3
  .zoom()
  .scaleExtent([0.5, 5])
  .on("zoom", (event) => {
    zoomContainer.attr("transform", event.transform);

    container
      .selectAll("g.node > circle.outline")
      .attr("r", (d) => (d.expanded ? expandedRadius : normalRadius) / scale) // Scale radius properly
      .attr("stroke-width", 1);

    // Maintain icon size
    container
      .selectAll("g.node > image")
      .attr(
        "x",
        (d) => -((d.expanded ? expandedRadius * 1.5 : normalRadius) / scale),
      )
      .attr(
        "y",
        (d) => -((d.expanded ? expandedRadius * 1.5 : normalRadius) / scale),
      )
      .attr(
        "width",
        (d) => (2 * (d.expanded ? expandedRadius * 1.5 : normalRadius)) / scale,
      )
      .attr(
        "height",
        (d) => (2 * (d.expanded ? expandedRadius * 1.5 : normalRadius)) / scale,
      );

    container
      .selectAll("g.node > circle")
      .attr(
        "r",
        (d) => (d.expanded ? expandedRadius : normalRadius) / event.transform.k,
      );

    container
      .selectAll("g.node > text")
      .attr("font-size", `${12 / event.transform.k}px`);

    container.selectAll(".link").attr("stroke-width", 2 / event.transform.k);
  });

svg.call(zoom);
svg.on("dblclick.zoom", null);

// --- Load and Render Graph Data ---
fetch("/api/graph")
  .then((response) => response.json())
  .then((data) => {
    renderGraph(data);
  })
  .catch((error) => {
    console.error("Error loading graph data:", error);
  });

function renderGraph(graph) {
  // Preprocess nodes: convert date strings, set flags, and measure text.
  const tempSvg = d3.select("body").append("svg").style("visibility", "hidden");
  graph.nodes.forEach((d) => {
    d.dateObj = new Date(d.date);
    d.expanded = false;
    d.childOffset = 0;
    const textElement = tempSvg
      .append("text")
      .text(d.name)
      .attr("font-size", "12px");
    d.textWidth = textElement.node().getBBox().width + textPadding;
    textElement.remove();
  });
  tempSvg.remove();

  // Set up a time scale for vertical positioning.
  const dateExtent = d3.extent(graph.nodes, (d) => d.dateObj);
  dateExtent[0] = new Date(dateExtent[0].getFullYear(), 0, 1);
  dateExtent[1] = new Date(dateExtent[1].getFullYear() + 2, 0, 1);
  const yScale = d3
    .scaleTime()
    .domain(dateExtent)
    .range([margin.top, height - margin.bottom]);

  const yearTicks = d3.timeYears(dateExtent[0], dateExtent[1]);

  // Draw grid lines and year labels.
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

  // Set up an x-scale for initial positions.
  const xScale = d3
    .scalePoint()
    .domain(graph.nodes.map((d) => d.id))
    .range([margin.left, width - margin.right])
    .padding(50);
  graph.nodes.forEach((d) => {
    d.initialX = xScale(d.id);
    if (d.x === undefined) d.x = d.initialX;
  });

  // Create a force simulation.
  const simulation = d3
    .forceSimulation(graph.nodes)
    .force("x", d3.forceX((d) => d.initialX).strength(0.5))
    .force("y", d3.forceY((d) => yScale(d.dateObj)).strength(1))
    .force(
      "link",
      d3
        .forceLink(graph.links)
        .id((d) => d.id)
        .distance(nodeSpacing)
        .strength(0.5),
    )
    .force("charge", d3.forceManyBody().strength(-1))
    .force(
      "collision",
      d3.forceCollide((d) => {
        const baseRadius = d.expanded ? expandedRadius : normalRadius;
        return Math.max(baseRadius * 1.5, d.textWidth);
      }),
    )
    .velocityDecay(0.7)
    .on("tick", ticked);

  // Preprocess links for child offsets.
  graph.links.forEach((link) => {
    const targetNode = graph.nodes.find((node) => node.id === link.target);
    const sourceNode = graph.nodes.find((node) => node.id === link.source);
    if (sourceNode) {
      sourceNode.childOffset = (sourceNode.childOffset || 0) + 1;
      targetNode.parent = sourceNode.id;
      targetNode.childOffset = sourceNode.childOffset;
    }
  });

  // Draw links.
  const linkGroup = container.append("g").attr("class", "links");
  const linkElements = linkGroup
    .selectAll("line")
    .data(graph.links)
    .enter()
    .append("line")
    .attr("class", "link")
    .attr("stroke-width", 2)
    .attr("stroke", "rgba(0,0,0,0.2)");

  // Draw nodes.
  const nodeGroup = container.append("g").attr("class", "nodes");
  const nodeElements = nodeGroup
    .selectAll("g.node")
    .data(graph.nodes)
    .enter()
    .append("g")
    .attr("class", "node")
    .on("click", function (event, d) {
      // Toggle expanded state.
      d.expanded = !d.expanded;
      if (d.expanded) {
        d.fx = d.x;
        d.fy = d.y;
      } else {
        d.fx = null;
        d.fy = null;
      }
      simulation.alphaTarget(0.05).restart();
      d3.select(this).raise();
      updateNodeDetails(d3.select(this), d, d.expanded);
    });

  // Node circles.
  nodeElements
    .append("circle")
    .attr("r", (d) => (d.expanded ? expandedRadius : normalRadius))
    .attr("fill", "white")
    .attr("stroke", "white")
    .attr("stroke-width", 4);

  // Node images.
  nodeElements
    .append("image")
    .attr("xlink:href", (d) => "icons/" + d.image)
    .attr("x", (d) => -(d.expanded ? expandedRadius : normalRadius))
    .attr("y", (d) => -(d.expanded ? expandedRadius : normalRadius))
    .attr("width", (d) => 2 * (d.expanded ? expandedRadius : normalRadius))
    .attr("height", (d) => 2 * (d.expanded ? expandedRadius : normalRadius))
    .attr(
      "clip-path",
      (d) => `circle(${d.expanded ? expandedRadius : normalRadius}px)`,
    );

  // Node labels (direct children of g.node).
  nodeElements
    .append("text")
    .attr("dy", (d) => (d.expanded ? 50 : 30))
    .attr("text-anchor", "middle")
    .attr("font-size", "12px")
    .attr("fill", "white")
    .attr(
      "text-shadow",
      "-1px -1px 0 black, 1px -1px 0 black, -1px 1px 0 black, 1px 1px 0 black",
    )
    .attr("font-family", "sans-serif")
    .text((d) => d.name);

  // --- Details Box (Expanded Node Info) ---
  function updateNodeDetails(nodeSelection, d, showDetails) {
    // Remove any existing details.
    nodeSelection.selectAll(".details").remove();

    // Update circle outline
    nodeSelection
      .select("circle.outline")
      .attr("r", showDetails ? expandedRadius + 5 : normalRadius + 3)
      .attr("stroke-width", 2 / d3.zoomTransform(container.node()).k);

    // Update the node circle and label positions.
    nodeSelection
      .select("circle")
      .attr("r", showDetails ? expandedRadius : normalRadius)
      .attr("clip-path", showDetails ? expandedRadius : normalRadius);
    nodeSelection.select("text").attr("dy", showDetails ? 50 : 20);

    nodeSelection
      .select("image")
      .attr("x", showDetails ? -expandedRadius : -normalRadius)
      .attr("y", showDetails ? -expandedRadius : -normalRadius)
      .attr("width", showDetails ? 2 * expandedRadius : 2 * normalRadius)
      .attr("height", showDetails ? 2 * expandedRadius : 2 * normalRadius)
      .attr(
        "clip-path",
        `circle(${showDetails ? expandedRadius - 2 : normalRadius}`,
      );

    if (showDetails) {
      // Create a group for the details box.
      const details = nodeSelection
        .append("g")
        .attr("class", "details")
        // This group will scale with the zoom transform.
        .attr("transform", `translate(0, ${expandedRadius + 10})`);
      details.raise();

      // Append the background rectangle.
      const detailsRect = details
        .append("rect")
        .attr("x", -100)
        .attr("y", 0)
        .attr("width", detailsWidth)
        .attr("height", detailsHeight) // will be updated after measuring text
        .attr("fill", "white")
        .attr("stroke", "#e0e0e0")
        .attr("stroke-width", 1)
        .attr("rx", 10)
        .attr("ry", 10)
        .attr("filter", "url(#dropShadow)");
      detailsRect.attr("data-height", detailsHeight);

      // Create a drop shadow definition if needed.
      const defs = svg.select("defs");
      if (defs.empty()) {
        svg.append("defs").append("filter").attr("id", "dropShadow").html(`
            <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
            <feOffset dx="0" dy="2" result="offsetblur"/>
            <feFlood flood-color="#00000033"/>
            <feComposite in2="offsetblur" operator="in"/>
            <feMerge>
              <feMergeNode/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          `);
      }

      // Create a group for details content.
      const content = details.append("g").attr("transform", "translate(0, 10)");

      // Helper function to add text.
      const addText = (txt, y, options = {}) => {
        content
          .append("text")
          .attr("x", 0)
          .attr("y", y)
          .attr("data-original-y", y)
          .attr("text-anchor", "middle")
          .attr("font-size", "12px")
          .attr("fill", options.color || "#333")
          .attr("font-weight", options.fontWeight || "normal")
          .text(txt);
      };

      addText(`${d.name}`, 20, { fontWeight: "bold" });
      addText(`Date: ${d.date}`, 40);
      addText(`Organization: ${d.properties.organization}`, 60);

      // Create and wrap the description text.
      const description = content
        .append("text")
        .attr("x", 0)
        .attr("y", 80)
        .attr("dy", "0em")
        .attr("data-original-y", 80)
        .attr("text-anchor", "middle")
        .attr("text-align", "justify")
        .attr("font-size", "12px")
        .attr("fill", "#333")
        .text(`${d.properties.description}`);
      wrapText(description, detailsWidth - 20);

      // Measure the description and update the background rectangle height.
      const descBBox = description.node().getBBox();
      const newDetailsHeight = descBBox.y + descBBox.height + 40; // extra padding
      detailsRect
        .attr("height", newDetailsHeight)
        .attr("data-height", newDetailsHeight);

      // Position the "View Paper" link inside the box.
      const linkY = newDetailsHeight - 20;
      const linkGroup = content
        .append("g")
        .style("cursor", "pointer")
        .on("click", () => {
          window.open(d.link, "_blank");
        });
      linkGroup
        .append("text")
        .attr("x", 0)
        .attr("y", linkY)
        .attr("data-original-y", linkY)
        .attr("text-anchor", "middle")
        .attr("fill", "blue")
        .attr("font-size", "12px")
        .style("text-decoration", "underline")
        .text("View Paper");
    }
  }

  // --- Simulation Tick Handler ---
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
