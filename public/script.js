const width  = window.innerWidth;
const height = window.innerHeight * 4; // more vertical breathing room
const margin = { top: 50, right: 50, bottom: 50, left: 80 };

// --- Radius range ---
// scalePow with exponent 2 makes the size difference between low- and
// high-influence nodes dramatically more visible than sqrt.
const minRadius     = 10;
const maxRadius     = 52;
const expandedRadius = 38;
const textPadding   = 44;

const detailsWidth  = 230;
let detailsHeight   = 140;

// --- Org colour palette ---
const orgColors = {
  "Google":            "#4285F4",
  "OpenAI":            "#10a37f",
  "Meta":              "#0064e0",
  "DeepMind":          "#9c27b0",
  "Microsoft":         "#00a4ef",
  "Stanford":          "#e05c5c",
  "DeepSeek":          "#e84393",
  "Anthropic":         "#e8763a",
  "NVIDIA":            "#76b900",
  "Mistral":           "#ff8c42",
  "Alibaba":           "#ff6a00",
  "HuggingFace":       "#ffcc00",
  "BigScience":        "#78909c",
  "EleutherAI et al.": "#546e7a",
  "Ai2":               "#00bcd4",
  "xAI":               "#b0bec5",
};
const defaultOrgColor = "#90a4ae";

function orgColor(org) {
  for (const key of Object.keys(orgColors)) {
    if (org && org.includes(key)) return orgColors[key];
  }
  return defaultOrgColor;
}

// --- Text wrap helper ---
function wrapText(textSelection, maxWidth, lineHeight = 1.2) {
  textSelection.each(function () {
    const text  = d3.select(this);
    const words = text.text().split(/\s+/).reverse();
    let word, line = [], lineNumber = 0;
    const x  = text.attr("x") || 0;
    const y  = text.attr("y") || 0;
    const dy = parseFloat(text.attr("dy")) || 0;
    text.text("");
    let tspan = text.append("tspan").attr("x", x).attr("y", y).attr("dy", dy + "em");
    while ((word = words.pop())) {
      line.push(word);
      tspan.text(line.join(" "));
      if (tspan.node().getComputedTextLength() > maxWidth) {
        line.pop();
        tspan.text(line.join(" "));
        line = [word];
        lineNumber++;
        tspan = text
          .append("tspan").attr("x", x).attr("y", y)
          .attr("dy", lineNumber * lineHeight + dy + "em")
          .text(word);
      }
    }
  });
}

// --- SVG + zoom ---
const svg = d3.select("#dag").attr("width", width).attr("height", height);

const zoomContainer = svg.append("g");
const container     = zoomContainer.append("g");

const zoom = d3.zoom()
  .scaleExtent([0.15, 8])
  .on("zoom", (event) => {
    zoomContainer.attr("transform", event.transform);
    const k = event.transform.k;

    // Counter-scale nodes so they keep the same visual size while zooming.
    container.selectAll("g.node").each(function (d) {
      const r   = d.expanded ? expandedRadius : d.baseRadius;
      const sel = d3.select(this);
      sel.select("circle.node-body").attr("r", r / k).attr("stroke-width", 3 / k);
      sel.select("image")
        .attr("x", -(r / k)).attr("y", -(r / k))
        .attr("width", 2 * r / k).attr("height", 2 * r / k)
        .attr("clip-path", `circle(${r / k}px)`);
      sel.select("text.node-label")
        .attr("dy", (r / k) + 14 / k)
        .attr("font-size", `${12 / k}px`);
    });

    container.selectAll(".link")
      .attr("stroke-width", (d) => d._strokeWidth / k);
  });

svg.call(zoom);
svg.on("dblclick.zoom", null);

// --- Load + render ---
fetch("/api/graph")
  .then(r => r.json())
  .then(data => renderGraph(data))
  .catch(err => console.error("Error loading graph data:", err));

function renderGraph(graph) {

  // ── 1. Preprocess nodes ──────────────────────────────────────────────────
  const tempSvg = d3.select("body").append("svg").style("visibility", "hidden");
  graph.nodes.forEach(d => {
    d.dateObj    = new Date(d.date);
    d.expanded   = false;
    d.childOffset = 0;
    const el = tempSvg.append("text").text(d.name).attr("font-size", "12px");
    d.textWidth = el.node().getBBox().width + textPadding;
    el.remove();
  });
  tempSvg.remove();

  // ── 2. Compute out-degree → radius ───────────────────────────────────────
  const outDegree = {};
  graph.nodes.forEach(d => { outDegree[d.id] = 0; });
  graph.links.forEach(l => {
    const srcId = l.source.id !== undefined ? l.source.id : l.source;
    outDegree[srcId] = (outDegree[srcId] || 0) + 1;
  });
  const maxDegree  = Math.max(...Object.values(outDegree), 1);
  const radiusScale = d3.scalePow().exponent(2)
    .domain([0, maxDegree]).range([minRadius, maxRadius]);
  graph.nodes.forEach(d => {
    d.baseRadius = radiusScale(outDegree[d.id] || 0);
    d.orgColor   = orgColor(d.properties.organization);
    d.degree     = outDegree[d.id] || 0;
  });

  // ── 3. Time scale ─────────────────────────────────────────────────────────
  const dateExtent = d3.extent(graph.nodes, d => d.dateObj);
  dateExtent[0] = new Date(dateExtent[0].getFullYear(), 0, 1);
  dateExtent[1] = new Date(dateExtent[1].getFullYear() + 2, 0, 1);
  const yScale    = d3.scaleTime().domain(dateExtent).range([margin.top, height - margin.bottom]);
  const yearTicks = d3.timeYears(dateExtent[0], dateExtent[1]);

  // ── 4. Starfield (static — no SVG <animate>, avoids continuous repaints) ──
  const starGroup = container.append("g").attr("class", "stars");
  const numStars  = 250;
  for (let i = 0; i < numStars; i++) {
    starGroup.append("circle")
      .attr("cx", (Math.random() - 0.3) * width * 5)
      .attr("cy", Math.random() * height)
      .attr("r",  Math.random() * 1.3 + 0.2)
      .attr("fill", "white")
      .attr("opacity", Math.random() * 0.5 + 0.07);
  }

  // ── 5. Year grid + labels ─────────────────────────────────────────────────
  const gridGroup = container.append("g").attr("class", "grid");
  gridGroup.selectAll("line.year-line").data(yearTicks).enter()
    .append("line").attr("class", "year-line")
    .attr("x1", -99999).attr("x2", 99999)
    .attr("y1", d => yScale(d)).attr("y2", d => yScale(d));
  gridGroup.selectAll("text.year-label").data(yearTicks).enter()
    .append("text").attr("class", "year-label")
    .attr("x", margin.left - 12).attr("y", d => yScale(d)).attr("dy", "0.35em")
    .text(d => d.getFullYear());

  // ── 6. Initial x positions ────────────────────────────────────────────────
  const xScale = d3.scalePoint()
    .domain(graph.nodes.map(d => d.id))
    .range([margin.left, width - margin.right])
    .padding(60);
  graph.nodes.forEach(d => {
    d.initialX = xScale(d.id);
    if (d.x === undefined) d.x = d.initialX;
  });

  // ── 7. Force simulation ───────────────────────────────────────────────────
  // Much stronger repulsion and wider collision to give every node its own space.
  const simulation = d3.forceSimulation(graph.nodes)
    .force("x", d3.forceX(d => d.initialX).strength(0.4))
    .force("y", d3.forceY(d => yScale(d.dateObj)).strength(1))
    .force("link",
      d3.forceLink(graph.links).id(d => d.id).distance(320).strength(0.3))
    .force("charge", d3.forceManyBody().strength(-600).distanceMax(1200))
    .force("collision", d3.forceCollide(d => {
      const r = d.expanded ? expandedRadius : d.baseRadius;
      return Math.max(r * 3, d.textWidth + 50);
    }))
    .velocityDecay(0.75)
    .on("tick", ticked);

  // ── 8. Link child-offset preprocessing ───────────────────────────────────
  graph.links.forEach(link => {
    const tgtId = link.target.id !== undefined ? link.target.id : link.target;
    const srcId = link.source.id !== undefined ? link.source.id : link.source;
    const srcNode = graph.nodes.find(n => n.id === srcId);
    const tgtNode = graph.nodes.find(n => n.id === tgtId);
    if (srcNode) {
      srcNode.childOffset = (srcNode.childOffset || 0) + 1;
      if (tgtNode) {
        tgtNode.parent      = srcNode.id;
        tgtNode.childOffset = srcNode.childOffset;
      }
    }
  });

  // ── 9. SVG defs: filters + per-link gradients ────────────────────────────
  const svgDefs = svg.append("defs");

  // Drop-shadow for detail popup only (single filter, not applied to many elements)
  svgDefs.append("filter").attr("id", "dropShadow").html(`
    <feGaussianBlur in="SourceAlpha" stdDeviation="4"/>
    <feOffset dx="0" dy="3" result="offsetblur"/>
    <feFlood flood-color="#00000066"/>
    <feComposite in2="offsetblur" operator="in"/>
    <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
  `);

  // Per-link linear gradient.
  // gradientUnits="objectBoundingBox" means the gradient automatically follows
  // the path bounding box — no per-tick coordinate updates needed.
  graph.links.forEach((l, i) => {
    const srcId   = l.source.id !== undefined ? l.source.id : l.source;
    const tgtId   = l.target.id !== undefined ? l.target.id : l.target;
    const srcNode = graph.nodes.find(n => n.id === srcId);
    const tgtNode = graph.nodes.find(n => n.id === tgtId);
    const gradId  = `link-grad-${i}`;
    l._gradId = gradId;

    const deg      = srcNode ? srcNode.degree : 0;
    l._strokeWidth = 0.6 + Math.sqrt(deg) * 0.55;
    l._opacity     = 0.22 + Math.min(deg / maxDegree, 1) * 0.5;

    const grad = svgDefs.append("linearGradient")
      .attr("id", gradId)
      .attr("gradientUnits", "objectBoundingBox")
      .attr("x1", "0%").attr("y1", "0%")
      .attr("x2", "0%").attr("y2", "100%");
    grad.append("stop").attr("offset", "0%")
      .attr("stop-color", srcNode ? srcNode.orgColor : defaultOrgColor)
      .attr("stop-opacity", l._opacity);
    grad.append("stop").attr("offset", "100%")
      .attr("stop-color", tgtNode ? tgtNode.orgColor : defaultOrgColor)
      .attr("stop-opacity", l._opacity * 0.55);
  });

  // ── 10. Draw links ────────────────────────────────────────────────────────
  const linkGroup    = container.append("g").attr("class", "links");
  const linkElements = linkGroup.selectAll("path").data(graph.links).enter()
    .append("path")
    .attr("class", "link")
    .attr("stroke", d => `url(#${d._gradId})`)
    .attr("stroke-width", d => d._strokeWidth);

  // ── 11. Draw nodes ────────────────────────────────────────────────────────
  const nodeGroup    = container.append("g").attr("class", "nodes");
  const nodeElements = nodeGroup.selectAll("g.node").data(graph.nodes).enter()
    .append("g").attr("class", "node")
    // CSS drop-shadow is GPU-accelerated and far cheaper than SVG feGaussianBlur.
    // Glow size and intensity scale with the node's influence (degree).
    .style("filter", d => {
      const spread = Math.max(4, d.baseRadius * 0.55);
      const bright = Math.max(6, d.baseRadius * 1.1);
      return `drop-shadow(0 0 ${spread}px ${d.orgColor}) drop-shadow(0 0 ${bright}px ${d.orgColor}40)`;
    })
    .on("click", function (event, d) {
      d.expanded = !d.expanded;
      d.fx = d.expanded ? d.x : null;
      d.fy = d.expanded ? d.y : null;
      simulation.alphaTarget(0.05).restart();
      d3.select(this).raise();
      updateNodeDetails(d3.select(this), d, d.expanded);
    });

  // Main white body circle
  nodeElements.append("circle")
    .attr("class", "node-body")
    .attr("r", d => d.baseRadius)
    .attr("fill", "white")
    .attr("stroke", d => d.orgColor)
    .attr("stroke-width", 3);

  // Logo image
  nodeElements.append("image")
    .attr("xlink:href", d => "icons/" + d.image)
    .attr("x", d => -d.baseRadius).attr("y", d => -d.baseRadius)
    .attr("width", d => 2 * d.baseRadius).attr("height", d => 2 * d.baseRadius)
    .attr("clip-path", d => `circle(${d.baseRadius}px)`);

  // Label
  nodeElements.append("text")
    .attr("class", "node-label")
    .attr("dy", d => d.baseRadius + 14)
    .attr("text-anchor", "middle")
    .attr("font-size", "12px")
    .attr("font-family", "'Inter', sans-serif")
    .attr("font-weight", "500")
    .attr("fill", "rgba(220, 232, 255, 0.92)")
    .style("text-shadow",
      "0 1px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.7)")
    .text(d => d.name);

  // ── 12. Expanded-node detail popup ────────────────────────────────────────
  function updateNodeDetails(nodeSelection, d, showDetails) {
    nodeSelection.selectAll(".details").remove();

    const r = showDetails ? expandedRadius : d.baseRadius;

    nodeSelection.select("circle.node-body")
      .attr("r", r).attr("stroke-width", 3);
    nodeSelection.select("text.node-label")
      .attr("dy", showDetails ? expandedRadius + 16 : d.baseRadius + 14);
    nodeSelection.select("image")
      .attr("x", -r).attr("y", -r)
      .attr("width", 2 * r).attr("height", 2 * r)
      .attr("clip-path", `circle(${showDetails ? r - 2 : r}px)`);

    if (!showDetails) return;

    const details = nodeSelection.append("g")
      .attr("class", "details")
      .attr("transform", `translate(0, ${expandedRadius + 34})`);
    details.raise();

    // Dark glass background
    const detailsRect = details.append("rect")
      .attr("x", -detailsWidth / 2)
      .attr("y", 0)
      .attr("width", detailsWidth)
      .attr("height", detailsHeight)
      .attr("fill", "rgba(6, 10, 35, 0.92)")
      .attr("stroke", d.orgColor)
      .attr("stroke-opacity", 0.45)
      .attr("stroke-width", 1)
      .attr("rx", 10).attr("ry", 10)
      .attr("filter", "url(#dropShadow)");

    const content = details.append("g").attr("transform", "translate(0, 12)");

    const addText = (txt, y, opts = {}) =>
      content.append("text")
        .attr("x", 0).attr("y", y)
        .attr("text-anchor", "middle")
        .attr("font-size", opts.size || "12px")
        .attr("font-family", "'Inter', sans-serif")
        .attr("fill", opts.color || "#a8bce0")
        .attr("font-weight", opts.weight || "normal")
        .text(txt);

    addText(d.name, 20,  { color: "#e8f0ff", weight: "600", size: "13px" });
    addText(d.date, 38,  { color: "#6a82a8", size: "11px" });
    addText(d.properties.organization, 54, { color: d.orgColor, size: "11px" });

    const desc = content.append("text")
      .attr("x", 0).attr("y", 70).attr("dy", "0em")
      .attr("text-anchor", "middle")
      .attr("font-size", "11px")
      .attr("font-family", "'Inter', sans-serif")
      .attr("fill", "#8aa0cc")
      .text(d.properties.description);
    wrapText(desc, detailsWidth - 24);

    const descBBox       = desc.node().getBBox();
    const newHeight      = descBBox.y + descBBox.height + 60;
    detailsRect.attr("height", newHeight);

    const linkG = content.append("g")
      .style("cursor", "pointer")
      .on("click", () => window.open(d.link, "_blank"));
    linkG.append("text")
      .attr("x", 0).attr("y", newHeight - 30)
      .attr("text-anchor", "middle")
      .attr("font-size", "11px")
      .attr("fill", "#6ab0ff")
      .attr("font-family", "'Inter', sans-serif")
      .style("text-decoration", "underline")
      .text("View Paper / Announcement");
  }

  // ── 13. Tick handler ──────────────────────────────────────────────────────
  function ticked() {
    nodeElements.attr("transform", d => `translate(${d.x}, ${yScale(d.dateObj)})`);

    linkElements.attr("d", d => {
      const x1 = d.source.x, y1 = yScale(d.source.dateObj);
      const x2 = d.target.x, y2 = yScale(d.target.dateObj);
      const dy  = y2 - y1;
      // Tighter S-curve: control points pulled 35% toward the midpoint
      // from each endpoint, keeping x fixed → clean parallel fan-out.
      const cy1 = y1 + dy * 0.35;
      const cy2 = y2 - dy * 0.35;
      return `M${x1},${y1} C${x1},${cy1} ${x2},${cy2} ${x2},${y2}`;
    });

  }
}
