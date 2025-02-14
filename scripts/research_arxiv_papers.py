import requests
import pdfplumber
import io
import json
from typing import List

LOCAL_MODEL = "gemma2:27b"

def get_pdf_url(arxiv_url: str) -> str:
    """Convert any arXiv URL to its PDF version."""
    if 'abs' in arxiv_url:
        return arxiv_url.replace('abs', 'pdf') + '.pdf'
    elif arxiv_url.endswith('.pdf'):
        return arxiv_url
    else:
        raise ValueError("Invalid arXiv URL format")

def download_pdf(url: str) -> bytes:
    """Download PDF content from arXiv."""
    response = requests.get(url)
    response.raise_for_status()
    return response.content

def extract_text_from_pdf(pdf_content: bytes) -> str:
    """Extract text from PDF bytes using pdfplumber."""
    text = []
    with pdfplumber.open(io.BytesIO(pdf_content)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text.append(page_text)
    return text

def generate_summary(text: str, id_list: List[str]) -> str:

    """Generate summary using local Ollama LLM."""
    prompt = (
        f'Paper content:\n{text}'
        f'Id list:\n"{id_list}'
        'Write a short description of the following model for '
        'a general audience, going over important model architecture '
        'and details about how big the model is or areas where it excels. '
        'Keep the tone objective and use your knowledge of transformers'
        'non-promotional. Only include the summary in your response.'
        'Respond in the following format:'
        '{"<insert model id>": "<insert summary>"},'
        'Only include json in your response.'
    )
    print("generating summary")
    return call_ollama(text, LOCAL_MODEL, prompt)


def find_source_models(text: str, id_list: List[str]) -> str:
    """Generate summary using local Ollama LLM."""
    prompt = (
        f'Paper content:\n{text}'
        f'Id list:\n"{id_list}'
        'Using information from the Method or Architecture sections '
        'of the provided LLM paper you just read, generate a list of source LLMs '
        'that are directly and clearly cited as sources of inspiration '
        'for the paper. Provide your output in the following json format '
        '{"source": source_llm_id, "target": llm_id},'
        'Where source_llm_id was cited as a influence on llm_id '
        'If the source_id is not in the id list make a note of it:'
        '{"Missing node": <create new_llm_id for this paper>}'
        'Only include json in your response.'
    )

    
    return call_ollama(text, LOCAL_MODEL, prompt)

def call_ollama(text: str, model: str, prompt: str) -> str:
    """Calls ollama with provided prompt"""
    try:
        print("calling ollama")
        response = requests.post(
            'http://localhost:11434/api/generate',
            json={
                'model': model,
                'prompt': prompt,
                'stream': False
            }
        )
        response.raise_for_status()
        return response.json()['response']
    except requests.exceptions.RequestException as e:
        print("failed to call ollama")
        return f"Error generating summary: {str(e)}"

def process_papers(urls: List[str], id_list: List[str]) -> dict[str, List[str]]:
    """Process list of arXiv URLs and return summaries."""
    summaries = []
    sources = []


    for url in urls:
        try:
            print(f"Processing {url}...")
            pdf_url = get_pdf_url(url)
            pdf_content = download_pdf(pdf_url)
            text = extract_text_from_pdf(pdf_content)

            summary = generate_summary(text, id_list)
            sources = find_source_models(text, id_list)

            #print(summary)
            print(sources)
            summaries.append(summary)
            sources.append(sources)
            
        except Exception as e:
            summaries.append(f"Failed to process {url}: {str(e)}")
    
    research = {}
    research["summaries"] = summaries
    research["sources"] = sources
    return research

if __name__ == "__main__":
    # Read paper links from graph.json
    with open('../data/missing.json', 'r') as f:
        graph_data = json.load(f)
    
    # Extract the ids from the data
    id_list = [node["id"] for node in graph_data.get("nodes", []) if "id" in node]
    # Extract all arXiv links from nodes
    arxiv_urls = [
        node["link"] 
        for node in graph_data.get("nodes", []) 
        if "link" in node and "arxiv.org" in node["link"]
    ]
    
    if not arxiv_urls:
        print("No arXiv links found in graph.json")
        exit()
        
    research = process_papers(arxiv_urls, id_list)
    
    # Write to summaries.txt with one summary per line
    with open('summaries.txt', 'w', encoding='utf-8') as f:
        for summary in research["summaries"]:
            # Remove newlines and extra whitespace from each summary
            cleaned_summary = ' '.join(summary.split())
            f.write(f"{cleaned_summary}\n")
    
    print(f"Successfully wrote {len(research["summaries"])} summaries to summaries.txt")

    # Write to sources.txt with one summary per line
    with open('sources.txt', 'w', encoding='utf-8') as f:
        for source in research["sources"]:
            # Remove newlines and extra whitespace from each summary
            f.write(f"{source}")
    
    print(f"Successfully wrote {len(research["sources"])} sources to summaries.txt")