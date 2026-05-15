# LLM Tree

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

An interactive visualization of Large Language Model (LLM) development timelines using a Directed Acyclic Graph (DAG) representation.

**Purpose**: This project serves to document and visualize the rapid evolution of Large Language Models. By mapping out the lineage of these models, as far as it is possible to do so with publically available information, it aims to help researchers, developers, and AI enthusiasts understand the relationships, architectural derivations, and release timelines of the most influential AI models in the industry.

![Screenshot](llm-tree-banner.gif)

## Implementation Details

### Core Technologies

- **D3.js** (v7) - Graph rendering and force simulation
- **SVG** - Vector graphics rendering
- **Modern JavaScript** (ES6+) - Interactive functionality
- **CSS3** - Animations and styling
- **Express.js** (Node.js) - Local API server and static asset hosting

### Architecture

```plaintext
project-root/
├── data/
│   └── graph.json            # LLM node data
├── public/
│   ├── icons/                # Images/icons
│   ├── script.js             # Main application logic
│   └── index.html            # Main entry point
├── app.js                    # Express server / API provider
```

### Key Components

#### Data Structure
- Nodes with temporal, organizational, and technical metadata.
- Parent-child relationships for model evolution.
- Auto-calculated text widths for collision prevention.

#### Visualization Engine
- Force simulation with multiple constraints:
  - Temporal y-axis positioning.
  - Collision detection.
  - Parent-child spacing.
- Dynamic scaling during zoom operations.

#### UI Components
- Animated gradient background.
- Context-preserving year grid lines.
- Resizable node details panels.
- Persistent informational overlays.

## Installation & Usage

### Prerequisites
- Modern web browser (Chrome / Firefox / Safari)
- Node.js

### Quick Start

1. Clone the repository:
   ```bash
   git clone https://github.com/josh-janes/llm-tree.git
   cd llm-tree
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the application:
   ```bash
   npm start
   ```
4. Open your browser and navigate to: http://localhost:3000

## Data API

The graph expects a JSON endpoint at `/api/graph` with following structure:

```json
{
  "nodes": [
    {
      "id": "model-id",
      "name": "Model Name",
      "date": "YYYY-MM-DD",
      "link": "arxiv-url",
      "image": "image-url",
      "properties": {
        "organization": "Developer",
        "type": "Architecture"
      }
    }
  ],
  "links": [{ "source": "parent-id", "target": "child-id" }]
}
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/improvement`
3. Commit your changes: `git commit -am 'Add new feature'`
4. Push to the branch: `git push origin feature/improvement`
5. Open a Pull Request

## Acknowledgments

- D3.js visualization library
- Font Awesome icons
- arXiv.org for research paper metadata
