import json
from datetime import datetime


# Read paper links from graph.json
with open('../data/graph.json', 'r') as f:
    graph_data = json.load(f)

# Extract the ids from the data
id_list = [node["id"] for node in graph_data.get("nodes", []) if "id" in node]

# Load node data from data.json.
with open("../data/graph.json", "r") as f:
    data_json = json.load(f)

# Build a dictionary mapping id -> date (as a datetime object)
model_dates = {}
for node in data_json.get("nodes", []):
    model_id = node.get("id")
    date_str = node.get("date")
    if model_id and date_str:
        try:
            # Parse the date. Adjust the format if necessary.
            model_dates[model_id] = datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError:
            # If the date format is unexpected, skip this node.
            pass

# Load source links from sources.json.
with open("sources.json", "r") as f:
    sources_data = json.load(f)

links = sources_data.get("links", [])

unique_links = []
seen_pairs = set()
missing_ids = set()

for link in links:
    source = link.get("source")
    target = link.get("target")
    
    # Record any IDs not in the allowed list.
    if source not in id_list:
        missing_ids.add(source)
    if target not in id_list:
        missing_ids.add(target)
    
    # Skip link if either source or target is not allowed.
    if source not in id_list or target not in id_list:
        continue
    
    # Check that both source and target have date information.
    if source not in model_dates:
        missing_ids.add(source)
        continue
    if target not in model_dates:
        missing_ids.add(target)
        continue

    # Omit the link if source is newer than target.
    if model_dates[source] > model_dates[target]:
        continue

    pair = (source, target)
    if pair in seen_pairs:
        continue  # Duplicate pair.
    
    seen_pairs.add(pair)
    unique_links.append(link)


# Prepare formatted JSON output.
output_json = {
    "links": unique_links
}
# Write the filtered JSON data to sources2.json with exact formatting.
with open("sources2.json", "w") as outfile:
    json.dump(output_json, outfile, indent=4)

# Write missing IDs to missing_ids.txt, one per line.
with open("missing_ids.txt", "w") as missing_file:
    for missing in sorted(missing_ids):
        missing_file.write(missing + "\n")

print("Filtered JSON saved to sources2.json.")
print("Missing IDs saved to missing_ids.txt.")
